import type { ScryfallCard, ScryfallList, ScryfallRuling, ScryfallSet } from "@/types/card";

const BASE_URL = "https://api.scryfall.com";
const MIN_REQUEST_GAP = 100;

let lastRequestTime = 0;

const cache = new Map<string, { data: unknown; expiry: number }>();

const CACHE_TTLS = {
  autocomplete: 2 * 60 * 1000,
  search: 5 * 60 * 1000,
  card: 60 * 60 * 1000,
  rulings: 24 * 60 * 60 * 1000,
  sets: 24 * 60 * 60 * 1000,
  printings: 60 * 60 * 1000,
};

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttl: number) {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_GAP) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_GAP - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, {
    headers: {
      "User-Agent": "MTGHoudini/1.0",
      Accept: "application/json",
    },
  });
}

export async function searchCards(
  query: string,
  page = 1,
  order = "name",
  dir = "auto",
  unique = "cards"
): Promise<ScryfallList<ScryfallCard>> {
  const params = new URLSearchParams({ q: query, page: String(page), order, dir, unique });
  const cacheKey = `search:${params.toString()}`;
  const cached = getCached<ScryfallList<ScryfallCard>>(cacheKey);
  if (cached) return cached;

  const res = await rateLimitedFetch(`${BASE_URL}/cards/search?${params}`);
  if (res.status === 404) return { object: "list", has_more: false, data: [] };
  if (!res.ok) throw new Error(`Scryfall search failed: ${res.status}`);
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTLS.search);
  return data;
}

export async function getCard(id: string): Promise<ScryfallCard> {
  const cacheKey = `card:${id}`;
  const cached = getCached<ScryfallCard>(cacheKey);
  if (cached) return cached;

  const res = await rateLimitedFetch(`${BASE_URL}/cards/${id}`);
  if (!res.ok) throw new Error(`Scryfall card fetch failed: ${res.status}`);
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTLS.card);
  return data;
}

export async function getCardByName(name: string): Promise<ScryfallCard> {
  const params = new URLSearchParams({ exact: name });
  const res = await rateLimitedFetch(`${BASE_URL}/cards/named?${params}`);
  if (!res.ok) throw new Error(`Scryfall named card fetch failed: ${res.status}`);
  return res.json();
}

export async function autocomplete(query: string): Promise<string[]> {
  const cacheKey = `auto:${query}`;
  const cached = getCached<{ data: string[] }>(cacheKey);
  if (cached) return cached.data;

  const params = new URLSearchParams({ q: query });
  const res = await rateLimitedFetch(`${BASE_URL}/cards/autocomplete?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTLS.autocomplete);
  return data.data;
}

export async function getRulings(id: string): Promise<ScryfallRuling[]> {
  const cacheKey = `rulings:${id}`;
  const cached = getCached<ScryfallList<ScryfallRuling>>(cacheKey);
  if (cached) return cached.data;

  const res = await rateLimitedFetch(`${BASE_URL}/cards/${id}/rulings`);
  if (!res.ok) return [];
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTLS.rulings);
  return data.data;
}

export async function getSets(): Promise<ScryfallSet[]> {
  const cacheKey = "sets";
  const cached = getCached<ScryfallList<ScryfallSet>>(cacheKey);
  if (cached) return cached.data;

  const res = await rateLimitedFetch(`${BASE_URL}/sets`);
  if (!res.ok) throw new Error(`Scryfall sets fetch failed: ${res.status}`);
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTLS.sets);
  return data.data;
}

export async function getCardPrintings(oracleId: string): Promise<ScryfallCard[]> {
  const cacheKey = `printings:${oracleId}`;
  const cached = getCached<ScryfallList<ScryfallCard>>(cacheKey);
  if (cached) return cached.data;

  const params = new URLSearchParams({
    q: `oracleid:${oracleId}`,
    unique: "prints",
    order: "released",
  });
  const res = await rateLimitedFetch(`${BASE_URL}/cards/search?${params}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Scryfall printings fetch failed: ${res.status}`);
  const data = await res.json();
  setCache(cacheKey, data, CACHE_TTLS.printings);
  return data.data;
}
