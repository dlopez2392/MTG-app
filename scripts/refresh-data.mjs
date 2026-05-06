/**
 * Refresh all rules judge data sources.
 *
 * Clears caches and re-runs ingestion scripts to pick up new sets,
 * errata, ban list changes, and updated rulings.
 *
 * Run weekly or after a new set release:
 *   node --env-file=.env.local scripts/refresh-data.mjs
 *
 * Required env vars: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", ".cache");
const ENV_FILE = join(__dirname, "..", ".env.local");

const scripts = [
  { name: "Comprehensive Rules + Glossary", file: "ingest-rules.mjs", cache: null },
  { name: "Scryfall Rulings", file: "ingest-rulings.mjs", cache: "scryfall-rulings.json" },
  { name: "Oracle Cards", file: "ingest-oracle-cards.mjs", cache: "scryfall-oracle-cards.json" },
  { name: "Tournament Docs (MTR/IPG/JAR)", file: "ingest-tournament-docs.mjs", cache: null },
];

async function main() {
  console.log("=== MTG Houdini Data Refresh ===\n");
  console.log(`Started: ${new Date().toISOString()}\n`);

  for (const script of scripts) {
    console.log(`\n--- ${script.name} ---`);

    // Clear cache to force fresh download
    if (script.cache) {
      const cachePath = join(CACHE_DIR, script.cache);
      if (existsSync(cachePath)) {
        unlinkSync(cachePath);
        console.log(`  Cleared cache: ${script.cache}`);
      }
    }

    const scriptPath = join(__dirname, script.file);
    try {
      execSync(`node --env-file=${ENV_FILE} ${scriptPath}`, {
        stdio: "inherit",
        timeout: 30 * 60 * 1000, // 30 min timeout per script
      });
      console.log(`  ✓ ${script.name} complete`);
    } catch (err) {
      console.error(`  ✗ ${script.name} failed:`, err.message);
      console.error("  Continuing with next script...\n");
    }
  }

  console.log(`\n=== Refresh complete: ${new Date().toISOString()} ===`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
