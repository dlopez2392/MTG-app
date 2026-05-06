/**
 * Ingest MTG Tournament Rules (MTR), Infraction Procedure Guide (IPG),
 * and Judging at Regular REL (JAR) into Supabase rules_embeddings.
 *
 * MTR: parsed JSON from Academy Ruins API
 * IPG/JAR: PDF download via Academy Ruins redirect, parsed with pdf-parse
 *
 * Idempotent — safe to re-run.
 *
 * Required env vars: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

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
        console.error(`Upsert error at row ${i}:`, error.message);
        throw error;
      }
      console.log(`  Retry (${6 - retries}/5) at row ${i}...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.log(`  Upserted ${rows.length} rows`);
}

// ── MTR: structured JSON from Academy Ruins ─────────────────────────

async function fetchMTR() {
  console.log("Fetching MTR from Academy Ruins API...");
  const res = await fetch("https://api.academyruins.com/mtr");
  if (!res.ok) {
    console.warn(`  MTR fetch failed: ${res.status} — skipping`);
    return [];
  }
  const json = await res.json();

  if (!json.content || !Array.isArray(json.content)) {
    console.warn("  Unexpected MTR response structure — skipping");
    return [];
  }

  console.log(`  MTR effective date: ${json.effectiveDate}`);
  console.log(`  Got ${json.content.length} MTR sections`);

  const chunks = [];
  for (const entry of json.content) {
    if (!entry.content) continue; // skip section headers without content

    const sectionNum = entry.section != null
      ? entry.subsection != null
        ? `${entry.section}.${entry.subsection}`
        : `${entry.section}`
      : "";

    const displayTitle = sectionNum
      ? `MTR ${sectionNum} — ${entry.title}`
      : `MTR — ${entry.title}`;

    chunks.push({
      source: "tournament_rules",
      source_id: `mtr_${sectionNum || entry.title}`,
      title: displayTitle,
      content: entry.content,
      metadata: {
        document: "MTR",
        section: entry.section,
        subsection: entry.subsection,
        title: entry.title,
        effectiveDate: json.effectiveDate,
      },
    });
  }

  return chunks;
}

// ── IPG/JAR: PDF download and text chunking ─────────────────────────

async function fetchPDFText(url, name) {
  console.log(`Downloading ${name} PDF from ${url}...`);
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      console.warn(`  ${name} download failed: ${res.status} — skipping`);
      return null;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("pdf")) {
      console.warn(`  ${name} response is not PDF (${contentType}) — skipping`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    let pdfParse;
    try {
      const mod = await import("pdf-parse");
      pdfParse = mod.default || mod;
      if (typeof pdfParse !== "function") throw new Error("pdf-parse did not export a function");
    } catch (e) {
      console.warn(`  pdf-parse not available: ${e.message}`);
      console.warn(`  Skipping ${name} PDF parsing`);
      return null;
    }

    const parsed = await pdfParse(buffer);
    console.log(`  Extracted ${parsed.text.length} chars from ${name} (${parsed.numpages} pages)`);
    return parsed.text;
  } catch (err) {
    console.warn(`  ${name} PDF fetch/parse error: ${err.message} — skipping`);
    return null;
  }
}

function chunkPDFText(text, source, docName, prefix) {
  const chunks = [];
  // Split on numbered section headers like "1. Section Title" or "1.1 Section Title"
  const sectionPattern = /^(\d+(?:\.\d+)?)\s+(.+)/;
  const lines = text.split("\n");
  let currentSection = null;
  let currentTitle = "";
  let currentContent = [];

  function flushSection() {
    const content = currentContent.join("\n").trim();
    if (!content || content.length < 20) return;

    const displayTitle = currentSection
      ? `${docName} ${currentSection} — ${currentTitle}`
      : `${docName} — ${currentTitle || "Introduction"}`;

    chunks.push({
      source,
      source_id: `${prefix}_${currentSection || currentTitle || content.slice(0, 50)}`,
      title: displayTitle,
      content,
      metadata: { document: docName, section: currentSection, title: currentTitle },
    });
  }

  for (const line of lines) {
    const match = line.match(sectionPattern);
    if (match && line.length < 120) {
      flushSection();
      currentSection = match[1];
      currentTitle = match[2].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  flushSection();

  // If section splitting produced too few chunks, fall back to page-sized chunks
  if (chunks.length < 3 && text.length > 500) {
    chunks.length = 0;
    const CHUNK_SIZE = 2000;
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      const slice = text.slice(i, i + CHUNK_SIZE).trim();
      if (slice.length < 50) continue;
      const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
      chunks.push({
        source,
        source_id: `${prefix}_chunk_${chunkNum}`,
        title: `${docName} — Section ${chunkNum}`,
        content: slice,
        metadata: { document: docName, chunkNumber: chunkNum },
      });
    }
  }

  return chunks;
}

// ── main ────────────────────────────────────────────────────────────

async function main() {
  const allChunks = [];

  // 1. MTR (structured JSON)
  const mtrChunks = await fetchMTR();
  allChunks.push(...mtrChunks);
  console.log(`Parsed ${mtrChunks.length} MTR chunks`);

  // 2. IPG (PDF)
  const ipgText = await fetchPDFText("https://api.academyruins.com/link/ipg", "IPG");
  if (ipgText) {
    const ipgChunks = chunkPDFText(ipgText, "infraction_procedure", "IPG", "ipg");
    allChunks.push(...ipgChunks);
    console.log(`Parsed ${ipgChunks.length} IPG chunks`);
  }

  // 3. JAR (PDF)
  const jarText = await fetchPDFText("https://api.academyruins.com/link/jar", "JAR");
  if (jarText) {
    const jarChunks = chunkPDFText(jarText, "regular_rel", "JAR", "jar");
    allChunks.push(...jarChunks);
    console.log(`Parsed ${jarChunks.length} JAR chunks`);
  }

  if (allChunks.length === 0) {
    console.error("No documents were successfully fetched.");
    process.exit(1);
  }

  console.log(`\nTotal chunks to embed: ${allChunks.length}`);

  // Embed
  console.log("Embedding...");
  const texts = allChunks.map((c) => `${c.title}: ${c.content}`);
  const embeddings = await embedBatch(texts);
  console.log(`  Embedded ${embeddings.length} texts`);

  // Build rows and upsert
  const rows = allChunks.map((c, i) => ({
    ...c,
    metadata: JSON.stringify(c.metadata),
    embedding: JSON.stringify(embeddings[i]),
  }));

  console.log("Upserting to Supabase...");
  await upsertRows(rows);
  console.log("\nDone! Tournament documents ingested.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
