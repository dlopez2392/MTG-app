/**
 * Ingest Scryfall card rulings into Supabase rules_embeddings.
 *
 * Downloads bulk rulings, caches locally, deduplicates, embeds, upserts.
 * Idempotent — safe to re-run.
 *
 * Required env vars: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", ".cache");
const CACHE_FILE = join(CACHE_DIR, "scryfall-rulings.json");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  const BATCH_SIZE = 20;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    if (i > 0) await new Promise((r) => setTimeout(r, 300));
    let retries = 5;
    while (retries > 0) {
      const { error } = await supabase
        .from("rules_embeddings")
        .upsert(batch, { onConflict: "source,source_id" });
      if (!error) break;
      retries--;
      if (retries === 0) {
        console.error(`Upsert error at batch ${i}:`, error.message);
        throw error;
      }
      console.log(`  Retry (${6 - retries}/5) at batch ${i}...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.log(`  Upserted ${rows.length} rows`);
}

async function downloadRulings() {
  // Check cache freshness (<24h)
  if (existsSync(CACHE_FILE)) {
    const age = Date.now() - statSync(CACHE_FILE).mtimeMs;
    if (age < 24 * 60 * 60 * 1000) {
      console.log("Using cached rulings (< 24h old)");
      return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
    }
  }

  console.log("Fetching bulk data index from Scryfall...");
  const bulkRes = await fetch("https://api.scryfall.com/bulk-data");
  if (!bulkRes.ok) throw new Error(`Bulk data fetch failed: ${bulkRes.status}`);
  const bulkData = await bulkRes.json();

  const rulingsEntry = bulkData.data.find((d) => d.type === "rulings");
  if (!rulingsEntry) throw new Error("No rulings entry in Scryfall bulk data");

  console.log(`Downloading rulings from ${rulingsEntry.download_uri}...`);
  const dlRes = await fetch(rulingsEntry.download_uri);
  if (!dlRes.ok) throw new Error(`Rulings download failed: ${dlRes.status}`);
  const rulings = await dlRes.json();

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(rulings));
  console.log(`  Cached ${rulings.length} rulings to ${CACHE_FILE}`);
  return rulings;
}

async function main() {
  const rulings = await downloadRulings();
  console.log(`Total raw rulings: ${rulings.length}`);

  // Deduplicate by oracle_id + comment
  const seen = new Set();
  const unique = [];
  for (const r of rulings) {
    const key = `${r.oracle_id}::${r.comment}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  console.log(`After dedup: ${unique.length} unique rulings`);

  // Resume support: pass START_BATCH env var to skip already-ingested batches
  const PROCESS_BATCH = 500;
  const startBatch = parseInt(process.env.START_BATCH || "0", 10);
  const startOffset = startBatch * PROCESS_BATCH;
  if (startOffset > 0) console.log(`Resuming from batch ${startBatch + 1} (offset ${startOffset})`);
  for (let b = startOffset; b < unique.length; b += PROCESS_BATCH) {
    const batch = unique.slice(b, b + PROCESS_BATCH);
    console.log(`\nProcessing batch ${b / PROCESS_BATCH + 1} (${b}–${b + batch.length})...`);

    const texts = batch.map((r) => r.comment);
    const embeddings = await embedBatch(texts);

    const rowsRaw = batch.map((r, i) => ({
      source: "scryfall_ruling",
      source_id: `${r.oracle_id}::${r.published_at}::${r.comment.slice(0, 50)}`,
      title: `Ruling for ${r.oracle_id}`,
      content: r.comment,
      metadata: JSON.stringify({ oracle_id: r.oracle_id, published_at: r.published_at }),
      embedding: JSON.stringify(embeddings[i]),
    }));

    // Deduplicate within batch by source_id to avoid upsert conflict
    const seenIds = new Set();
    const rows = rowsRaw.filter((r) => {
      if (seenIds.has(r.source_id)) return false;
      seenIds.add(r.source_id);
      return true;
    });

    await upsertRows(rows);
  }

  console.log("\nDone! Scryfall rulings ingested.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
