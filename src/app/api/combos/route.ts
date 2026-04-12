import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import type { ScryfallCard } from "@/types/card";
import type { EnrichedCombo, CombosResponse } from "@/types/combo";

const SPELLBOOK  = "https://backend.commanderspellbook.com/api/v2";
const SCRYFALL   = "https://api.scryfall.com";
const TTL_HOURS  = 24;

// ── Spellbook shapes ─────────────────────────────────────────────────────────

interface SBCard   { name: string }
interface SBUse    { card: SBCard; zoneLocations: string[]; mustBeCommander: boolean }
interface SBResult { feature: { name: string } }
interface SBCombo  {
  id: string;
  uses: SBUse[];
  requires: unknown[];
  produces: SBResult[];
  description: string;
  notes: string;
  status: string;
  popularity: number | null;
  spoiler: boolean;
}
interface SBResponse { count: number; results: SBCombo[] }

// ── Cache helpers ─────────────────────────────────────────────────────────────

async function readCache(cardName: string): Promise<CombosResponse | null> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from("combo_cache")
      .select("combos, count")
      .eq("card_name", cardName)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!data) return null;
    return { combos: data.combos as EnrichedCombo[], count: data.count as number };
  } catch {
    return null; // cache miss on error — fall through to live fetch
  }
}

async function writeCache(cardName: string, payload: CombosResponse): Promise<void> {
  try {
    const sb = getSupabase();
    const now = new Date();
    const expires = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000);
    await sb.from("combo_cache").upsert({
      card_name:  cardName,
      combos:     payload.combos,
      count:      payload.count,
      cached_at:  now.toISOString(),
      expires_at: expires.toISOString(),
    });
  } catch {
    // write failure is non-fatal — user still gets the data
  }
}

// ── Live fetch helpers ────────────────────────────────────────────────────────

async function querySpellbook(q: string): Promise<SBResponse | null> {
  const url = `${SPELLBOOK}/combos/?q=${encodeURIComponent(q)}&ordering=-popularity&limit=50`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return res.json() as Promise<SBResponse>;
  } catch {
    return null;
  }
}

async function fetchFromSpellbook(name: string): Promise<{ combos: SBCombo[]; count: number }> {
  // Strategy 1: exact card name with card: prefix (e.g. card:"Temur Sabertooth")
  let data = await querySpellbook(`card:"${name}"`);

  // Strategy 2: fall back to plain name search if card: prefix returns nothing
  if (!data || data.count === 0) {
    data = await querySpellbook(name);
  }

  if (!data) return { combos: [], count: 0 };

  // Accept OK and PREVIEW statuses; exclude spoilers and non-working combos
  const VALID_STATUSES = new Set(["OK", "PREVIEW"]);
  const combos = data.results.filter((c) => VALID_STATUSES.has(c.status) && !c.spoiler);
  return { combos, count: data.count };
}

async function enrichWithScryfall(combos: SBCombo[]): Promise<Map<string, ScryfallCard>> {
  const allNames = new Set<string>();
  for (const combo of combos) {
    for (const use of combo.uses) allNames.add(use.card.name);
  }

  const nameArray = Array.from(allNames);
  const map = new Map<string, ScryfallCard>();

  for (let i = 0; i < nameArray.length; i += 75) {
    const identifiers = nameArray.slice(i, i + 75).map((n) => ({ name: n }));
    try {
      const res = await fetch(`${SCRYFALL}/cards/collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers }),
      });
      if (res.ok) {
        const body: { data: ScryfallCard[] } = await res.json();
        for (const card of body.data) map.set(card.name.toLowerCase(), card);
      }
    } catch {
      // partial enrichment is fine
    }
  }

  return map;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // 1. Try cache first
  const cached = await readCache(name);
  if (cached) {
    return NextResponse.json({ ...cached, fromCache: true } satisfies CombosResponse & { fromCache: boolean });
  }

  // 2. Fetch live from Commander Spellbook
  const { combos: sbCombos, count } = await fetchFromSpellbook(name);
  if (sbCombos.length === 0) {
    // Do NOT cache empty results — the API query may have failed or the card
    // may gain combos soon. Return empty without writing to cache.
    return NextResponse.json({ combos: [], count } satisfies CombosResponse);
  }

  // 3. Enrich card objects from Scryfall
  const scryfallMap = await enrichWithScryfall(sbCombos);

  // 4. Merge
  const enriched: EnrichedCombo[] = sbCombos.map((combo) => ({
    id: combo.id,
    cards: combo.uses.map((use) => ({
      name: use.card.name,
      zoneLocations: use.zoneLocations,
      mustBeCommander: use.mustBeCommander,
      scryfall: scryfallMap.get(use.card.name.toLowerCase()),
    })),
    produces: combo.produces.map((p) => p.feature.name),
    description: combo.description,
    notes: combo.notes,
    popularity: combo.popularity,
  }));

  const payload: CombosResponse = { combos: enriched, count };

  // 5. Write to cache (non-blocking)
  void writeCache(name, payload);

  return NextResponse.json(payload);
}
