export interface HashEntry {
  id: string;
  n: string;
  s: string;
  h: string;
}

interface HashIndex {
  version: number;
  count: number;
  cards: HashEntry[];
}

let indexCache: HashEntry[] | null = null;
let loadPromise: Promise<HashEntry[]> | null = null;

export async function loadHashIndex(): Promise<HashEntry[]> {
  if (indexCache) return indexCache;
  if (loadPromise) return loadPromise;

  loadPromise = fetch("/card-hashes.json")
    .then((res) => res.json())
    .then((data: HashIndex) => {
      indexCache = data.cards;
      return indexCache;
    });

  return loadPromise;
}

export function computeDHash(
  canvas: HTMLCanvasElement,
  source: HTMLVideoElement | HTMLImageElement,
  cropRegion?: { x: number; y: number; w: number; h: number }
): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  canvas.width = 9;
  canvas.height = 8;

  if (cropRegion) {
    ctx.drawImage(source, cropRegion.x, cropRegion.y, cropRegion.w, cropRegion.h, 0, 0, 9, 8);
  } else {
    ctx.drawImage(source, 0, 0, 9, 8);
  }

  const pixels = ctx.getImageData(0, 0, 9, 8).data;

  let lo = 0;
  let hi = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const leftIdx = (y * 9 + x) * 4;
      const rightIdx = (y * 9 + x + 1) * 4;

      const leftGray = pixels[leftIdx] * 0.299 + pixels[leftIdx + 1] * 0.587 + pixels[leftIdx + 2] * 0.114;
      const rightGray = pixels[rightIdx] * 0.299 + pixels[rightIdx + 1] * 0.587 + pixels[rightIdx + 2] * 0.114;

      const bit = y * 8 + x;
      if (leftGray > rightGray) {
        if (bit < 32) lo |= 1 << bit;
        else hi |= 1 << (bit - 32);
      }
    }
  }

  return (hi >>> 0).toString(16).padStart(8, "0") + (lo >>> 0).toString(16).padStart(8, "0");
}

function popcount32(n: number): number {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
}

export function hammingDistance(a: string, b: string): number {
  const aHi = parseInt(a.slice(0, 8), 16) >>> 0;
  const aLo = parseInt(a.slice(8, 16), 16) >>> 0;
  const bHi = parseInt(b.slice(0, 8), 16) >>> 0;
  const bLo = parseInt(b.slice(8, 16), 16) >>> 0;
  return popcount32(aHi ^ bHi) + popcount32(aLo ^ bLo);
}

export interface MatchResult {
  entry: HashEntry;
  distance: number;
}

export function findBestMatch(hash: string, index: HashEntry[], threshold = 14): MatchResult | null {
  let best: MatchResult | null = null;

  for (const entry of index) {
    const dist = hammingDistance(hash, entry.h);
    if (dist < (best?.distance ?? threshold + 1)) {
      best = { entry, distance: dist };
    }
  }

  if (best && best.distance <= threshold) return best;
  return null;
}
