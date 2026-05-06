import { getSupabase } from "@/lib/supabase/server";
import { embedText } from "@/lib/embeddings/client";

export interface RuleChunk {
  source: string;
  sourceId: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Vector similarity search via Supabase RPC `match_rules`.
 */
export async function vectorSearch(
  queries: string[],
  limit = 20,
  threshold = 0.5
): Promise<RuleChunk[]> {
  const supabase = getSupabase();
  const results: RuleChunk[] = [];

  for (const query of queries) {
    const embedding = await embedText(query);
    const { data, error } = await supabase.rpc("match_rules", {
      query_embedding: JSON.stringify(embedding),
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error("vectorSearch RPC error:", error.message);
      continue;
    }

    if (data) {
      for (const row of data) {
        results.push({
          source: row.source,
          sourceId: row.source_id,
          title: row.title,
          content: row.content,
          metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
        });
      }
    }
  }

  return results;
}

/**
 * Direct lookup by rule numbers (e.g. "702.1", "104.3a").
 */
export async function directRuleLookup(ruleNumbers: string[]): Promise<RuleChunk[]> {
  if (ruleNumbers.length === 0) return [];
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("rules_embeddings")
    .select("source, source_id, title, content, metadata")
    .eq("source", "comprehensive_rules")
    .in("source_id", ruleNumbers);

  if (error) {
    console.error("directRuleLookup error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    source: row.source,
    sourceId: row.source_id,
    title: row.title,
    content: row.content,
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
  }));
}

/**
 * Look up Scryfall rulings by oracle_id(s).
 */
export async function cardRulingsLookup(oracleIds: string[]): Promise<RuleChunk[]> {
  if (oracleIds.length === 0) return [];
  const supabase = getSupabase();
  const results: RuleChunk[] = [];

  for (const oracleId of oracleIds) {
    const { data, error } = await supabase
      .from("rules_embeddings")
      .select("source, source_id, title, content, metadata")
      .eq("source", "scryfall_ruling")
      .filter("metadata->>oracle_id", "eq", oracleId);

    if (error) {
      console.error("cardRulingsLookup error:", error.message);
      continue;
    }

    if (data) {
      for (const row of data) {
        results.push({
          source: row.source,
          sourceId: row.source_id,
          title: row.title,
          content: row.content,
          metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
        });
      }
    }
  }

  return results;
}

/**
 * Look up oracle card data by card name (exact match via title).
 * Falls back to ilike for partial matches.
 */
export async function oracleCardLookup(
  cardNames: string[]
): Promise<{ name: string; oracleText: string; oracleId: string; metadata: Record<string, unknown> }[]> {
  if (cardNames.length === 0) return [];
  const supabase = getSupabase();
  const results: { name: string; oracleText: string; oracleId: string; metadata: Record<string, unknown> }[] = [];

  for (const name of cardNames) {
    // Try exact match first
    let { data, error } = await supabase
      .from("rules_embeddings")
      .select("title, content, metadata")
      .eq("source", "oracle_card")
      .ilike("title", name)
      .limit(1);

    if (error) {
      console.error("oracleCardLookup error:", error.message);
      continue;
    }

    if (!data || data.length === 0) {
      // Try fuzzy match
      ({ data, error } = await supabase
        .from("rules_embeddings")
        .select("title, content, metadata")
        .eq("source", "oracle_card")
        .ilike("title", `%${name}%`)
        .limit(1));

      if (error || !data || data.length === 0) continue;
    }

    const row = data[0];
    const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
    results.push({
      name: row.title,
      oracleText: row.content,
      oracleId: meta.oracle_id || "",
      metadata: meta,
    });
  }

  return results;
}

/**
 * Two-hop retrieval: extract key mechanics from each card's oracle text,
 * then build cross-card interaction queries to find rules governing
 * how those mechanics interact with each other.
 */
export function buildInteractionQueries(
  cardOracleTexts: { name: string; oracleText: string }[],
  cardMetadata?: Record<string, unknown>[]
): string[] {
  if (cardOracleTexts.length < 2) return [];

  const KEYWORD_ABILITIES = [
    "deathtouch", "defender", "double strike", "enchant", "equip",
    "first strike", "flash", "flying", "haste", "hexproof",
    "indestructible", "intimidate", "landwalk", "lifelink", "menace",
    "protection", "reach", "shroud", "trample", "vigilance",
    "ward", "wither", "infect", "persist", "undying", "cascade",
    "convoke", "dredge", "flashback", "madness", "prowess",
    "regenerate", "annihilator", "exalted", "phasing",
  ];

  const MECHANIC_PATTERNS = [
    { pattern: /enters? the battlefield/i, label: "enter the battlefield trigger" },
    { pattern: /dies?|is put into .* graveyard from the battlefield/i, label: "dies trigger" },
    { pattern: /can't be (blocked|countered|destroyed|targeted|sacrificed)/i, label: (m: string) => m },
    { pattern: /whenever .* deals? (combat )?damage/i, label: "damage trigger" },
    { pattern: /at the beginning of/i, label: "beginning of phase trigger" },
    { pattern: /sacrifice/i, label: "sacrifice" },
    { pattern: /counter target/i, label: "counter spell" },
    { pattern: /counter on/i, label: "counters" },
    { pattern: /create .* token/i, label: "token creation" },
    { pattern: /can't .* counters?/i, label: "counter prevention" },
    { pattern: /copy/i, label: "copy effect" },
    { pattern: /exile/i, label: "exile" },
    { pattern: /graveyard/i, label: "graveyard interaction" },
    { pattern: /transform|converted|meld/i, label: "transform" },
    { pattern: /additional cost/i, label: "additional cost" },
    { pattern: /replacement effect|instead/i, label: "replacement effect" },
  ];

  // Extract mechanics per card
  const cardMechanics: { name: string; mechanics: string[] }[] = cardOracleTexts.map((card, i) => {
    const mechanics: string[] = [];
    const text = card.oracleText.toLowerCase();

    // Check keyword abilities (from metadata if available, else from oracle text)
    const meta = cardMetadata?.[i];
    const keywords = (meta?.keywords as string[]) ?? [];
    if (keywords.length > 0) {
      mechanics.push(...keywords.map((k) => k.toLowerCase()));
    } else {
      for (const kw of KEYWORD_ABILITIES) {
        if (text.includes(kw)) mechanics.push(kw);
      }
    }

    // Check mechanic patterns
    for (const { pattern, label } of MECHANIC_PATTERNS) {
      const match = card.oracleText.match(pattern);
      if (match) {
        mechanics.push(typeof label === "function" ? label(match[0]) : label);
      }
    }

    return { name: card.name, mechanics: [...new Set(mechanics)] };
  });

  // Build pairwise interaction queries
  const queries: string[] = [];
  for (let i = 0; i < cardMechanics.length; i++) {
    for (let j = i + 1; j < cardMechanics.length; j++) {
      const a = cardMechanics[i];
      const b = cardMechanics[j];

      // Cross each card's mechanics with the other card's
      for (const mechA of a.mechanics.slice(0, 4)) {
        for (const mechB of b.mechanics.slice(0, 4)) {
          if (mechA === mechB) continue;
          queries.push(`${mechA} interaction with ${mechB}`);
        }
      }

      // Also add a general interaction query for the card pair
      queries.push(
        `${a.name} and ${b.name} interaction rules`
      );
    }
  }

  // Cap to avoid excessive embedding calls
  return queries.slice(0, 6);
}

/**
 * Deduplicate by source+sourceId and cap total chunks.
 */
export function deduplicateAndCap(chunks: RuleChunk[], maxChunks = 40): RuleChunk[] {
  const seen = new Set<string>();
  const unique: RuleChunk[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.source}::${chunk.sourceId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(chunk);
    }
  }

  return unique.slice(0, maxChunks);
}
