import { RulingResponse } from "./answer";

interface CacheEntry {
  response: RulingResponse;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 500;
const TTL_MS = 60 * 60 * 1000; // 1 hour

function normalizeKey(question: string, cards: string[], format?: string): string {
  const q = question.toLowerCase().trim().replace(/\s+/g, " ");
  const c = cards.map((n) => n.toLowerCase().trim()).sort().join("|");
  const f = format?.toLowerCase() ?? "";
  return `${q}::${c}::${f}`;
}

export function getCachedRuling(
  question: string,
  cards: string[],
  format?: string
): RulingResponse | null {
  const key = normalizeKey(question, cards, format);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.response;
}

export function setCachedRuling(
  question: string,
  cards: string[],
  format: string | undefined,
  response: RulingResponse
): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < Math.floor(MAX_ENTRIES / 4); i++) {
      cache.delete(oldest[i][0]);
    }
  }
  const key = normalizeKey(question, cards, format);
  cache.set(key, { response, timestamp: Date.now() });
}
