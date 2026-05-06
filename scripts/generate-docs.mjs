/**
 * MTG Houdini — Architecture & Integration Documentation Generator
 * Run: node scripts/generate-docs.mjs
 * Output: MTG-Houdini-Architecture.pdf (project root)
 */

import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "MTG-Houdini-Architecture.pdf");

const doc = new PDFDocument({
  size: "A4",
  margin: 0,
  autoFirstPage: true,
  bufferPages: true,
});
doc.pipe(createWriteStream(OUT));

// ── Constants ─────────────────────────────────────────────────────────────────
const PW = 595.28;   // A4 width  pts
const PH = 841.89;   // A4 height pts
const ML = 55;       // left margin
const MR = 55;       // right margin
const TW = PW - ML - MR;  // text width

const C = {
  bg:     "#121212",
  panel:  "#1C1C1C",
  code:   "#0D0D0D",
  accent: "#ED9A57",
  white:  "#FFFFFF",
  light:  "#E2E8F0",
  muted:  "#9CA3AF",
  teal:   "#2DD4BF",
  green:  "#4ADE80",
  red:    "#F87171",
  blue:   "#60A5FA",
  purple: "#C084FC",
  lime:   "#A3E635",
};

// ── Drawing helpers ───────────────────────────────────────────────────────────

function fillPage() {
  doc.save();
  doc.rect(0, 0, PW, PH).fill(C.bg);
  doc.rect(0, 0, 6, PH).fill(C.accent);
  doc.restore();
}

function newPage() {
  doc.addPage();
  fillPage();
  doc.y = 52;
}

function checkRoom(needed = 60) {
  if (doc.y + needed > PH - 50) newPage();
}

// Current Y with auto page break
function cy() { return doc.y; }

function gap(pts = 6) { doc.y += pts; }

function rule(color = "#2A2A2A") {
  doc.save();
  doc.moveTo(ML, cy()).lineTo(ML + TW, cy())
     .strokeColor(color).lineWidth(0.5).stroke();
  doc.restore();
  gap(4);
}

// Section heading with coloured underline
function h2(text, color = C.accent) {
  checkRoom(40);
  gap(10);
  doc.save();
  doc.font("Helvetica-Bold").fontSize(12).fillColor(color)
     .text(text, ML, cy(), { width: TW });
  gap(2);
  doc.moveTo(ML, cy()).lineTo(ML + TW, cy())
     .strokeColor(color).lineWidth(0.8).stroke();
  doc.restore();
  gap(6);
}

function h3(text) {
  checkRoom(24);
  doc.save();
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(C.accent)
     .text(text, ML, cy(), { width: TW });
  doc.restore();
  gap(3);
}

function body(text) {
  checkRoom(20);
  doc.save();
  doc.font("Helvetica").fontSize(9).fillColor(C.light)
     .text(text, ML, cy(), { width: TW, lineGap: 2.5 });
  doc.restore();
  gap(5);
}

function bullet(items) {
  for (const item of items) {
    checkRoom(16);
    doc.save();
    doc.font("Helvetica").fontSize(9).fillColor(C.light)
       .text("•  " + item, ML + 8, cy(), { width: TW - 8, lineGap: 2 });
    doc.restore();
    gap(3);
  }
  gap(3);
}

// Key : Value row
function kv(key, value, keyColor = C.teal) {
  checkRoom(14);
  const keyW = 145;
  const startY = cy();
  doc.save();
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(keyColor)
     .text(key, ML, startY, { width: keyW, lineGap: 2 });
  const afterKey = doc.y;
  doc.font("Helvetica").fontSize(8.5).fillColor(C.light)
     .text(value, ML + keyW, startY, { width: TW - keyW, lineGap: 2 });
  doc.restore();
  doc.y = Math.max(afterKey, doc.y) + 2;
}

// Dark panel code block
function code(lines) {
  const lh = 11;
  const bh = lines.length * lh + 12;
  checkRoom(bh + 4);
  doc.save();
  doc.rect(ML, cy(), TW, bh).fill(C.code);
  const startY = cy() + 7;
  lines.forEach((line, i) => {
    doc.font("Courier").fontSize(7.5).fillColor(C.lime)
       .text(line, ML + 8, startY + i * lh, { width: TW - 16, lineBreak: false });
  });
  doc.restore();
  doc.y = cy() + bh + 2;
  gap(4);
}

// Shaded label → value row
function row(label, value, labelColor = C.teal) {
  checkRoom(16);
  const startY = cy();
  doc.save();
  doc.rect(ML, startY, TW, 16).fill(C.panel);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(labelColor)
     .text(label, ML + 6, startY + 4, { width: 160, lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(C.light)
     .text(value, ML + 168, startY + 4, { width: TW - 172, lineGap: 1.5 });
  doc.restore();
  doc.y = startY + 18;
}

// Bold orange header band
function band(title, sub = "") {
  const bh = sub ? 56 : 40;
  checkRoom(bh + 8);
  doc.save();
  doc.rect(ML, cy(), TW, bh).fill(C.panel);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(C.accent)
     .text(title, ML + 10, cy() + 8, { width: TW - 20, lineBreak: false });
  if (sub) {
    doc.font("Helvetica").fontSize(8).fillColor(C.muted)
       .text(sub, ML + 10, cy() + 30, { width: TW - 20, lineBreak: false });
  }
  doc.restore();
  doc.y = cy() + bh + 10;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COVER
// ═══════════════════════════════════════════════════════════════════════════════

fillPage();

doc.save();
doc.rect(0, 0, 6, PH).fill(C.accent);

// Title
doc.font("Helvetica-Bold").fontSize(38).fillColor(C.accent)
   .text("MTG Houdini", ML + 10, 160, { width: TW });
doc.font("Helvetica").fontSize(17).fillColor(C.white)
   .text("Architecture & Integration Reference", ML + 10, 208, { width: TW });

doc.moveTo(ML + 10, 240).lineTo(ML + 10 + 380, 240)
   .strokeColor(C.accent).lineWidth(1.5).stroke();

doc.font("Helvetica").fontSize(10).fillColor(C.muted)
   .text("Magic: The Gathering Companion App", ML + 10, 250);
doc.font("Helvetica").fontSize(9).fillColor(C.muted)
   .text("Next.js 16 · React 19 · Supabase · Clerk · Vercel", ML + 10, 266);

// Info box
doc.rect(ML + 10, 310, 320, 96).fill(C.panel);
const genDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const infoItems = [
  ["Generated",   genDate],
  ["Repository",  "github.com/dlopez2392/MTG-app"],
  ["Deployed at", "Vercel (auto-deploy, main branch)"],
  ["Node.js",     "≥ 18.18  (v24 in production)"],
];
infoItems.forEach(([k, v], i) => {
  doc.font("Helvetica-Bold").fontSize(8).fillColor(C.accent)
     .text(k + ":", ML + 18, 322 + i * 20, { width: 80, lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(C.light)
     .text(v, ML + 100, 322 + i * 20, { width: 220, lineBreak: false });
});

// Disclaimer
doc.font("Helvetica").fontSize(7).fillColor(C.muted)
   .text(
     "MTG Houdini is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. " +
     "Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.",
     ML + 10, PH - 55, { width: TW - 10, lineGap: 2 }
   );
doc.restore();

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE OF CONTENTS
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
doc.font("Helvetica-Bold").fontSize(22).fillColor(C.accent)
   .text("Table of Contents", ML, cy(), { width: TW });
gap(4);
rule(C.accent);

const toc = [
  ["1",  "Application Overview",              "Tech stack, purpose, and core features"],
  ["2",  "Architecture Overview",             "How all services connect at a glance"],
  ["3",  "Repository & Vercel Deployment",    "GitHub → CI/CD → Production pipeline"],
  ["4",  "Authentication — Clerk",            "Sign-up, sign-in, middleware, and sessions"],
  ["5",  "Database — Supabase",              "Tables, schema, service role pattern"],
  ["6",  "Local Storage — Dexie / IndexedDB", "Offline-first guest mode"],
  ["7",  "Scryfall API Integration",          "Card data, images, search, autocomplete"],
  ["8",  "Commander Spellbook Integration",   "Combo lookup with 24h Supabase cache"],
  ["9",  "MTGJSON Integration",               "Card Kingdom & CardMarket pricing"],
  ["10", "17Lands Integration",               "Draft analytics — ALSA, ATA, win rates"],
  ["11", "JustTCG Integration",               "Condition-specific TCGPlayer pricing"],
  ["12", "News Feeds (RSS)",                  "8 MTG news sources aggregated client-side"],
  ["13", "Card Scanner (dHash)",              "Visual fingerprinting, 49k index, OCR fallback"],
  ["14", "Environment Variables",             "All required keys, secrets, and their purposes"],
  ["15", "Maintenance Schedule",              "New set indexing — what needs running and when"],
];

toc.forEach(([num, title, sub], i) => {
  checkRoom(22);
  const y = cy();
  if (i % 2 === 0) {
    doc.save();
    doc.rect(ML, y, TW, 20).fill(C.panel);
    doc.restore();
  }
  doc.save();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.accent)
     .text(num + ".", ML + 6, y + 5, { width: 18, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.white)
     .text(title, ML + 26, y + 5, { width: 190, lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(C.muted)
     .text(sub, ML + 222, y + 5, { width: TW - 226, lineBreak: false });
  doc.restore();
  doc.y = y + 22;
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1 — APPLICATION OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("1 — Application Overview", "MTG Houdini · Magic: The Gathering Companion App");

h2("Purpose");
body(
  "MTG Houdini is a mobile-first Progressive Web App built with Next.js 16 and React 19. " +
  "It combines real-time card lookup, collection management, deck building, price tracking, " +
  "draft analytics, combo discovery, a life counter, a visual card scanner, and live MTG news — " +
  "all in a single installable PWA hosted on Vercel."
);

h2("Core Features");
bullet([
  "Card Search — Full Scryfall integration with filters, autocomplete, and artwork lightbox",
  "Collection Manager — Binders backed by Supabase (cloud) + Dexie IndexedDB (offline/guest)",
  "Deck Builder — Editor with mana curve charts (Recharts), stats, and CSV export/import",
  "Card Detail — Prices (Scryfall, Card Kingdom, CardMarket, JustTCG), rulings, legality, combos, draft stats",
  "Card Scanner — Camera-based dHash visual matching against 49,191 pre-indexed artworks",
  "Life Counter — Multi-player counter with history log, persisted to IndexedDB",
  "News Feed — Aggregated RSS from 8 sources (WotC, TCGplayer, EDHREC, MTGGoldfish, etc.)",
  "Combos — Commander Spellbook API with 24-hour Supabase cache",
  "Draft Analytics — 17Lands per-card stats (ALSA, ATA, GIH WR, OH WR, IWD)",
  "Rules & Glossary — Offline-ready MTG comprehensive rules reference",
  "Wishlist — Cards to acquire, stored in IndexedDB",
]);

h2("Tech Stack");
kv("Framework",        "Next.js 16.2.2 — App Router, Turbopack for local dev");
kv("UI Library",       "React 19.2.4");
kv("Styling",          "Tailwind CSS v4 — utility-first, dark theme throughout");
kv("Charts",           "Recharts 3 — mana curve bars, win-rate visualisation");
kv("Authentication",   "Clerk v7 (@clerk/nextjs) — sign-up, sign-in, JWT sessions");
kv("Cloud Database",   "Supabase (PostgreSQL) — collections, decks, combo cache");
kv("Local Database",   "Dexie v4 (IndexedDB wrapper) — guest mode & offline data");
kv("Image Processing", "sharp v0.34 — server-side dHash computation for card scanner");
kv("OCR (fallback)",   "Tesseract.js v7 — client-side, lazy-loaded, used only when hash fails");
kv("Deployment",       "Vercel — auto-deploy from GitHub main branch");
kv("Language",         "TypeScript 5 throughout, strict mode enabled");

// ═══════════════════════════════════════════════════════════════════════════════
// 2 — ARCHITECTURE OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("2 — Architecture Overview", "How all services connect to MTG Houdini");

h2("Service Map");
code([
  "┌──────────────────────────────────────────────────────────────────┐",
  "│                    USER BROWSER / DEVICE                        │",
  "│  ┌────────────────────────────────────────────────────────────┐  │",
  "│  │         Next.js App  (React 19, App Router)                │  │",
  "│  │  Pages: Search · Collection · Decks · Scan · Life · News   │  │",
  "│  └───────────────┬─────────────────────────┬──────────────────┘  │",
  "│                  │ /api/* routes            │ Dexie IndexedDB     │",
  "└──────────────────┼──────────────────────────┼─────────────────────┘",
  "                   │                          └── decks, binders, life",
  "          ┌────────▼────────┐                     (guest / offline)",
  "          │  Vercel Edge    │",
  "          │ (Next.js API)   │",
  "          └────────┬────────┘",
  "     ┌─────────────┼──────────────────────────────────┐",
  "     │             │              │          │         │",
  "┌────▼────┐  ┌─────▼──────┐ ┌───▼────┐ ┌───▼───┐ ┌──▼──────┐",
  "│Supabase │  │  Scryfall  │ │Spellbk │ │MTGJSON│ │17Lands  │",
  "│Postgres │  │  API       │ │ API    │ │ API   │ │ API     │",
  "│(cloud DB│  │(card data) │ │(combos)│ │(price)│ │(draft)  │",
  "└────┬────┘  └────────────┘ └────────┘ └───────┘ └─────────┘",
  "     │",
  "  Tables: binders · collection_cards · decks · deck_cards · combo_cache",
  "  All rows scoped by user_id (Clerk userId)",
  "",
  "  Also: Clerk.com (auth) · JustTCG API (condition prices) · RSS feeds (news)",
]);

h2("Request Flow");
bullet([
  "Browser → Next.js API Routes → External APIs (Scryfall, Spellbook, MTGJSON, 17Lands, JustTCG)",
  "Browser → Clerk SDK → Clerk.com (session validation, JWT tokens)",
  "Next.js API → Supabase (server-side Service Role Key — never exposed to client)",
  "Card Scanner → Canvas dHash (client) → POST /api/scan/search → in-memory index → Scryfall card fetch",
  "Guest users → Dexie IndexedDB only (no Supabase calls for collection/deck data)",
  "Signed-in users → Supabase via API routes (every row scoped by Clerk userId)",
]);

h2("Caching Strategy");
kv("Scryfall search",    "next: { revalidate: 300 }  — 5 min at Vercel edge");
kv("Scryfall card",      "next: { revalidate: 86400 } — 24 hours");
kv("MTGJSON set file",   "next: { revalidate: 86400 } — 24 hours (entire set JSON cached)");
kv("17Lands stats",      "next: { revalidate: 3600 }  — 1 hour");
kv("JustTCG prices",     "next: { revalidate: 3600 }  — 1 hour");
kv("Combo results",      "Supabase combo_cache table  — 24 hours TTL (expires_at column)");
kv("Card hash index",    "Module-level memory cache on Vercel function instance (lives with process)");

// ═══════════════════════════════════════════════════════════════════════════════
// 3 — REPOSITORY & VERCEL
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("3 — Repository & Vercel Deployment", "GitHub → CI/CD → Production");

h2("Repository");
kv("Provider",       "GitHub");
kv("URL",            "https://github.com/dlopez2392/MTG-app");
kv("Branch",         "main  (single branch — push to main = deploy to production)");
kv("Language",       "TypeScript 5, strict mode");
kv("Build tool",     "Next.js built-in (next build) via Vercel");

h2("How Vercel Connects to GitHub");
bullet([
  "Repository linked to Vercel via GitHub OAuth (authorised in Vercel dashboard)",
  "Every push to the main branch triggers an automatic production deployment",
  "Vercel webhook fires on push → installs dependencies → runs next build → deploys",
  "No separate staging or preview environments configured — all pushes go to production",
  "Deployment logs visible at: vercel.com → Project → Deployments",
]);

h2("Deploy Pipeline");
code([
  "git push origin main",
  "  │",
  "  └─► GitHub webhook → Vercel picks up commit",
  "           │",
  "           ├─► npm install  (all dependencies including sharp)",
  "           ├─► next build   (TypeScript compile + route generation)",
  "           ├─► Environment variables injected from Vercel dashboard",
  "           └─► Deploy to Vercel CDN → Production URL goes live (~2 min)",
]);

h2("Vercel Project Settings");
row("Framework Preset",   "Next.js  (auto-detected)");
row("Build Command",      "next build");
row("Output Directory",   ".next");
row("Install Command",    "npm install");
row("Node.js Version",    "20.x  (set in Vercel dashboard → Settings → General)");
row("Root Directory",     "/  (repository root)");
row("Production Branch",  "main");

h2("Static Assets");
body(
  "The file public/card-hashes.json (4.8 MB, 49,191 card artworks) is committed to the repository " +
  "and served as a static file. It is loaded into server memory once per Vercel function instance " +
  "and cached there for the lifetime of that process. No CDN or database needed for the hash index."
);

h2("Manual Redeploy Commands");
code([
  "# Trigger redeploy without code changes:",
  "git commit --allow-empty -m 'chore: trigger redeploy'",
  "git push origin main",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// 4 — CLERK AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("4 — Authentication — Clerk", "Sign-up, sign-in, session management, and middleware");

h2("Overview");
body(
  "Authentication is handled entirely by Clerk (@clerk/nextjs v7). Clerk manages user accounts, " +
  "sign-in/sign-up UI, session tokens, and OAuth providers. Authentication is optional — " +
  "guests use the app fully with data stored locally; signed-in users get cloud sync via Supabase."
);

h2("Integration Points");
h3("Root Layout  (src/app/layout.tsx)");
body("The entire app is wrapped in <ClerkProvider>. This makes Clerk hooks and session context " +
     "available to every page and component in the app.");

h3("Middleware  (src/middleware.ts)");
code([
  "import { clerkMiddleware } from '@clerk/nextjs/server';",
  "",
  "export default clerkMiddleware();",
  "// Runs on every request — validates session but does NOT block unauthenticated users.",
  "// Auth gating happens per-route inside each API handler.",
]);

h3("API Route Auth Pattern");
code([
  "import { auth } from '@clerk/nextjs/server';",
  "import { getSupabase } from '@/lib/supabase/server';",
  "",
  "export async function GET() {",
  "  const { userId } = await auth();",
  "  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });",
  "",
  "  // userId is the Clerk user ID — used as foreign key in ALL Supabase tables",
  "  const sb = getSupabase();",
  "  const { data } = await sb.from('binders').select('*').eq('user_id', userId);",
  "  return Response.json(data);",
  "}",
]);

h2("Clerk Dashboard Configuration");
row("Instance",          "Development (test keys — pk_test / sk_test prefix)");
row("Sign-up methods",   "Email + password (configured in Clerk dashboard)");
row("After sign-in URL", "/  (NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL)");
row("After sign-up URL", "/  (NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL)");
row("JWT template",      "Default Clerk JWT — no custom claims needed");

h2("User Identity in Supabase");
body(
  "Clerk's userId (format: 'user_2abc...') is stored as the user_id column in every Supabase " +
  "table. There is no separate users table in Supabase — Clerk is the sole source of identity. " +
  "All queries include .eq('user_id', userId) to scope data per user."
);

h2("Environment Variables — Clerk");
row("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "Public key — safe to expose to the browser",       C.green);
row("CLERK_SECRET_KEY",                  "Server key — NEVER sent to client. API routes only.", C.red);
row("NEXT_PUBLIC_CLERK_SIGN_IN_URL",    "Value: /sign-in");
row("NEXT_PUBLIC_CLERK_SIGN_UP_URL",    "Value: /sign-up");

// ═══════════════════════════════════════════════════════════════════════════════
// 5 — SUPABASE
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("5 — Database — Supabase (PostgreSQL)", "Cloud persistence for signed-in users");

h2("Connection");
body(
  "Supabase is accessed exclusively from Next.js API Routes using the Service Role Key. " +
  "The client is never initialised in browser code. Every API route calls getSupabase() " +
  "which creates a server-side Supabase client with full service-role access."
);
code([
  "// src/lib/supabase/server.ts",
  "import { createClient } from '@supabase/supabase-js';",
  "",
  "export function getSupabase() {",
  "  return createClient(",
  "    process.env.NEXT_PUBLIC_SUPABASE_URL!,",
  "    process.env.SUPABASE_SERVICE_ROLE_KEY!   // server-side only — full access",
  "  );",
  "}",
]);

h2("Database Tables");

h3("binders");
code([
  "id              uuid PRIMARY KEY",
  "user_id         text  -- Clerk userId (scopes all reads/writes)",
  "name            text",
  "description     text",
  "cover_image_uri text",
  "created_at      timestamptz",
  "updated_at      timestamptz",
]);

h3("collection_cards");
code([
  "id               uuid PRIMARY KEY",
  "user_id          text, binder_id uuid REFERENCES binders",
  "scryfall_id      text, name text, quantity int",
  "set_code text, set_name text, collector_number text",
  "image_uri text, price_usd text, type_line text, rarity text",
  "is_foil boolean, created_at timestamptz",
]);

h3("decks");
code([
  "id             uuid PRIMARY KEY",
  "user_id        text, name text, format text",
  "cover_card_id  text, cover_image_uri text",
  "created_at     timestamptz, updated_at timestamptz",
]);

h3("deck_cards");
code([
  "id           uuid PRIMARY KEY",
  "user_id      text, deck_id uuid REFERENCES decks",
  "scryfall_id  text, name text, quantity int",
  "category     text  -- main | side | commander | maybe",
  "mana_cost    text, type_line text, image_uri text",
  "created_at   timestamptz",
]);

h3("combo_cache");
code([
  "card_name   text PRIMARY KEY",
  "combos      jsonb  -- array of EnrichedCombo objects",
  "count       int",
  "cached_at   timestamptz",
  "expires_at  timestamptz  -- TTL: 24 hours from cached_at",
]);

h2("Row-Level Security");
body(
  "Data is scoped per-user via .eq('user_id', userId) in every query inside the API routes. " +
  "The Service Role Key bypasses Postgres RLS policies, so security is enforced at the " +
  "application layer (Clerk userId from auth() call) rather than database-level RLS."
);

h2("Environment Variables — Supabase");
row("NEXT_PUBLIC_SUPABASE_URL",       "Public project URL — safe to expose", C.green);
row("NEXT_PUBLIC_SUPABASE_ANON_KEY",  "Anon key — kept for reference, not actively used", C.muted);
row("SUPABASE_SERVICE_ROLE_KEY",      "Full-access server key — NEVER expose to client", C.red);

// ═══════════════════════════════════════════════════════════════════════════════
// 6 — DEXIE
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("6 — Local Storage — Dexie / IndexedDB", "Offline-first guest mode");

h2("Purpose");
body(
  "Dexie v4 wraps the browser's built-in IndexedDB and provides the data layer for guest users " +
  "(not signed in). All collection, deck, and life counter data is stored locally in the browser " +
  "with no server calls. Signed-in users use Supabase; the switch is transparent to the UI."
);

h2("Database Schema  (src/lib/db/index.ts)");
code([
  "const db = new Dexie('mtg-houdini');",
  "",
  "// v1 stores",
  "decks:           ++id, name, format, folderId, createdAt",
  "deckCards:       ++id, deckId, scryfallId, name, category",
  "deckFolders:     ++id, name, parentId",
  "binders:         ++id, name, createdAt",
  "collectionCards: ++id, binderId, scryfallId, name",
  "lifeGames:       ++id, createdAt",
  "",
  "// v2 migration — added updatedAt index to decks",
]);

h2("Data Routing");
bullet([
  "Signed-in users  → all data in Supabase, accessible from any device",
  "Guest users      → data in browser IndexedDB only (lost if browser storage cleared)",
  "Life counter     → always uses IndexedDB regardless of auth state",
  "No automatic sync between local and cloud — manual import/export required to migrate",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// 7 — SCRYFALL
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("7 — Scryfall API Integration", "Primary card data source — free, no API key required");

h2("Overview");
body(
  "Scryfall provides card data, artwork images, prices, rulings, and set information. " +
  "All calls are proxied through Next.js API routes to add caching and avoid CORS. " +
  "Scryfall's API is free with no authentication required."
);

h2("API Routes");
row("/api/scryfall/search",       "GET ?q=&page=&order=&dir=&unique=   Full Scryfall syntax search");
row("/api/scryfall/named",        "GET ?fuzzy= or ?exact=              Single card by name");
row("/api/scryfall/autocomplete", "GET ?q=                             Name completions (string[])");
row("/api/scryfall/suggest",      "GET ?q=                             Enriched suggestions (images + prices)");
row("/api/scryfall/cards/[id]",   "GET                                 Single card by Scryfall UUID");
row("/api/scryfall/sets",         "GET                                 All MTG sets");
row("/api/scryfall/rulings/[id]", "GET                                 Rulings for a card");
row("/api/scryfall/image-proxy",  "GET ?url=                           Proxy for artwork images (CORS)");

h2("Image Configuration");
body(
  "next.config.ts allows Next.js <Image> from cards.scryfall.io and svgs.scryfall.io. " +
  "Image sizes used: small (146×204), normal (488×680), large (672×936), art_crop (artwork only)."
);

h2("Caching & Rate Limits");
bullet([
  "Search results cached 5 min at Vercel edge (next: { revalidate: 300 })",
  "Card detail cached 24 hours (next: { revalidate: 86400 })",
  "Autocomplete debounced 300ms client-side to limit API calls",
  "Scryfall recommends max 10 requests/second — respected by hash builder (100ms batch delay)",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// 8 — COMMANDER SPELLBOOK
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("8 — Commander Spellbook Integration", "Combo lookup with 24h Supabase cache");

h2("Overview");
body(
  "Commander Spellbook provides a database of MTG combo recipes for the Commander format. " +
  "The app queries their public REST API and caches results in Supabase for 24 hours."
);

h2("Request Flow");
bullet([
  "User opens card detail → useCardCombos hook → GET /api/combos?name={cardName}",
  "Server checks Supabase combo_cache WHERE card_name = ? AND expires_at > now()",
  "Cache HIT → return cached combos immediately (no external call)",
  "Cache MISS → fetch from commanderspellbook.com/variants/?q=card:\"name\"",
  "Filter: status in (OK, PREVIEW) and spoiler = false",
  "Map to EnrichedCombo shape (card images come from Spellbook directly)",
  "Write to combo_cache with expires_at = now() + 24h, return results",
]);

h2("API Details");
kv("Base URL",   "https://backend.commanderspellbook.com/variants/");
kv("Auth",       "None required — public API");
kv("Cache TTL",  "24 hours in Supabase combo_cache table");
kv("Fallback",   "If exact match fails, retries with plain card name (no card: prefix)");
kv("Route",      "/api/combos?name=CARD_NAME");

h2("EnrichedCombo Shape");
code([
  "{",
  "  id:          string;           // Spellbook variant ID",
  "  cards: [{",
  "    name:            string;",
  "    zoneLocations:   string[];   // hand, battlefield, graveyard, etc.",
  "    mustBeCommander: boolean;",
  "    imageUri?:       string;",
  "  }];",
  "  produces:    string[];         // e.g. ['Infinite Damage', 'Infinite Mana']",
  "  description: string;           // step-by-step instructions",
  "  notes:       string;",
  "  popularity:  number | null;",
  "}",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// 9 — MTGJSON
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("9 — MTGJSON Integration", "Card Kingdom & CardMarket pricing");

h2("Overview");
body(
  "MTGJSON provides per-set JSON files with price history for Card Kingdom (retail + buylist) " +
  "and CardMarket. These prices are not available in Scryfall. The entire set JSON is cached " +
  "for 24 hours, so multiple card lookups within the same set are essentially free."
);

h2("Endpoint");
kv("Route",   "/api/mtgjson/prices");
kv("Params",  "?set=SET_CODE&scryfallId=SCRYFALL_UUID");
kv("Source",  "https://mtgjson.com/api/v5/{SET}.json");
kv("Cache",   "next: { revalidate: 86400 } — full set JSON cached 24 hours");
kv("Auth",    "None required — public API");

h2("Response Shape");
code([
  "{",
  "  cardKingdom: {",
  "    retail:      string | null,   // e.g. '4.50'",
  "    buylist:     string | null,",
  "    retailFoil:  string | null,",
  "    buylistFoil: string | null,",
  "  },",
  "  cardmarket: {",
  "    retail:      string | null,",
  "    retailFoil:  string | null,",
  "  }",
  "}",
]);

h2("Lookup Logic");
bullet([
  "Fetch https://mtgjson.com/api/v5/{SET}.json (e.g. DSK.json) — cached 24h",
  "Find card by matching identifiers.scryfallId === queried scryfallId",
  "Extract paper.cardkingdom and paper.cardkingdomFoil price maps",
  "Each price map: { '2025-01-15': '2.50', ... } — latest date used as current price",
  "Returns null for any price not available in that set's data",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// 10 — 17LANDS
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("10 — 17Lands Integration", "Draft analytics — ALSA, ATA, GIH WR, IWD");

h2("Overview");
body(
  "17Lands tracks Magic: The Gathering Arena draft data and publishes per-card statistics " +
  "for each limited format. Stats appear on the card detail page under a 'Draft' tab. " +
  "Data is CC BY 4.0 — attribution is shown in the UI."
);

h2("Endpoint");
kv("Route",   "/api/17lands");
kv("Params",  "?set=SET_CODE&name=CARD_NAME");
kv("Source",  "https://www.17lands.com/card_ratings/data?expansion=SET&format=FORMAT");
kv("Cache",   "next: { revalidate: 3600 } — 1 hour");
kv("Format",  "Tried in order: PremierDraft → QuickDraft → TradDraft (first with data wins)");
kv("License", "CC BY 4.0 — attribution shown in DraftStatsPanel component");

h2("Statistics");
row("avgSeen  (ALSA)",             "Average Last Seen At — how late in pack it wheels");
row("avgPick  (ATA)",              "Average Taken At — average pick position");
row("winRate  (GIH WR)",           "Games In Hand win rate — primary draft metric");
row("openingHandWinRate  (OH WR)", "Win rate when card is in opening hand");
row("drawnWinRate  (GD WR)",       "Win rate when drawn after opening hand");
row("everDrawnWinRate  (GEV WR)",  "Win rate in games where card was ever drawn");
row("neverDrawnWinRate  (GNS WR)", "Win rate in games where card was never drawn");
row("drawnImprovementWinRate (IWD)","Impact of drawing the card on win rate");
row("gameCount",                   "Number of games in the sample set");

h2("Win Rate Colour Coding (UI)");
bullet([
  "≥ 58%  — Green  (excellent)",
  "≥ 54%  — Orange (above average)",
  "≥ 50%  — Yellow (average)",
  "< 50%  — Red    (below average)",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// 11 — JUSTTCG
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("11 — JustTCG Integration", "Condition-specific TCGPlayer pricing");

h2("Overview");
body(
  "JustTCG provides condition-specific pricing (Near Mint, Lightly Played, etc.) sourced from " +
  "TCGPlayer. Unlike Scryfall which gives a single market price, JustTCG breaks pricing down " +
  "by condition. Requires a paid API key stored server-side."
);

h2("Endpoint");
kv("Route",   "/api/justtcg/prices");
kv("Params",  "?name=CARD_NAME");
kv("Auth",    "X-API-Key header — uses JUSTTCG_API_KEY environment variable");
kv("Cache",   "next: { revalidate: 3600 } — 1 hour at Vercel edge");
kv("Key",     "JUSTTCG_API_KEY — set in Vercel environment variables (server-only)");

h2("Graceful Degradation");
body(
  "If JUSTTCG_API_KEY is not set, the endpoint returns { configured: false }. " +
  "The UI falls back to Scryfall prices silently — no error is shown to the user."
);

// ═══════════════════════════════════════════════════════════════════════════════
// 12 — NEWS FEEDS
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("12 — News Feeds (RSS)", "8 MTG news sources aggregated client-side");

h2("Overview");
body(
  "The News page aggregates RSS feeds from 8 Magic publications. Parsing is done client-side " +
  "in the browser on each page load — no server proxy required. Users can toggle which sources " +
  "appear via Settings. Defined in src/lib/news/feeds.ts."
);

h2("Sources");
row("Magic: The Gathering (WotC)", "magic.wizards.com/en/rss/news          — ON by default");
row("TCGplayer Infinite",          "infinite.tcgplayer.com/rss             — ON by default");
row("EDHREC",                      "edhrec.com/articles/feed/              — ON by default");
row("MTGGoldfish",                 "mtggoldfish.com/news/rss               — ON by default");
row("MTG Arena Zone",              "mtgazone.com/feed/                     — ON by default");
row("Hipsters of the Coast",       "hipstersofthecoast.com/feed/           — ON by default");
row("Star City Games",             "articles.starcitygames.com/feed/       — OFF by default");
row("ChannelFireball",             "channelfireball.com/feed/              — OFF by default");

h2("No Server-Side Caching");
body(
  "News feeds are fetched fresh on every page load client-side. No caching is configured " +
  "because news content changes frequently and the sources' CDNs handle their own caching."
);

// ═══════════════════════════════════════════════════════════════════════════════
// 13 — CARD SCANNER
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("13 — Card Scanner (dHash Visual Fingerprinting)", "49,191 artworks indexed — Delver Lens approach");

h2("Why dHash Instead of OCR");
body(
  "MTG uses stylised fonts that Tesseract.js misreads frequently. The dHash approach (used by " +
  "Delver Lens) identifies cards by their artwork's visual fingerprint rather than text. " +
  "It works with any card orientation or lighting as long as the artwork is visible."
);

h2("Algorithm");
code([
  "1. Crop the artwork region from camera frame:",
  "   artX = 7%  artY = 14%  artW = 86%  artH = 43%  (of video dimensions)",
  "",
  "2. Resize crop to 9 × 8 pixels, convert to greyscale",
  "",
  "3. For each of 8 rows, compare each pixel to its right neighbour:",
  "   bit = 1 if left pixel is brighter, 0 otherwise",
  "   → 64 bits total, encoded as 16-character hex string",
  "   → Example: 'a3f1b2e4c9d07851'",
  "",
  "4. Compute Hamming distance to every entry in the hash index:",
  "   distance ≤ 10  → strong match  → show card immediately",
  "   distance 11-20 → weak match    → show picker (top 5 candidates)",
  "   distance > 20  → no match      → fall back to OCR (Tesseract.js)",
]);

h2("Key Files");
row("src/lib/scan/dhash.ts",               "Shared dHash math — dHashFromRaw, hammingDistance, findMatches");
row("src/app/api/scan/search/route.ts",    "POST endpoint — resizes with sharp, hashes, searches index");
row("scripts/build-hash-index.mjs",        "One-time CLI builder — downloads Scryfall bulk, hashes all artworks");
row("public/card-hashes.json",             "Pre-built index (4.8 MB, 49,191 unique artworks — committed to repo)");
row("src/hooks/useCameraScanner.ts",       "React hook — camera, client-side dHash, API calls, OCR fallback");
row("src/components/scan/ScanPageClient.tsx", "Camera UI — guide overlay, scan list, matched card panel");

h2("Index File Format");
code([
  "{",
  "  version:   1,",
  "  generated: '2026-04-17T02:14:39.002Z',",
  "  count:     49191,",
  "  cards: [",
  "    { id: 'scryfall-uuid', n: 'Card Name', s: 'set', h: 'a3f1b2e4c9d07851' },",
  "    ...",
  "  ]",
  "}",
]);

h2("OCR Fallback");
body(
  "If the hash index is absent or no match within distance 20 is found, Tesseract.js is " +
  "lazy-loaded (~4 MB download on first use) and runs OCR on a 4× upscaled greyscale crop " +
  "of the card's name bar region. The result is sent to Scryfall's fuzzy name API."
);

// ═══════════════════════════════════════════════════════════════════════════════
// 14 — ENVIRONMENT VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("14 — Environment Variables", "All required keys, where to set them, and their purpose");

h2("Complete Variable Reference");

const envs = [
  { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", secret: false, where: "Vercel dashboard + .env.local",
    desc: "Clerk public key — initialises Clerk's browser SDK. Safe to expose." },
  { name: "CLERK_SECRET_KEY", secret: true, where: "Vercel dashboard ONLY",
    desc: "Clerk server key — validates sessions in API routes. NEVER expose to browser." },
  { name: "NEXT_PUBLIC_CLERK_SIGN_IN_URL", secret: false, where: ".env.local",
    desc: "Path to sign-in page. Value: /sign-in" },
  { name: "NEXT_PUBLIC_CLERK_SIGN_UP_URL", secret: false, where: ".env.local",
    desc: "Path to sign-up page. Value: /sign-up" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", secret: false, where: "Vercel dashboard + .env.local",
    desc: "Supabase project URL. Format: https://{ref}.supabase.co — safe to expose." },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", secret: false, where: "Vercel dashboard + .env.local",
    desc: "Supabase anon key — kept for reference, not actively used in app code." },
  { name: "SUPABASE_SERVICE_ROLE_KEY", secret: true, where: "Vercel dashboard ONLY",
    desc: "Full Supabase access. Used server-side only. NEVER expose to client." },
  { name: "NEXT_PUBLIC_FORMSPREE_URL", secret: false, where: "Vercel dashboard + .env.local",
    desc: "Formspree endpoint for the feedback form in Settings." },
  { name: "JUSTTCG_API_KEY", secret: true, where: "Vercel dashboard ONLY",
    desc: "JustTCG pricing API key. Server-only. App degrades gracefully without it." },
];

envs.forEach(({ name, secret, where, desc }) => {
  checkRoom(44);
  const y = cy();
  doc.save();
  doc.rect(ML, y, TW, 40).fill(C.panel);
  const dot = secret ? C.red : C.green;
  doc.circle(ML + 10, y + 9, 4).fill(dot);
  doc.font("Courier-Bold").fontSize(8).fillColor(dot)
     .text(name, ML + 20, y + 4, { width: TW - 24, lineBreak: false });
  doc.font("Helvetica").fontSize(7.5).fillColor(C.muted)
     .text((secret ? "⚠ SECRET  " : "✓ Public  ") + "Set in: " + where, ML + 20, y + 17, { width: TW - 24, lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(C.light)
     .text(desc, ML + 20, y + 28, { width: TW - 24, lineBreak: false });
  doc.restore();
  doc.y = y + 44;
  gap(2);
});

h2("Setting Variables on Vercel");
body(
  "vercel.com → Your Project → Settings → Environment Variables. " +
  "Add each variable, select environments (Production, Preview, Development), and save. " +
  "Secret variables (marked ⚠) should only exist in Vercel — never committed to the repo."
);

h2("Local Development (.env.local)");
body(
  "The .env.local file in the project root is loaded automatically by Next.js during development. " +
  "It is listed in .gitignore and must NEVER be committed to the repository."
);

// ═══════════════════════════════════════════════════════════════════════════════
// 15 — MAINTENANCE SCHEDULE
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
band("15 — Maintenance Schedule", "What needs running, when, and what maintains itself");

h2("New Set Release  (Every ~3 Months)");
body(
  "When Wizards releases a new MTG set, the card hash index must be updated so the scanner " +
  "recognises the new artworks. This is the only recurring manual maintenance task."
);
code([
  "# Step 1 — Add new set artworks to the index (takes ~2 minutes)",
  "cd C:/Users/danlo/MTG-app",
  "SET_CODE=xxx RESUME=true node scripts/build-hash-index.mjs",
  "# Replace xxx with the set code, e.g.: fdn  dsk  mh3  blb",
  "",
  "# Step 2 — Commit and push (Vercel auto-deploys in ~2 minutes)",
  "git add public/card-hashes.json",
  "git commit -m 'feat: add [SET NAME] artworks to hash index'",
  "git push origin main",
]);

h2("Full Index Rebuild  (Only If Needed)");
body("Only required if the index file is lost, corrupted, or you want a clean rebuild from scratch.");
code([
  "# Full rebuild — ~45-60 minutes, downloads all ~200MB of Scryfall bulk data",
  "node scripts/build-hash-index.mjs",
  "",
  "# Resume a previously interrupted build",
  "RESUME=true node scripts/build-hash-index.mjs",
]);

h2("Everything Else is Automatic");
bullet([
  "Card prices (Scryfall)     — fetched live, cached 24h at Vercel edge",
  "Card Kingdom prices (MTGJSON) — fetched live per set, cached 24h",
  "JustTCG prices             — fetched live, cached 1h",
  "17Lands draft stats        — fetched live, cached 1h. Always current.",
  "Commander Spellbook combos — Supabase TTL cache auto-refreshes on expiry",
  "News feeds                 — client-side fetch on each page load",
  "Card search / autocomplete — proxied live to Scryfall (5 min cache)",
  "Card images                — served from Scryfall CDN, no local copies needed",
  "Clerk auth                 — managed SaaS, no maintenance needed",
  "Supabase database          — managed PostgreSQL, auto-backups by Supabase",
  "Vercel deployment          — every push to main triggers auto-deploy",
  "combo_cache table          — self-cleaning: expired rows are simply never queried",
]);

h2("Troubleshooting Quick Reference");
row("Scanner not recognising new cards",  "Run SET_CODE=xxx RESUME=true node scripts/build-hash-index.mjs");
row("public/card-hashes.json missing",    "Run full rebuild: node scripts/build-hash-index.mjs");
row("Prices not loading",                 "Check Vercel function logs for MTGJSON / Scryfall errors");
row("Combos not showing",                 "Check Supabase combo_cache — may have stale data from API changes");
row("Login not working",                  "Check Clerk dashboard for suspended accounts or key issues");
row("Build failing on Vercel",            "Check Vercel deploy logs — usually a TypeScript error in recent commit");
row("Scanner falls back to OCR always",   "Verify public/card-hashes.json is in repo and > 4 MB");

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK REFERENCE — final page
// ═══════════════════════════════════════════════════════════════════════════════

newPage();
doc.font("Helvetica-Bold").fontSize(20).fillColor(C.accent)
   .text("Quick Reference Card", ML, cy(), { width: TW });
gap(4);
rule(C.accent);

h2("Services & URLs");
row("GitHub Repo",  "github.com/dlopez2392/MTG-app");
row("Vercel App",   "vercel.com/dlopez2392/MTG-app  (Deployments + Logs + Env Vars)");
row("Clerk",        "clerk.com  — user accounts, auth config");
row("Supabase",     "supabase.com  — database tables, SQL editor, backups");
row("JustTCG",      "justtcg.com  — API key management");

h2("All API Routes");
row("Card search",   "GET  /api/scryfall/search?q=&page=&order=");
row("Card by ID",    "GET  /api/scryfall/cards/[id]");
row("Card by name",  "GET  /api/scryfall/named?fuzzy=");
row("Autocomplete",  "GET  /api/scryfall/autocomplete?q=");
row("Combos",        "GET  /api/combos?name=");
row("CK prices",     "GET  /api/mtgjson/prices?set=&scryfallId=");
row("Draft stats",   "GET  /api/17lands?set=&name=");
row("JustTCG",       "GET  /api/justtcg/prices?name=");
row("Hash scanner",  "POST /api/scan/search  body: { image: 'data:image/jpeg;base64,...' }");

h2("Critical Files");
row("Root layout",       "src/app/layout.tsx             — ClerkProvider wrapper");
row("Auth middleware",   "src/middleware.ts              — clerkMiddleware()");
row("Supabase client",   "src/lib/supabase/server.ts    — getSupabase() with service role");
row("IndexedDB schema",  "src/lib/db/index.ts           — Dexie table definitions");
row("dHash utilities",   "src/lib/scan/dhash.ts         — hammingDistance, findMatches");
row("Hash index",        "public/card-hashes.json       — 49k artworks, 4.8 MB");
row("Index builder",     "scripts/build-hash-index.mjs  — run when new sets release");

h2("Secret Environment Variables  (Vercel only — never commit)");
code([
  "CLERK_SECRET_KEY             # Clerk server-side auth",
  "SUPABASE_SERVICE_ROLE_KEY    # Full Supabase DB access",
  "JUSTTCG_API_KEY              # JustTCG pricing API",
]);

h2("Hash Index Maintenance");
code([
  "# New set (run every ~3 months when sets release):",
  "SET_CODE=xxx RESUME=true node scripts/build-hash-index.mjs",
  "git add public/card-hashes.json && git commit -m 'update index' && git push",
]);

// Disclaimer
gap(20);
rule();
doc.font("Helvetica").fontSize(7).fillColor(C.muted)
   .text(
     "MTG Houdini is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. " +
     "Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.",
     ML, cy(), { width: TW, align: "center", lineGap: 2 }
   );

doc.end();
console.log("✅  PDF written to:", OUT);
