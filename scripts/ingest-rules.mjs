/**
 * Ingest MTG Comprehensive Rules + Glossary into Supabase rules_embeddings.
 *
 * Fetches from Academy Ruins API, embeds via OpenAI, upserts into Supabase.
 * Idempotent — safe to re-run.
 *
 * Required env vars: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// ── env checks ──────────────────────────────────────────────────────
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── helpers ─────────────────────────────────────────────────────────
async function embedBatch(texts) {
  const results = [];
  const BATCH_SIZE = 100;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, 200));
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    for (const item of res.data) {
      results.push(item.embedding);
    }
  }
  return results;
}

async function upsertRows(rows) {
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("rules_embeddings")
      .upsert(batch, { onConflict: "source,source_id" });
    if (error) {
      console.error(`Upsert error at batch ${i}:`, error.message);
      throw error;
    }
    console.log(`  Upserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
}

// ── fetch comprehensive rules ───────────────────────────────────────
async function fetchRules() {
  console.log("Fetching comprehensive rules from Academy Ruins...");
  const res = await fetch("https://api.academyruins.com/cr");
  if (!res.ok) throw new Error(`CR fetch failed: ${res.status}`);
  const json = await res.json();

  // Handle both flat array and { data: [...] } wrapper
  let rules;
  if (Array.isArray(json)) {
    rules = json;
  } else if (json.data && Array.isArray(json.data)) {
    rules = json.data;
  } else {
    console.error("Unexpected CR response structure:", Object.keys(json));
    console.error("First 200 chars:", JSON.stringify(json).slice(0, 200));
    throw new Error("Could not parse CR response — see logged structure above");
  }

  console.log(`  Got ${rules.length} rule entries`);
  return rules;
}

// ── fetch glossary ──────────────────────────────────────────────────
async function fetchGlossary() {
  console.log("Fetching glossary from Academy Ruins...");
  const res = await fetch("https://api.academyruins.com/cr/glossary");
  if (!res.ok) throw new Error(`Glossary fetch failed: ${res.status}`);
  const json = await res.json();

  let glossary;
  if (Array.isArray(json)) {
    glossary = json;
  } else if (json.data && Array.isArray(json.data)) {
    glossary = json.data;
  } else {
    console.error("Unexpected glossary response structure:", Object.keys(json));
    console.error("First 200 chars:", JSON.stringify(json).slice(0, 200));
    throw new Error("Could not parse glossary response — see logged structure above");
  }

  console.log(`  Got ${glossary.length} glossary entries`);
  return glossary;
}

// ── main ────────────────────────────────────────────────────────────
async function main() {
  // 1. Fetch rules
  const rules = await fetchRules();
  const ruleChunks = rules
    .filter((r) => r.ruleNumber && r.ruleText)
    .map((r) => ({
      source: "comprehensive_rules",
      source_id: String(r.ruleNumber),
      title: `Rule ${r.ruleNumber}`,
      content: r.ruleText,
      metadata: { ruleNumber: r.ruleNumber },
    }));

  console.log(`Parsed ${ruleChunks.length} rule chunks`);

  // 2. Fetch glossary
  const glossary = await fetchGlossary();
  const glossaryChunks = glossary
    .filter((g) => g.term && g.definition)
    .map((g) => ({
      source: "glossary",
      source_id: g.term,
      title: g.term,
      content: g.definition,
      metadata: { term: g.term },
    }));

  console.log(`Parsed ${glossaryChunks.length} glossary chunks`);

  const allChunks = [...ruleChunks, ...glossaryChunks];
  console.log(`Total chunks to embed: ${allChunks.length}`);

  // 3. Embed
  console.log("Embedding...");
  const texts = allChunks.map((c) => `${c.title}: ${c.content}`);
  const embeddings = await embedBatch(texts);
  console.log(`  Embedded ${embeddings.length} texts`);

  // 4. Build rows and upsert
  const rows = allChunks.map((c, i) => ({
    ...c,
    metadata: JSON.stringify(c.metadata),
    embedding: JSON.stringify(embeddings[i]),
  }));

  console.log("Upserting to Supabase...");
  await upsertRows(rows);
  console.log("Done! Comprehensive rules + glossary ingested.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
