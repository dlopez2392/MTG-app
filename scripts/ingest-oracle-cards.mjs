/**
 * Ingest Scryfall oracle card data into Supabase rules_embeddings.
 *
 * Downloads bulk oracle_cards, caches locally, embeds oracle text, upserts.
 * Idempotent — safe to re-run. Supports resume via START_BATCH env var.
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
const CACHE_FILE = join(CACHE_DIR, "scryfall-oracle-cards.json");

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
  const BATCH_SIZE = 10;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    if (i > 0) await new Promise((r) => setTimeout(r, 500));
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

function formatCardContent(card) {
  const lines = [`Card Name: ${card.name}`];
  lines.push(`Type: ${card.type_line || "Unknown"}`);
  if (card.mana_cost) lines.push(`Mana Cost: ${card.mana_cost}`);

  if (card.card_faces && card.card_faces.length > 1) {
    for (const face of card.card_faces) {
      lines.push(`\n--- ${face.name} ---`);
      if (face.type_line) lines.push(`Type: ${face.type_line}`);
      if (face.mana_cost) lines.push(`Mana Cost: ${face.mana_cost}`);
      if (face.oracle_text) lines.push(`Oracle Text: ${face.oracle_text}`);
      if (face.power != null && face.toughness != null)
        lines.push(`P/T: ${face.power}/${face.toughness}`);
      if (face.loyalty) lines.push(`Loyalty: ${face.loyalty}`);
    }
  } else {
    if (card.oracle_text) lines.push(`Oracle Text: ${card.oracle_text}`);
    if (card.power != null && card.toughness != null)
      lines.push(`P/T: ${card.power}/${card.toughness}`);
    if (card.loyalty) lines.push(`Loyalty: ${card.loyalty}`);
  }

  if (card.keywords && card.keywords.length > 0)
    lines.push(`Keywords: ${card.keywords.join(", ")}`);

  if (card.legalities) {
    const formats = ["standard", "pioneer", "modern", "legacy", "vintage", "commander", "pauper"];
    const legalStr = formats
      .map((f) => `${f}: ${card.legalities[f] || "unknown"}`)
      .join(", ");
    lines.push(`Format Legality: ${legalStr}`);
  }

  return lines.join("\n");
}

function formatEmbedText(card) {
  const parts = [card.name];
  if (card.type_line) parts.push(card.type_line);

  if (card.card_faces && card.card_faces.length > 1) {
    for (const face of card.card_faces) {
      if (face.oracle_text) parts.push(face.oracle_text);
    }
  } else if (card.oracle_text) {
    parts.push(card.oracle_text);
  }

  if (card.keywords && card.keywords.length > 0)
    parts.push(`Keywords: ${card.keywords.join(", ")}`);

  return parts.join("\n");
}

async function downloadOracleCards() {
  if (existsSync(CACHE_FILE)) {
    const age = Date.now() - statSync(CACHE_FILE).mtimeMs;
    if (age < 24 * 60 * 60 * 1000) {
      console.log("Using cached oracle cards (< 24h old)");
      return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
    }
  }

  console.log("Fetching bulk data index from Scryfall...");
  const bulkRes = await fetch("https://api.scryfall.com/bulk-data");
  if (!bulkRes.ok) throw new Error(`Bulk data fetch failed: ${bulkRes.status}`);
  const bulkData = await bulkRes.json();

  const oracleEntry = bulkData.data.find((d) => d.type === "oracle_cards");
  if (!oracleEntry) throw new Error("No oracle_cards entry in Scryfall bulk data");

  console.log(`Downloading oracle cards from ${oracleEntry.download_uri}...`);
  const dlRes = await fetch(oracleEntry.download_uri);
  if (!dlRes.ok) throw new Error(`Oracle cards download failed: ${dlRes.status}`);
  const cards = await dlRes.json();

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cards));
  console.log(`  Cached ${cards.length} oracle cards to ${CACHE_FILE}`);
  return cards;
}

async function main() {
  const cards = await downloadOracleCards();
  console.log(`Total oracle cards: ${cards.length}`);

  // Filter to cards with oracle text (skip tokens without text, art cards, etc.)
  const validCards = cards.filter((c) => {
    const hasOracleText = c.oracle_text ||
      (c.card_faces && c.card_faces.some((f) => f.oracle_text));
    return hasOracleText && c.oracle_id;
  });
  console.log(`Cards with oracle text: ${validCards.length}`);

  const PROCESS_BATCH = 500;
  const startBatch = parseInt(process.env.START_BATCH || "0", 10);
  const startOffset = startBatch * PROCESS_BATCH;
  if (startOffset > 0) console.log(`Resuming from batch ${startBatch + 1} (offset ${startOffset})`);

  for (let b = startOffset; b < validCards.length; b += PROCESS_BATCH) {
    const batch = validCards.slice(b, b + PROCESS_BATCH);
    const batchNum = Math.floor(b / PROCESS_BATCH) + 1;
    const totalBatches = Math.ceil(validCards.length / PROCESS_BATCH);
    console.log(`\nProcessing batch ${batchNum}/${totalBatches} (${b}–${b + batch.length})...`);

    const embedTexts = batch.map((c) => formatEmbedText(c));
    const embeddings = await embedBatch(embedTexts);

    const rowsRaw = batch.map((c, i) => ({
      source: "oracle_card",
      source_id: c.oracle_id,
      title: c.name,
      content: formatCardContent(c),
      metadata: JSON.stringify({
        oracle_id: c.oracle_id,
        type_line: c.type_line,
        mana_cost: c.mana_cost || null,
        colors: c.colors || [],
        color_identity: c.color_identity || [],
        keywords: c.keywords || [],
        legalities: c.legalities || {},
        power: c.power || null,
        toughness: c.toughness || null,
        cmc: c.cmc,
        layout: c.layout,
        produced_mana: c.produced_mana || [],
        all_parts: (c.all_parts || []).map((p) => ({
          name: p.name,
          component: p.component,
          type_line: p.type_line,
        })),
      }),
      embedding: JSON.stringify(embeddings[i]),
    }));

    // Deduplicate within batch by source_id
    const seenIds = new Set();
    const rows = rowsRaw.filter((r) => {
      if (seenIds.has(r.source_id)) return false;
      seenIds.add(r.source_id);
      return true;
    });

    await upsertRows(rows);
  }

  console.log("\nDone! Oracle card data ingested.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
