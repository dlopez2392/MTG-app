import { getSupabase } from "@/lib/supabase/server";
import type { LegalityStatus } from "./legalityDiff";

export type CardLegalities = Record<string, LegalityStatus>;
export interface SnapshotRow {
  scryfall_id: string;
  card_name: string;
  legalities: CardLegalities;
}
export const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

interface DbRow {
  scryfall_id: string;
  card_name: string;
  legalities: CardLegalities;
  updated_at: string;
}

const SCRYFALL_CHUNK = 75;

async function fetchLegalities(
  ids: string[]
): Promise<Map<string, { name: string; legalities: CardLegalities }>> {
  const out = new Map<string, { name: string; legalities: CardLegalities }>();
  for (let i = 0; i < ids.length; i += SCRYFALL_CHUNK) {
    const chunk = ids.slice(i, i + SCRYFALL_CHUNK);
    try {
      const res = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "MTGHoudini/1.0",
          Accept: "application/json",
        },
        body: JSON.stringify({ identifiers: chunk.map((id) => ({ id })) }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: { id: string; name: string; legalities: CardLegalities }[];
      };
      for (const c of data.data ?? []) {
        out.set(c.id, { name: c.name, legalities: c.legalities });
      }
    } catch {
      // best-effort; leave these ids unfetched (caller keeps prior snapshot)
    }
  }
  return out;
}

/**
 * Load prior snapshot + freshest legalities for the given card ids.
 * Refetches ids that are missing from the snapshot or older than the TTL.
 * Does NOT write — the caller upserts `toUpsert`.
 */
export async function loadLegalities(scryfallIds: string[]): Promise<{
  prev: Map<string, CardLegalities>;
  curr: Map<string, { name: string; legalities: CardLegalities }>;
  toUpsert: SnapshotRow[];
}> {
  const prev = new Map<string, CardLegalities>();
  const curr = new Map<string, { name: string; legalities: CardLegalities }>();
  const toUpsert: SnapshotRow[] = [];
  const ids = [...new Set(scryfallIds.filter(Boolean))];
  if (ids.length === 0) return { prev, curr, toUpsert };

  const sb = getSupabase();
  // Read the snapshot in chunks. A single .in() with hundreds of ids builds a
  // multi-KB request URL that overflows PostgREST's header limit (~16KB) and
  // fails the whole query — which would silently make every card look new.
  const READ_CHUNK = 150;
  const rows: DbRow[] = [];
  for (let i = 0; i < ids.length; i += READ_CHUNK) {
    const chunk = ids.slice(i, i + READ_CHUNK);
    const { data } = await sb
      .from("card_legality_snapshot")
      .select("scryfall_id, card_name, legalities, updated_at")
      .in("scryfall_id", chunk);
    if (data) rows.push(...(data as DbRow[]));
  }

  const now = Date.now();
  const stale: string[] = [];
  const byId = new Map(rows.map((r) => [r.scryfall_id, r]));
  for (const id of ids) {
    const row = byId.get(id);
    if (row) {
      prev.set(id, row.legalities);
      curr.set(id, { name: row.card_name, legalities: row.legalities });
      if (now - new Date(row.updated_at).getTime() > SNAPSHOT_TTL_MS) stale.push(id);
    } else {
      stale.push(id); // missing → fetch (silent baseline; no prev)
    }
  }

  if (stale.length > 0) {
    const fetched = await fetchLegalities(stale);
    for (const [id, v] of fetched) {
      curr.set(id, v); // overwrite with fresh
      toUpsert.push({ scryfall_id: id, card_name: v.name, legalities: v.legalities });
    }
  }

  return { prev, curr, toUpsert };
}
