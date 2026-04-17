/**
 * dHash (difference hash) utilities — shared between API route and build script.
 *
 * Algorithm:
 *   1. Resize image to 9×8 pixels, greyscale
 *   2. For each row of 8 pixels, compare left vs right neighbour (8 comparisons × 8 rows = 64 bits)
 *   3. Encode as 16-character hex string
 *
 * Hamming distance ≤ 10  → strong match
 * Hamming distance 10-20 → possible match, show picker
 * Hamming distance > 20  → no match, fall back to OCR
 */

export interface HashEntry {
  /** Scryfall card ID */
  id: string;
  /** Card name */
  n: string;
  /** Set code */
  s: string;
  /** 64-bit dHash as 16 hex chars */
  h: string;
}

export interface HashIndex {
  version: number;
  generated: string;
  count: number;
  cards: HashEntry[];
}

export interface ScanMatch {
  id: string;
  name: string;
  setCode: string;
  distance: number;
}

/** Count set bits in a 16-bit integer */
function popcount16(n: number): number {
  n = n - ((n >> 1) & 0x5555);
  n = (n & 0x3333) + ((n >> 2) & 0x3333);
  n = (n + (n >> 4)) & 0x0f0f;
  return ((n * 0x0101) >> 8) & 0x7f;
}

/** Hamming distance between two 16-char hex hashes */
export function hammingDistance(a: string, b: string): number {
  let dist = 0;
  for (let i = 0; i < 16; i += 4) {
    const chunkA = parseInt(a.slice(i, i + 4), 16);
    const chunkB = parseInt(b.slice(i, i + 4), 16);
    dist += popcount16(chunkA ^ chunkB);
  }
  return dist;
}

/** Find the best matches in the hash index for a given query hash */
export function findMatches(
  queryHash: string,
  index: HashEntry[],
  maxDistance = 20,
  maxResults = 5
): ScanMatch[] {
  const results: ScanMatch[] = [];

  for (const entry of index) {
    const dist = hammingDistance(queryHash, entry.h);
    if (dist <= maxDistance) {
      results.push({ id: entry.id, name: entry.n, setCode: entry.s, distance: dist });
    }
  }

  return results
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxResults);
}

/**
 * Compute dHash from a 9×8 raw greyscale pixel buffer (72 bytes).
 * Each byte is a pixel value 0-255.
 * This is the format returned by sharp({ raw: true }).
 */
export function dHashFromRaw(pixels: Uint8Array | Buffer): string {
  let lo = 0;
  let hi = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = pixels[y * 9 + x];
      const right = pixels[y * 9 + x + 1];
      const bit = y * 8 + x;
      if (left > right) {
        if (bit < 32) lo |= 1 << bit;
        else hi |= 1 << (bit - 32);
      }
    }
  }
  return (hi >>> 0).toString(16).padStart(8, "0") +
         (lo >>> 0).toString(16).padStart(8, "0");
}
