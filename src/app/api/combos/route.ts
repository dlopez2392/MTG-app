import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import type { EnrichedCombo, CombosResponse } from "@/types/combo";

// API moved from /api/v2/combos/ to /variants/ in early 2025
const SPELLBOOK = "https://backend.commanderspellbook.com";
const TTL_HOURS  = 24;

// ── Spellbook v3 shapes ───────────────────────────────────────────────────────

interface SBCard {
  id: number;
  name: string;
  spoiler: boolean;
  typeLine: string;
  imageUriFrontSmall:  string | null;
  imageUriFrontNormal: string | null;
}

interface SBUse {
  card: SBCard;
  quantity: number;
  zoneLocations: string[];
  mustBeCommander: boolean;
}

interface SBVariant {
  id: string;
  uses: SBUse[];
  produces: Array<{ feature: { name: string } }>;
  description: string;
  notes: string;
  status: string;
  spoiler: boolean;
  popularity: number | null;
}

interface SBResponse {
  count: number | null;
  next: string | null;
  results: SBVariant[];
}

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
    return null;
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
    // write failure is non-fatal
  }
}

// ── Live fetch ────────────────────────────────────────────────────────────────

async function queryVariants(q: string): Promise<SBResponse | null> {
  const url = `${SPELLBOOK}/variants/?q=${encodeURIComponent(q)}&ordering=-popularity&limit=50`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "MTGHoudini/1.0" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<SBResponse>;
  } catch {
    return null;
  }
}

async function fetchFromSpellbook(name: string): Promise<{ combos: SBVariant[]; count: number }> {
  // Strategy 1: exact card name with card: prefix
  let data = await queryVariants(`card:"${name}"`);

  // Strategy 2: plain name fallback
  if (!data || (data.results?.length ?? 0) === 0) {
    data = await queryVariants(name);
  }

  if (!data || !data.results) return { combos: [], count: 0 };

  const VALID = new Set(["OK", "PREVIEW"]);
  const combos = data.results.filter((c) => VALID.has(c.status) && !c.spoiler);
  // count is null in new API — use results length as count
  return { combos, count: combos.length };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // 1. Try cache
  const cached = await readCache(name);
  if (cached) {
    return NextResponse.json({ ...cached, fromCache: true } satisfies CombosResponse & { fromCache: boolean });
  }

  // 2. Fetch live from Spellbook
  const { combos: sbCombos, count } = await fetchFromSpellbook(name);

  if (sbCombos.length === 0) {
    return NextResponse.json({ combos: [], count } satisfies CombosResponse);
  }

  // 3. Map to EnrichedCombo — card images come directly from Spellbook now
  const enriched: EnrichedCombo[] = sbCombos.map((variant) => ({
    id: variant.id,
    cards: variant.uses.map((use) => ({
      name: use.card.name,
      zoneLocations: use.zoneLocations,
      mustBeCommander: use.mustBeCommander,
      imageUri: use.card.imageUriFrontSmall ?? use.card.imageUriFrontNormal ?? undefined,
    })),
    produces: variant.produces.map((p) => p.feature.name),
    description: variant.description ?? "",
    notes: variant.notes ?? "",
    popularity: variant.popularity,
  }));

  const payload: CombosResponse = { combos: enriched, count };

  // 4. Cache non-empty results
  void writeCache(name, payload);

  return NextResponse.json(payload);
}
