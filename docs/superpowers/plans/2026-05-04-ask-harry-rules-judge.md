# Ask Harry — AI Rules Judge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the keyword-based `/api/rules-qa` with a two-step retrieval RAG pipeline backed by Supabase pgvector, and build the "Ask Harry" page as a new bottom-nav tab.

**Architecture:** Two-step retrieval — Step 1 (DeepSeek Flash) classifies the question and identifies relevant rule areas; Step 2 retrieves from pgvector + Scryfall; Step 3 (Flash or Pro based on complexity) generates the ruling with citations. Data layer is a `rules_embeddings` table in existing Supabase with HNSW-indexed vector(1536) columns. Ingest scripts fetch from Academy Ruins API and Scryfall bulk data.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase pgvector, DeepSeek (Flash + Pro via OpenAI SDK), OpenAI `text-embedding-3-small` for embeddings, Academy Ruins API, Scryfall bulk rulings.

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/008_rules_embeddings.sql` | pgvector extension + `rules_embeddings` table |
| `src/lib/embeddings/client.ts` | Embedding API client (OpenAI text-embedding-3-small) |
| `src/lib/rules/retrieval.ts` | Vector search, direct rule lookup, card rulings retrieval |
| `src/lib/rules/analyze.ts` | Step 1: classify question via DeepSeek Flash |
| `src/lib/rules/answer.ts` | Step 3: generate ruling via Flash/Pro with context |
| `src/app/api/rules-judge/route.ts` | API route orchestrating the 3-step pipeline |
| `scripts/ingest-rules.mjs` | Fetch CR from Academy Ruins API, embed, upsert |
| `scripts/ingest-rulings.mjs` | Fetch Scryfall bulk rulings, embed, upsert |
| `src/app/ask-harry/page.tsx` | Page wrapper (dynamic import, ssr: false) |
| `src/components/ask-harry/AskHarryClient.tsx` | Full UI: question input, card chips, results display |
| `src/components/ask-harry/CardChipInput.tsx` | Card name autocomplete input with chip display |
| `src/components/ask-harry/RulingResult.tsx` | Ruling display: answer, confidence badge, cited rules, cards |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/deepseek/client.ts` | No changes needed — already uses OpenAI SDK, model is passed per-call |
| `src/components/layout/BottomNav.tsx` | Replace Collection tab with Ask Harry tab |
| `src/app/page.tsx` | Add Collection feature card to FEATURES array |
| `src/components/decks/DecksPageClient.tsx` | Add Collection as third tab |

### Deleted Files
| File | Reason |
|------|--------|
| `src/app/api/rules-qa/route.ts` | Replaced by `/api/rules-judge` |

---

## Task 1: Database Migration — rules_embeddings Table

**Files:**
- Create: `supabase/migrations/008_rules_embeddings.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 008_rules_embeddings.sql
-- Enable pgvector extension and create rules_embeddings table for Ask Harry RAG pipeline

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE rules_embeddings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL,
  source_id text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source, source_id)
);

CREATE INDEX rules_embeddings_embedding_idx ON rules_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX rules_embeddings_source_idx ON rules_embeddings (source);
CREATE INDEX rules_embeddings_source_id_idx ON rules_embeddings (source_id);
```

- [ ] **Step 2: Run the migration in Supabase SQL Editor**

Go to Supabase Dashboard → SQL Editor → paste the migration → Run.
Expected: All statements succeed. Verify by running:
```sql
SELECT count(*) FROM rules_embeddings;
-- Expected: 0 rows
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_rules_embeddings.sql
git commit -m "feat: add rules_embeddings table with pgvector for Ask Harry"
```

---

## Task 2: Embedding Client

**Files:**
- Create: `src/lib/embeddings/client.ts`

- [ ] **Step 1: Create the embedding client**

This uses OpenAI's `text-embedding-3-small` model (1536 dimensions). The existing `openai` package is already installed as a dependency (used by the DeepSeek client).

```typescript
// src/lib/embeddings/client.ts
import OpenAI from "openai";

let client: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY for embeddings");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function embedText(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const openai = getOpenAIClient();
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    allEmbeddings.push(...response.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}
```

- [ ] **Step 2: Add OPENAI_API_KEY to Vercel environment variables**

In Vercel Dashboard → Settings → Environment Variables → Add:
- Key: `OPENAI_API_KEY`
- Value: your OpenAI API key
- Environment: Production, Preview, Development

- [ ] **Step 3: Commit**

```bash
git add src/lib/embeddings/client.ts
git commit -m "feat: add OpenAI embedding client for rules vector search"
```

---

## Task 3: Ingest Script — Comprehensive Rules

**Files:**
- Create: `scripts/ingest-rules.mjs`

- [ ] **Step 1: Write the ingest script**

This script fetches all rules from the Academy Ruins API, embeds them, and upserts into Supabase.

```javascript
// scripts/ingest-rules.mjs
// Usage: OPENAI_API_KEY=xxx NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/ingest-rules.mjs

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embedBatch(texts) {
  const batchSize = 100;
  const all = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    all.push(...res.data.map((d) => d.embedding));
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return all;
}

async function fetchComprehensiveRules() {
  console.log("Fetching rules from Academy Ruins API...");
  const res = await fetch("https://api.academyruins.com/cr");
  if (!res.ok) throw new Error(`Academy Ruins API returned ${res.status}`);
  const data = await res.json();
  return data;
}

function parseRulesIntoChunks(data) {
  const chunks = [];

  // The API returns rules as an array of objects with ruleNumber and ruleText
  // Adapt to actual API response format
  if (Array.isArray(data)) {
    for (const rule of data) {
      const ruleNum = rule.ruleNumber ?? rule.number ?? rule.id;
      const ruleText = rule.ruleText ?? rule.text ?? rule.content;
      if (!ruleNum || !ruleText) continue;
      chunks.push({
        source: "comprehensive_rules",
        source_id: String(ruleNum),
        title: `Rule ${ruleNum}`,
        content: `${ruleNum}: ${ruleText}`,
        metadata: { chapter: String(ruleNum).split(".")[0] },
      });
    }
  } else if (data.data && Array.isArray(data.data)) {
    // Alternative format: { data: [...] }
    return parseRulesIntoChunks(data.data);
  }

  return chunks;
}

async function fetchGlossary() {
  console.log("Fetching glossary from Academy Ruins API...");
  const res = await fetch("https://api.academyruins.com/cr/glossary");
  if (!res.ok) {
    console.warn("Glossary endpoint not available, skipping");
    return [];
  }
  const data = await res.json();
  const chunks = [];

  const entries = Array.isArray(data) ? data : data.data ?? [];
  for (const entry of entries) {
    const term = entry.term ?? entry.name;
    const definition = entry.definition ?? entry.text;
    if (!term || !definition) continue;
    chunks.push({
      source: "glossary",
      source_id: term.toLowerCase().replace(/\s+/g, "_"),
      title: term,
      content: `${term}: ${definition}`,
      metadata: { type: "glossary" },
    });
  }

  return chunks;
}

async function upsertChunks(chunks) {
  console.log(`Embedding ${chunks.length} chunks...`);
  const texts = chunks.map((c) => c.content);
  const embeddings = await embedBatch(texts);

  console.log(`Upserting ${chunks.length} rows into rules_embeddings...`);
  const batchSize = 50;
  let upserted = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((chunk, j) => ({
      source: chunk.source,
      source_id: chunk.source_id,
      title: chunk.title,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i + j]),
      metadata: chunk.metadata,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("rules_embeddings")
      .upsert(batch, { onConflict: "source,source_id" });

    if (error) {
      console.error(`Batch upsert error at offset ${i}:`, error.message);
    } else {
      upserted += batch.length;
    }
  }

  console.log(`Upserted ${upserted}/${chunks.length} chunks`);
}

async function main() {
  try {
    const rulesData = await fetchComprehensiveRules();
    const ruleChunks = parseRulesIntoChunks(rulesData);
    console.log(`Parsed ${ruleChunks.length} rule chunks`);

    const glossaryChunks = await fetchGlossary();
    console.log(`Parsed ${glossaryChunks.length} glossary entries`);

    const allChunks = [...ruleChunks, ...glossaryChunks];
    await upsertChunks(allChunks);

    console.log("Rules ingestion complete!");
  } catch (err) {
    console.error("Ingestion failed:", err);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Test the script locally**

Run with your environment variables:
```bash
OPENAI_API_KEY=xxx NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/ingest-rules.mjs
```

Expected output:
```
Fetching rules from Academy Ruins API...
Parsed ~2500 rule chunks
Fetching glossary from Academy Ruins API...
Parsed ~400 glossary entries
Embedding 2900 chunks...
Upserting 2900 rows into rules_embeddings...
Upserted 2900/2900 chunks
Rules ingestion complete!
```

Verify in Supabase: `SELECT source, count(*) FROM rules_embeddings GROUP BY source;`

**Note:** The Academy Ruins API response format may differ from what's shown. Inspect the actual response and adjust `parseRulesIntoChunks` accordingly. The script handles two common formats (flat array and `{ data: [...] }` wrapper).

- [ ] **Step 3: Commit**

```bash
git add scripts/ingest-rules.mjs
git commit -m "feat: add rules ingestion script (Academy Ruins API + glossary)"
```

---

## Task 4: Ingest Script — Scryfall Rulings

**Files:**
- Create: `scripts/ingest-rulings.mjs`

- [ ] **Step 1: Write the Scryfall rulings ingest script**

```javascript
// scripts/ingest-rulings.mjs
// Usage: OPENAI_API_KEY=xxx NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/ingest-rulings.mjs

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { writeFile, readFile, stat } from "fs/promises";
import { join } from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BULK_CACHE_PATH = join(process.cwd(), ".cache", "scryfall-rulings.json");

async function embedBatch(texts) {
  const batchSize = 100;
  const all = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    all.push(...res.data.map((d) => d.embedding));
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return all;
}

async function fetchBulkRulings() {
  // Check for cached file less than 24h old
  try {
    const s = await stat(BULK_CACHE_PATH);
    const ageMs = Date.now() - s.mtimeMs;
    if (ageMs < 24 * 60 * 60 * 1000) {
      console.log("Using cached rulings file...");
      const raw = await readFile(BULK_CACHE_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // No cache, fetch fresh
  }

  console.log("Fetching bulk data catalog from Scryfall...");
  const catalogRes = await fetch("https://api.scryfall.com/bulk-data");
  const catalog = await catalogRes.json();
  const rulingsEntry = catalog.data.find((d) => d.type === "rulings");
  if (!rulingsEntry) throw new Error("No rulings bulk data found in Scryfall catalog");

  console.log(`Downloading rulings from ${rulingsEntry.download_uri} ...`);
  const res = await fetch(rulingsEntry.download_uri);
  const rulings = await res.json();

  // Cache for reuse
  const { mkdir } = await import("fs/promises");
  await mkdir(join(process.cwd(), ".cache"), { recursive: true });
  await writeFile(BULK_CACHE_PATH, JSON.stringify(rulings));
  console.log(`Cached ${rulings.length} rulings to ${BULK_CACHE_PATH}`);

  return rulings;
}

function deduplicateRulings(rulings) {
  // Group by oracle_id + comment to deduplicate reprints
  const seen = new Map();
  for (const r of rulings) {
    const key = `${r.oracle_id}::${r.comment}`;
    if (!seen.has(key)) {
      seen.set(key, r);
    }
  }
  return Array.from(seen.values());
}

async function main() {
  try {
    const rawRulings = await fetchBulkRulings();
    console.log(`Fetched ${rawRulings.length} total rulings`);

    const unique = deduplicateRulings(rawRulings);
    console.log(`${unique.length} unique rulings after deduplication`);

    // Process in batches to manage memory and API rate limits
    const chunkSize = 500;
    let totalUpserted = 0;

    for (let i = 0; i < unique.length; i += chunkSize) {
      const batch = unique.slice(i, i + chunkSize);
      const chunks = batch.map((r) => ({
        source: "scryfall_ruling",
        source_id: `${r.oracle_id}::${r.published_at}::${r.comment.slice(0, 50)}`,
        title: `Ruling for ${r.oracle_id}`,
        content: r.comment,
        metadata: {
          oracle_id: r.oracle_id,
          source: r.source,
          published_at: r.published_at,
        },
      }));

      const texts = chunks.map((c) => c.content);
      const embeddings = await embedBatch(texts);

      const rows = chunks.map((chunk, j) => ({
        source: chunk.source,
        source_id: chunk.source_id,
        title: chunk.title,
        content: chunk.content,
        embedding: JSON.stringify(embeddings[j]),
        metadata: chunk.metadata,
        updated_at: new Date().toISOString(),
      }));

      const upsertBatchSize = 50;
      for (let j = 0; j < rows.length; j += upsertBatchSize) {
        const upsertBatch = rows.slice(j, j + upsertBatchSize);
        const { error } = await supabase
          .from("rules_embeddings")
          .upsert(upsertBatch, { onConflict: "source,source_id" });
        if (error) {
          console.error(`Upsert error at ${i + j}:`, error.message);
        } else {
          totalUpserted += upsertBatch.length;
        }
      }

      console.log(`Progress: ${Math.min(i + chunkSize, unique.length)}/${unique.length} rulings processed`);
    }

    console.log(`Scryfall rulings ingestion complete! Upserted ${totalUpserted} rows.`);
  } catch (err) {
    console.error("Ingestion failed:", err);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Add `.cache/` to `.gitignore`**

Check if `.cache` is already in `.gitignore`. If not, add it:
```
# Scryfall bulk data cache
.cache/
```

- [ ] **Step 3: Test the script locally**

```bash
OPENAI_API_KEY=xxx NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/ingest-rulings.mjs
```

This will take longer than rules ingestion due to the volume (~100k rulings, deduplicated to ~30-50k unique). Expected runtime: 10-20 minutes depending on API rate limits.

Verify in Supabase:
```sql
SELECT source, count(*) FROM rules_embeddings GROUP BY source;
-- Expected: comprehensive_rules ~2500, glossary ~400, scryfall_ruling ~30000-50000
```

- [ ] **Step 4: Commit**

```bash
git add scripts/ingest-rulings.mjs .gitignore
git commit -m "feat: add Scryfall rulings ingestion script with bulk download caching"
```

---

## Task 5: Retrieval Library — Vector Search and Lookups

**Files:**
- Create: `src/lib/rules/retrieval.ts`

- [ ] **Step 1: Write the retrieval module**

```typescript
// src/lib/rules/retrieval.ts
import { getSupabase } from "@/lib/supabase/server";
import { embedText } from "@/lib/embeddings/client";

export interface RuleChunk {
  source: string;
  sourceId: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

export async function vectorSearch(
  queries: string[],
  limit: number = 20,
  threshold: number = 0.3
): Promise<RuleChunk[]> {
  const supabase = getSupabase();
  const results: RuleChunk[] = [];
  const seenIds = new Set<string>();

  for (const query of queries) {
    const embedding = await embedText(query);

    const { data, error } = await supabase.rpc("match_rules", {
      query_embedding: JSON.stringify(embedding),
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error("Vector search error:", error.message);
      continue;
    }

    for (const row of data ?? []) {
      const key = `${row.source}::${row.source_id}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        results.push({
          source: row.source,
          sourceId: row.source_id,
          title: row.title,
          content: row.content,
          metadata: row.metadata,
        });
      }
    }
  }

  return results;
}

export async function directRuleLookup(ruleNumbers: string[]): Promise<RuleChunk[]> {
  if (ruleNumbers.length === 0) return [];
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("rules_embeddings")
    .select("source, source_id, title, content, metadata")
    .eq("source", "comprehensive_rules")
    .in("source_id", ruleNumbers);

  if (error) {
    console.error("Direct rule lookup error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    source: row.source,
    sourceId: row.source_id,
    title: row.title,
    content: row.content,
    metadata: row.metadata,
  }));
}

export async function cardRulingsLookup(oracleIds: string[]): Promise<RuleChunk[]> {
  if (oracleIds.length === 0) return [];
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("rules_embeddings")
    .select("source, source_id, title, content, metadata")
    .eq("source", "scryfall_ruling")
    .in("metadata->>oracle_id", oracleIds);

  if (error) {
    console.error("Card rulings lookup error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    source: row.source,
    sourceId: row.source_id,
    title: row.title,
    content: row.content,
    metadata: row.metadata,
  }));
}

export function deduplicateAndCap(chunks: RuleChunk[], maxChunks: number = 40): RuleChunk[] {
  const seen = new Set<string>();
  const unique: RuleChunk[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.source}::${chunk.sourceId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(chunk);
    }
    if (unique.length >= maxChunks) break;
  }

  return unique;
}
```

- [ ] **Step 2: Create the Supabase RPC function for vector similarity search**

Add this to the migration or run directly in the SQL Editor:

```sql
-- Add to 008_rules_embeddings.sql or run separately
CREATE OR REPLACE FUNCTION match_rules(
  query_embedding text,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  source text,
  source_id text,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.source,
    r.source_id,
    r.title,
    r.content,
    r.metadata,
    1 - (r.embedding <=> query_embedding::vector) AS similarity
  FROM rules_embeddings r
  WHERE 1 - (r.embedding <=> query_embedding::vector) > match_threshold
  ORDER BY r.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;
```

Run this in Supabase SQL Editor.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rules/retrieval.ts
git commit -m "feat: add vector search, direct lookup, and card rulings retrieval"
```

---

## Task 6: Step 1 — Analyze Question

**Files:**
- Create: `src/lib/rules/analyze.ts`

- [ ] **Step 1: Write the analyze module**

```typescript
// src/lib/rules/analyze.ts
import { getDeepSeek } from "@/lib/deepseek/client";

export interface AnalysisResult {
  ruleAreas: string[];
  specificRules: string[];
  complexity: "simple" | "complex";
  cardsReferenced: string[];
}

const ANALYZE_SYSTEM_PROMPT = `You are a Magic: The Gathering rules classification assistant. Given a rules question and optional card oracle text, identify:

1. rule_areas: which areas of the Comprehensive Rules are relevant (e.g., "triggered abilities", "replacement effects", "layer system", "combat damage", "state-based actions", "casting spells", "mana abilities")
2. specific_rules: any specific rule numbers you know are relevant (e.g., "614.1", "603.2"). Only include rules you are confident about.
3. complexity: "simple" if the question involves one rule area or a straightforward interaction. "complex" if it involves multiple rule areas, layering, replacement effects modifying other effects, or unusual corner cases.
4. cards_referenced: any Magic card names mentioned in the question that were not provided as explicit card inputs.

Respond with JSON only:
{
  "rule_areas": ["string"],
  "specific_rules": ["string"],
  "complexity": "simple" | "complex",
  "cards_referenced": ["string"]
}`;

export async function analyzeQuestion(
  question: string,
  cardOracleTexts: { name: string; oracleText: string }[]
): Promise<AnalysisResult> {
  const deepseek = getDeepSeek();

  const cardContext = cardOracleTexts.length > 0
    ? `\n\nCards provided:\n${cardOracleTexts.map((c) => `- ${c.name}: ${c.oracleText}`).join("\n")}`
    : "";

  const result = await deepseek.chat.completions.create({
    model: "deepseek-v4-flash",
    messages: [
      { role: "system", content: ANALYZE_SYSTEM_PROMPT },
      { role: "user", content: `Question: ${question}${cardContext}` },
    ],
    temperature: 0.1,
    max_tokens: 512,
    response_format: { type: "json_object" },
  });

  const text = result.choices[0]?.message?.content ?? "{}";
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    ruleAreas: parsed.rule_areas ?? [],
    specificRules: parsed.specific_rules ?? [],
    complexity: parsed.complexity === "complex" ? "complex" : "simple",
    cardsReferenced: parsed.cards_referenced ?? [],
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/rules/analyze.ts
git commit -m "feat: add Step 1 question analysis via DeepSeek Flash"
```

---

## Task 7: Step 3 — Generate Ruling

**Files:**
- Create: `src/lib/rules/answer.ts`

- [ ] **Step 1: Write the answer module**

```typescript
// src/lib/rules/answer.ts
import { getDeepSeek } from "@/lib/deepseek/client";
import type { RuleChunk } from "@/lib/rules/retrieval";

export interface RulingResponse {
  ruling: string;
  confidence: "high" | "medium" | "low";
  citedRules: { number: string; text: string }[];
  cardsAnalyzed: { name: string; oracleText: string }[];
  model: "flash" | "pro";
}

const HARRY_SYSTEM_PROMPT = `You are Harry, an expert Magic: The Gathering rules judge built into the MTG Houdini app. Answer rules questions accurately and concisely.

INSTRUCTIONS:
- Answer using ONLY the provided rules and card text. Do not hallucinate rules.
- Cite specific Comprehensive Rules numbers (e.g., "Rule 702.2a") for every claim.
- Explain in plain language first, then support with rule citations.
- If the answer involves multiple rules interacting, explain the interaction step by step.
- If the provided rules don't cover the scenario, say so clearly and suggest what rule area might apply.
- For tournament-level questions, note when a head judge ruling may apply.
- Set confidence to "high" if the rules clearly answer it, "medium" if there's interpretation involved, "low" if the rules don't directly address it.

RESPONSE FORMAT (JSON):
{
  "ruling": "Clear plain-language answer (under 400 words)",
  "confidence": "high" | "medium" | "low",
  "cited_rules": [
    { "number": "702.2a", "text": "Relevant rule text excerpt" }
  ],
  "cards_analyzed": [
    { "name": "Card Name", "oracleText": "Oracle text used" }
  ]
}`;

export async function generateRuling(
  question: string,
  ruleChunks: RuleChunk[],
  cardOracleTexts: { name: string; oracleText: string }[],
  complexity: "simple" | "complex"
): Promise<RulingResponse> {
  const deepseek = getDeepSeek();
  const model = complexity === "complex" ? "deepseek-v4-pro" : "deepseek-v4-flash";
  const maxTokens = complexity === "complex" ? 8192 : 4096;

  const rulesContext = ruleChunks.map((r) => r.content).join("\n\n");
  const cardContext = cardOracleTexts.length > 0
    ? `\n\nCARD ORACLE TEXT:\n${cardOracleTexts.map((c) => `${c.name}: ${c.oracleText}`).join("\n\n")}`
    : "";

  const userPrompt = `RELEVANT RULES:
${rulesContext}
${cardContext}

QUESTION: ${question}`;

  const result = await deepseek.chat.completions.create({
    model,
    messages: [
      { role: "system", content: HARRY_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });

  const text = result.choices[0]?.message?.content ?? "{}";
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return {
    ruling: parsed.ruling ?? "Unable to generate a ruling.",
    confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
    citedRules: (parsed.cited_rules ?? []).map((r: { number: string; text: string }) => ({
      number: r.number,
      text: r.text,
    })),
    cardsAnalyzed: cardOracleTexts,
    model: complexity === "complex" ? "pro" : "flash",
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/rules/answer.ts
git commit -m "feat: add Step 3 ruling generation with Flash/Pro routing"
```

---

## Task 8: API Route — `/api/rules-judge`

**Files:**
- Create: `src/app/api/rules-judge/route.ts`
- Delete: `src/app/api/rules-qa/route.ts`

- [ ] **Step 1: Write the API route**

```typescript
// src/app/api/rules-judge/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { analyzeQuestion } from "@/lib/rules/analyze";
import {
  vectorSearch,
  directRuleLookup,
  cardRulingsLookup,
  deduplicateAndCap,
} from "@/lib/rules/retrieval";
import { generateRuling } from "@/lib/rules/answer";

interface RulesJudgeRequest {
  question: string;
  cards?: string[];
  gameContext?: {
    format?: string;
    playerCount?: number;
    counters?: Record<string, unknown>;
  };
}

async function fetchCardOracleText(
  cardName: string
): Promise<{ name: string; oracleText: string; oracleId: string } | null> {
  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const card = await res.json();
    const oracleText =
      card.oracle_text ??
      card.card_faces?.map((f: { oracle_text?: string }) => f.oracle_text).join("\n\n") ??
      "";
    return {
      name: card.name,
      oracleText,
      oracleId: card.oracle_id,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit(`ai:${userId}`, 10, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429 }
    );
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "AI rules judge is not configured." },
      { status: 503 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Embedding service is not configured." },
      { status: 503 }
    );
  }

  const body: RulesJudgeRequest = await req.json();

  if (!body.question || body.question.trim().length < 3) {
    return NextResponse.json(
      { error: "Please ask a complete question." },
      { status: 400 }
    );
  }

  if (body.question.length > 2000) {
    return NextResponse.json({ error: "Question too long." }, { status: 400 });
  }

  if (body.cards && body.cards.length > 5) {
    return NextResponse.json(
      { error: "Maximum 5 cards per question." },
      { status: 400 }
    );
  }

  try {
    // Fetch oracle text for provided card names
    const cardResults = await Promise.all(
      (body.cards ?? []).map((name) => fetchCardOracleText(name))
    );
    const cardOracleTexts = cardResults.filter(
      (c): c is NonNullable<typeof c> => c !== null
    );

    // Step 1: Analyze question
    const analysis = await analyzeQuestion(
      body.question,
      cardOracleTexts.map((c) => ({ name: c.name, oracleText: c.oracleText }))
    );

    // Fetch oracle text for any additional cards referenced in free text
    const additionalCards = analysis.cardsReferenced.filter(
      (name) =>
        !cardOracleTexts.some(
          (c) => c.name.toLowerCase() === name.toLowerCase()
        )
    );
    const additionalResults = await Promise.all(
      additionalCards.map((name) => fetchCardOracleText(name))
    );
    const allCards = [
      ...cardOracleTexts,
      ...additionalResults.filter(
        (c): c is NonNullable<typeof c> => c !== null
      ),
    ];

    // Step 2: Parallel retrieval
    const [vectorResults, directResults, cardRulings] = await Promise.all([
      vectorSearch(analysis.ruleAreas, 20, 0.3),
      directRuleLookup(analysis.specificRules),
      cardRulingsLookup(allCards.map((c) => c.oracleId)),
    ]);

    // Combine and deduplicate: direct lookups first (highest confidence), then vector, then card rulings
    const allChunks = deduplicateAndCap(
      [...directResults, ...vectorResults, ...cardRulings],
      40
    );

    // Step 3: Generate ruling
    const ruling = await generateRuling(
      body.question,
      allChunks,
      allCards.map((c) => ({ name: c.name, oracleText: c.oracleText })),
      analysis.complexity
    );

    return NextResponse.json(ruling);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Rules analysis failed";
    console.error("Rules judge error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Delete the old rules-qa route**

Delete the file `src/app/api/rules-qa/route.ts`.

- [ ] **Step 3: Test the endpoint with curl**

Start the dev server (`npm run dev`) and test:

```bash
curl -X POST http://localhost:3001/api/rules-judge \
  -H "Content-Type: application/json" \
  -d '{"question": "Does trample work with deathtouch?", "cards": ["Questing Beast"]}'
```

Expected: JSON response with `ruling`, `confidence`, `citedRules`, `cardsAnalyzed`, `model` fields. This requires being authenticated (use the app UI for real testing since Clerk auth is needed).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/rules-judge/route.ts
git rm src/app/api/rules-qa/route.ts
git commit -m "feat: add /api/rules-judge with two-step RAG pipeline, remove old rules-qa"
```

---

## Task 9: Bottom Nav — Replace Collection with Ask Harry

**Files:**
- Modify: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Update the rightTabs array**

In `src/components/layout/BottomNav.tsx`, replace the Collection tab entry in `rightTabs` with Ask Harry:

Replace this entry:
```typescript
  {
    href: "/collection",
    label: "Collection",
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
```

With:
```typescript
  {
    href: "/ask-harry",
    label: "Ask Harry",
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev`, open the app. Bottom nav should show: Home | Decks | Ask Harry | Life | More. The Ask Harry tab should link to `/ask-harry` (which will 404 until we build the page).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/BottomNav.tsx
git commit -m "feat: replace Collection tab with Ask Harry in bottom nav"
```

---

## Task 10: Relocate Collection — Home Page Feature Card

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add Collection to the FEATURES array**

In `src/app/page.tsx`, add a new entry to the `FEATURES` array (after the existing entries):

```typescript
  {
    href: "/collection",
    title: "COLLECTION",
    description: "Track & organize your card collection",
    accent: "#06B6D4",
    art: "https://cards.scryfall.io/art_crop/front/5/e/5eb68bff-9op3-4654-a91b-21ed3ce94378.jpg",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
```

**Note:** The `art` URL above is a placeholder. Use a valid Scryfall art crop URL — pick a treasure/collection themed card like Treasure Vault or Jeweled Lotus. If the URL 404s, the card will still render without the art background.

- [ ] **Step 2: Verify in browser**

Home page should now show the Collection card among the other feature cards.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add Collection feature card to home page"
```

---

## Task 11: Relocate Collection — Decks Page Tab

**Files:**
- Modify: `src/components/decks/DecksPageClient.tsx`

- [ ] **Step 1: Add imports and state for Collection tab**

At the top of `DecksPageClient.tsx`, add the dynamic import for the Collection component. Find the existing collection page client:

```bash
# Find the collection client component
grep -r "CollectionClient\|CollectionPage\|BinderList" src/components/collection/ --files-with-matches
```

Add the import at the top of the file (after the existing imports):
```typescript
import dynamic from "next/dynamic";

const CollectionContent = dynamic(
  () => import("@/components/collection/CollectionPageClient"),
  { ssr: false, loading: () => <div className="p-4 text-text-muted">Loading collection...</div> }
);
```

If the collection component is named differently, adjust the import path accordingly.

- [ ] **Step 2: Update the tab type and Tabs component**

Change the tab state type from:
```typescript
const [tab, setTab] = useState<"decks" | "explore">("decks");
```
To:
```typescript
const [tab, setTab] = useState<"decks" | "explore" | "collection">("decks");
```

Update the Tabs component to add the third tab:
```typescript
<Tabs
  tabs={[
    { value: "decks", label: "Decks" },
    { value: "explore", label: "Explore" },
    { value: "collection", label: "Collection" },
  ]}
  active={tab}
  onChange={(v) => setTab(v as "decks" | "explore" | "collection")}
  className="mb-4"
/>
```

- [ ] **Step 3: Add the Collection tab content**

In the conditional rendering section (after the `tab === "decks"` and `ExploreDecks` blocks), add:

```typescript
) : tab === "collection" ? (
  <CollectionContent />
) : (
```

The full pattern becomes:
```typescript
{tab === "decks" ? (
  <>{/* existing deck content */}</>
) : tab === "collection" ? (
  <CollectionContent />
) : (
  <ExploreDecks />
)}
```

Also update the FAB visibility check to hide it on collection tab:
```typescript
{tab === "decks" && (
```
This line already exists and should remain unchanged (FAB only shows on decks tab).

- [ ] **Step 4: Verify in browser**

Decks page should now have three tabs: Decks | Explore | Collection. Clicking Collection should render the collection component inline.

- [ ] **Step 5: Commit**

```bash
git add src/components/decks/DecksPageClient.tsx
git commit -m "feat: add Collection as third tab on Decks page"
```

---

## Task 12: Card Chip Input Component

**Files:**
- Create: `src/components/ask-harry/CardChipInput.tsx`

- [ ] **Step 1: Write the card chip input component**

This reuses the existing `useAutocomplete` hook for Scryfall card search.

```typescript
// src/components/ask-harry/CardChipInput.tsx
"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { useAutocomplete } from "@/hooks/useAutocomplete";

interface CardChipInputProps {
  cards: string[];
  onAdd: (cardName: string) => void;
  onRemove: (index: number) => void;
  maxCards?: number;
}

export default function CardChipInput({
  cards,
  onAdd,
  onRemove,
  maxCards = 5,
}: CardChipInputProps) {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { suggestions, loading } = useAutocomplete(query);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(name: string) {
    if (cards.length >= maxCards) return;
    if (cards.some((c) => c.toLowerCase() === name.toLowerCase())) return;
    onAdd(name);
    setQuery("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-text-muted uppercase tracking-widest">
        Cards (optional)
      </label>

      {/* Chips */}
      {cards.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cards.map((card, i) => (
            <span
              key={`${card}-${i}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 border border-accent/30 text-accent text-sm font-medium"
            >
              {card}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="ml-0.5 text-accent/60 hover:text-accent"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      {cards.length < maxCards && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Type a card name..."
            className="w-full input-base px-3 py-2 text-sm"
          />

          {/* Suggestions dropdown */}
          {showSuggestions && query.length >= 2 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
              {loading && (
                <div className="px-3 py-2 text-sm text-text-muted">Searching...</div>
              )}
              {!loading && suggestions.length === 0 && query.length >= 2 && (
                <div className="px-3 py-2 text-sm text-text-muted">No cards found</div>
              )}
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(s.name)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-bg-hover transition-colors flex items-center gap-2"
                >
                  {s.imageUri && (
                    <img
                      src={s.imageUri}
                      alt=""
                      className="w-6 h-8 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <span className="text-text-primary">{s.name}</span>
                  {s.typeLine && (
                    <span className="text-text-muted text-xs ml-auto truncate max-w-[120px]">
                      {s.typeLine}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {cards.length >= maxCards && (
        <p className="text-xs text-text-muted">Maximum {maxCards} cards reached</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ask-harry/CardChipInput.tsx
git commit -m "feat: add CardChipInput with Scryfall autocomplete for Ask Harry"
```

---

## Task 13: Ruling Result Component

**Files:**
- Create: `src/components/ask-harry/RulingResult.tsx`

- [ ] **Step 1: Write the ruling result display component**

```typescript
// src/components/ask-harry/RulingResult.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface RulingResultProps {
  ruling: string;
  confidence: "high" | "medium" | "low";
  citedRules: { number: string; text: string }[];
  cardsAnalyzed: { name: string; oracleText: string }[];
  model: "flash" | "pro";
}

const CONFIDENCE_CONFIG = {
  high: { label: "High Confidence", color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/30" },
  medium: { label: "Medium Confidence", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30" },
  low: { label: "Low Confidence", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/30" },
};

export default function RulingResult({
  ruling,
  confidence,
  citedRules,
  cardsAnalyzed,
  model,
}: RulingResultProps) {
  const [showRules, setShowRules] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const conf = CONFIDENCE_CONFIG[confidence];

  function handleFeedback(value: "up" | "down") {
    setFeedback(value);
    try {
      const stored = JSON.parse(localStorage.getItem("harry-feedback") ?? "[]");
      stored.push({ value, timestamp: Date.now() });
      localStorage.setItem("harry-feedback", JSON.stringify(stored.slice(-100)));
    } catch { /* localStorage unavailable */ }
  }

  return (
    <div className="glass-card rounded-2xl border border-border p-4 space-y-3">
      {/* Header with confidence badge and model */}
      <div className="flex items-center justify-between">
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold", conf.bg, conf.border, conf.color, "border")}>
          <span className={cn("w-1.5 h-1.5 rounded-full", confidence === "high" ? "bg-green-400" : confidence === "medium" ? "bg-yellow-400" : "bg-red-400")} />
          {conf.label}
        </span>
        <span className="text-[10px] text-text-muted uppercase tracking-wider">
          {model === "pro" ? "DeepSeek Pro" : "DeepSeek Flash"}
        </span>
      </div>

      {/* Ruling text */}
      <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
        {ruling}
      </div>

      {/* Cited Rules (expandable) */}
      {citedRules.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowRules(!showRules)}
            className="flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent/80 transition-colors"
          >
            <svg className={cn("w-3.5 h-3.5 transition-transform", showRules && "rotate-90")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            Cited Rules ({citedRules.length})
          </button>
          {showRules && (
            <div className="mt-2 space-y-1.5 pl-5">
              {citedRules.map((rule, i) => (
                <div key={`${rule.number}-${i}`} className="text-xs">
                  <span className="font-bold text-accent">{rule.number}</span>
                  <span className="text-text-secondary ml-1.5">{rule.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cards Analyzed (expandable) */}
      {cardsAnalyzed.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowCards(!showCards)}
            className="flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent/80 transition-colors"
          >
            <svg className={cn("w-3.5 h-3.5 transition-transform", showCards && "rotate-90")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            Cards Analyzed ({cardsAnalyzed.length})
          </button>
          {showCards && (
            <div className="mt-2 space-y-1.5 pl-5">
              {cardsAnalyzed.map((card, i) => (
                <div key={`${card.name}-${i}`} className="text-xs">
                  <span className="font-bold text-text-primary">{card.name}</span>
                  <p className="text-text-muted mt-0.5 italic">{card.oracleText}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feedback */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Was this helpful?</span>
        <button
          type="button"
          onClick={() => handleFeedback("up")}
          className={cn("p-1.5 rounded-lg transition-colors", feedback === "up" ? "bg-green-400/20 text-green-400" : "text-text-muted hover:text-green-400 hover:bg-green-400/10")}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48a4.53 4.53 0 01-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleFeedback("down")}
          className={cn("p-1.5 rounded-lg transition-colors", feedback === "down" ? "bg-red-400/20 text-red-400" : "text-text-muted hover:text-red-400 hover:bg-red-400/10")}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-1.302 4.666c-.245.403.028.959.5.959h1.053c.832 0 1.612-.453 1.918-1.227C20.705 12.036 21 10.553 21 9c0-1.22-.182-2.398-.521-3.507-.26-.85-1.084-1.368-1.973-1.368H17.48c-.472 0-.745.556-.5.96a8.95 8.95 0 011.302 4.665c0 .196-.005.39-.016.583M7.5 15l-3.114 1.04a4.501 4.501 0 00-1.423.23H1.39c-.618 0-1.217-.247-1.605-.729A11.95 11.95 0 01-2.864 9c0-.434.023-.863.068-1.285C-2.687 6.694-1.768 6 -.742 6h3.126c.618 0 .991.724.725 1.282A7.471 7.471 0 002.25 10.5M7.5 15v5.25a.75.75 0 001.5 0v-3.128c0-.348.09-.694.27-.997l.927-1.554a1.875 1.875 0 00-1.607-2.821H7.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ask-harry/RulingResult.tsx
git commit -m "feat: add RulingResult display component with expandable sections"
```

---

## Task 14: Ask Harry Page — Client Component

**Files:**
- Create: `src/components/ask-harry/AskHarryClient.tsx`

- [ ] **Step 1: Write the main Ask Harry client component**

```typescript
// src/components/ask-harry/AskHarryClient.tsx
"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import HeroBanner from "@/components/layout/HeroBanner";
import PageContainer from "@/components/layout/PageContainer";
import CardChipInput from "@/components/ask-harry/CardChipInput";
import RulingResult from "@/components/ask-harry/RulingResult";

interface RulingData {
  ruling: string;
  confidence: "high" | "medium" | "low";
  citedRules: { number: string; text: string }[];
  cardsAnalyzed: { name: string; oracleText: string }[];
  model: "flash" | "pro";
}

interface RecentQuestion {
  question: string;
  cards: string[];
  timestamp: number;
}

const HARRY_ICON = (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

function getRecentQuestions(): RecentQuestion[] {
  try {
    return JSON.parse(localStorage.getItem("harry-recent") ?? "[]");
  } catch {
    return [];
  }
}

function saveRecentQuestion(question: string, cards: string[]) {
  try {
    const recent = getRecentQuestions();
    const entry = { question, cards, timestamp: Date.now() };
    const updated = [entry, ...recent.filter((r) => r.question !== question)].slice(0, 5);
    localStorage.setItem("harry-recent", JSON.stringify(updated));
  } catch { /* localStorage unavailable */ }
}

export default function AskHarryClient() {
  const { isSignedIn } = useUser();
  const [question, setQuestion] = useState("");
  const [cards, setCards] = useState<string[]>([]);
  const [result, setResult] = useState<RulingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentQuestions] = useState<RecentQuestion[]>(() => getRecentQuestions());

  async function handleSubmit() {
    if (!question.trim() || question.trim().length < 3) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/rules-judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          cards: cards.length > 0 ? cards : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      const data: RulingData = await res.json();
      setResult(data);
      saveRecentQuestion(question.trim(), cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function loadRecent(recent: RecentQuestion) {
    setQuestion(recent.question);
    setCards(recent.cards);
    setResult(null);
    setError(null);
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <HeroBanner
        title="Ask Harry"
        subtitle="Your AI rules judge — ask anything about MTG rules and card interactions"
        accent="#7C5CFC"
        icon={HARRY_ICON}
      />

      <PageContainer>
        <div className="space-y-4">
          {/* Question input */}
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
              Your Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Does Panharmonicon double Solitude's ETB if I evoke it?"
              maxLength={2000}
              rows={3}
              className="w-full input-base px-3 py-2 text-sm resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] text-text-muted tabular-nums">{question.length}/2000</span>
            </div>
          </div>

          {/* Card chip input */}
          <CardChipInput
            cards={cards}
            onAdd={(name) => setCards((prev) => [...prev, name])}
            onRemove={(i) => setCards((prev) => prev.filter((_, j) => j !== i))}
          />

          {/* Submit button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !question.trim() || question.trim().length < 3 || !isSignedIn}
            className="w-full py-3 rounded-xl btn-gradient text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Harry is thinking...
              </>
            ) : (
              "Ask Harry"
            )}
          </button>

          {!isSignedIn && (
            <p className="text-xs text-text-muted text-center">Sign in to use the AI rules judge</p>
          )}

          {/* Error display */}
          {error && (
            <div className="glass-card rounded-xl border border-banned/30 bg-banned/5 p-3">
              <p className="text-sm text-banned">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <RulingResult
              ruling={result.ruling}
              confidence={result.confidence}
              citedRules={result.citedRules}
              cardsAnalyzed={result.cardsAnalyzed}
              model={result.model}
            />
          )}

          {/* Recent questions */}
          {!result && recentQuestions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Recent Questions</p>
              <div className="space-y-1.5">
                {recentQuestions.map((rq, i) => (
                  <button
                    key={`${rq.timestamp}-${i}`}
                    type="button"
                    onClick={() => loadRecent(rq)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-bg-card border border-border hover:border-accent/30 transition-colors"
                  >
                    <p className="text-sm text-text-primary truncate">{rq.question}</p>
                    {rq.cards.length > 0 && (
                      <p className="text-[10px] text-text-muted mt-0.5">{rq.cards.join(", ")}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ask-harry/AskHarryClient.tsx
git commit -m "feat: add Ask Harry main client component with question input and results"
```

---

## Task 15: Ask Harry Page Route

**Files:**
- Create: `src/app/ask-harry/page.tsx`

- [ ] **Step 1: Write the page wrapper**

```typescript
// src/app/ask-harry/page.tsx
"use client";

import dynamic from "next/dynamic";

const AskHarryClient = dynamic(
  () => import("@/components/ask-harry/AskHarryClient"),
  { ssr: false }
);

export default function AskHarryPage() {
  return <AskHarryClient />;
}
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev`, navigate to the Ask Harry tab in the bottom nav. The page should render with:
- Header "Ask Harry" with tagline
- Question textarea
- Card chip input with Scryfall autocomplete
- "Ask Harry" submit button
- Recent questions section (empty initially)

Test an actual question (requires sign-in + both API keys configured + rules_embeddings populated).

- [ ] **Step 3: Commit**

```bash
git add src/app/ask-harry/page.tsx
git commit -m "feat: add Ask Harry page route"
```

---

## Task 16: TypeScript Verification and Final Cleanup

**Files:**
- All new and modified files

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors. Common issues to watch for:
- The `match_rules` RPC may need a type definition in Supabase types
- Import paths for collection component in DecksPageClient (adjust if named differently)
- The `next` option in fetch may need a type assertion

- [ ] **Step 2: Verify all pages load without errors**

Run `npm run dev` and check:
1. Home page — Collection feature card visible and links to `/collection`
2. Decks page — three tabs (Decks, Explore, Collection) all render
3. Ask Harry page — form renders, submit works (if data is ingested)
4. Bottom nav — Ask Harry tab active, no Collection tab
5. Life counter — unchanged, still works

- [ ] **Step 3: Update architecture docs**

In `docs/architecture.md`, add the Ask Harry feature to the features table and note the new API route, dependencies (OPENAI_API_KEY), and the `rules_embeddings` table.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Ask Harry AI rules judge — v1 complete"
```

- [ ] **Step 5: Push to main**

```bash
git push origin main
```
