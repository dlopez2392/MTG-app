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
