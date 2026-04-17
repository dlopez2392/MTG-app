/**
 * MTG Card Hash Index Builder
 * ─────────────────────────────────────────────────────────────────────────────
 * Run once to generate public/card-hashes.json
 *
 * Usage:
 *   node scripts/build-hash-index.mjs
 *
 * Options (env vars):
 *   SET_CODE=znr      Only index one set (fast, good for testing)
 *   CONCURRENCY=10    Parallel image downloads (default 10)
 *   RESUME=true       Skip cards already in an existing output file
 *
 * Output:
 *   public/card-hashes.json  (~2-4 MB, committed to repo)
 *
 * Time estimate:
 *   Full index (~25k unique artworks): ~40-60 min at 10 req/sec
 *   Single set  (~200-400 cards):      ~1-2 min
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createWriteStream, existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_FILE = join(ROOT, "public", "card-hashes.json");

const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "10", 10);
const SET_FILTER = process.env.SET_CODE?.toLowerCase() ?? null;
const RESUME = process.env.RESUME === "true";

// ── dHash ─────────────────────────────────────────────────────────────────────

function dHashFromRaw(pixels) {
  let lo = 0, hi = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left  = pixels[y * 9 + x];
      const right = pixels[y * 9 + x + 1];
      const bit   = y * 8 + x;
      if (left > right) {
        if (bit < 32) lo |= 1 << bit;
        else           hi |= 1 << (bit - 32);
      }
    }
  }
  return (hi >>> 0).toString(16).padStart(8, "0") +
         (lo >>> 0).toString(16).padStart(8, "0");
}

async function computeHashFromUrl(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "MTGHoudini/1.0 (hash-builder; contact danlopez508@gmail.com)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const { data } = await sharp(buffer)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return dHashFromRaw(data);
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function progress(done, total, errors) {
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar   = "█".repeat(Math.floor(pct / 2)).padEnd(50, "░");
  process.stdout.write(`\r[${bar}] ${pct}% ${done}/${total}  errors: ${errors}  `);
}

// ── Batched concurrency ───────────────────────────────────────────────────────

async function processInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
    // Respect Scryfall's rate limit: ~100ms between batches
    await new Promise(r => setTimeout(r, 100));
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📦 MTG Card Hash Index Builder");
  console.log("───────────────────────────────────────────────────");

  // 1. Load existing index if resuming
  const existing = new Map();
  if (RESUME && existsSync(OUT_FILE)) {
    const old = JSON.parse(readFileSync(OUT_FILE, "utf8"));
    for (const card of (old.cards ?? [])) existing.set(card.id, card);
    console.log(`↺  Resuming — ${existing.size} cards already indexed`);
  }

  // 2. Fetch Scryfall bulk data
  console.log("⬇  Fetching Scryfall bulk card list…");
  const metaRes = await fetch("https://api.scryfall.com/bulk-data");
  const meta = await metaRes.json();
  const defaultCardsEntry = meta.data.find(d => d.type === "default_cards");
  if (!defaultCardsEntry) throw new Error("Could not find default_cards bulk data");

  console.log(`⬇  Downloading ${defaultCardsEntry.compressed_size ? Math.round(defaultCardsEntry.compressed_size / 1024 / 1024) + "MB" : ""} bulk JSON…`);
  const bulkRes = await fetch(defaultCardsEntry.download_uri);
  const allCards = await bulkRes.json();
  console.log(`   ${allCards.length.toLocaleString()} total cards`);

  // 3. Filter + deduplicate by illustration_id
  const seen = new Set();
  const candidates = [];
  for (const card of allCards) {
    // Skip tokens, art cards, non-paper etc.
    if (card.layout === "token" || card.layout === "art_series" || card.layout === "emblem") continue;
    if (!card.image_uris?.art_crop && !card.card_faces?.[0]?.image_uris?.art_crop) continue;
    if (SET_FILTER && card.set !== SET_FILTER) continue;

    const artUrl = card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop;
    const illId  = card.illustration_id ?? card.id;

    // One hash per unique artwork
    if (seen.has(illId)) continue;
    seen.add(illId);

    candidates.push({ id: card.id, name: card.name, set: card.set, artUrl });
  }

  const toProcess = RESUME
    ? candidates.filter(c => !existing.has(c.id))
    : candidates;

  console.log(`🎨 ${candidates.length.toLocaleString()} unique artworks${SET_FILTER ? ` in set "${SET_FILTER}"` : ""}`);
  if (RESUME) console.log(`   ${toProcess.length.toLocaleString()} remaining`);
  console.log(`⚙  Concurrency: ${CONCURRENCY}`);
  console.log("───────────────────────────────────────────────────");

  // 4. Hash each artwork
  let done = 0;
  let errors = 0;
  const cards = [...existing.values()];

  await processInBatches(toProcess, CONCURRENCY, async (card) => {
    try {
      const hash = await computeHashFromUrl(card.artUrl);
      cards.push({ id: card.id, n: card.name, s: card.set, h: hash });
    } catch {
      errors++;
    } finally {
      done++;
      progress(done, toProcess.length, errors);
    }
  });

  console.log("\n───────────────────────────────────────────────────");
  console.log(`✅ Hashed ${cards.length.toLocaleString()} cards (${errors} errors)`);

  // 5. Write output
  const output = {
    version: 1,
    generated: new Date().toISOString(),
    count: cards.length,
    cards,
  };
  writeFileSync(OUT_FILE, JSON.stringify(output), "utf8");

  const sizeMB = (Buffer.byteLength(JSON.stringify(output)) / 1024 / 1024).toFixed(1);
  console.log(`💾 Written to public/card-hashes.json (${sizeMB} MB)`);
  console.log("Done! Commit public/card-hashes.json and redeploy.");
}

main().catch(err => { console.error(err); process.exit(1); });
