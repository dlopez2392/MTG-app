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
