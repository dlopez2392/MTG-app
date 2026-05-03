# MTG Houdini — Architecture & Integration Index

> Machine-readable reference for Claude Code.  
> Generated: 2026-05-03 | Repo: github.com/dlopez2392/MTG-app | Host: Vercel

---

## META

| Key | Value |
|-----|-------|
| App name | MTG Houdini |
| Framework | Next.js 16.2.2 (App Router) |
| React | 19.2.4 |
| Language | TypeScript 5 strict |
| Styling | Tailwind CSS v4 |
| Node.js required | ≥18.18 (v24 in prod) |
| Repo | github.com/dlopez2392/MTG-app |
| Branch | main (push = prod deploy) |
| Deployed at | Vercel (auto-deploy) |
| Local dev port | 3001 (`npm run dev`) |
| Package manager | npm |

---

## STACK DEPENDENCIES

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.2.2 | Framework |
| react / react-dom | 19.2.4 | UI |
| @clerk/nextjs | ^7.0.12 | Authentication |
| @supabase/supabase-js | ^2.103.0 | Cloud database |
| dexie / dexie-react-hooks | ^4.4.2 | IndexedDB (local/guest) |
| sharp | ^0.34.5 | Server-side image processing (dHash) |
| tesseract.js | ^7.0.0 | OCR fallback (lazy-loaded) |
| openai | ^4.x | DeepSeek API client (OpenAI SDK pointed at api.deepseek.com) |
| recharts | ^3.8.1 | Mana curve + win-rate charts |
| tailwindcss | ^4 | Styling |
| uuid | ^13.0.0 | ID generation |
| pdfkit | dev | Docs generator only |

---

## ENVIRONMENT VARIABLES

### Secrets (Vercel dashboard only — NEVER commit)

| Variable | Service | Notes |
|----------|---------|-------|
| `CLERK_SECRET_KEY` | Clerk | Validates sessions in API routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Full DB access, server-side only |
| `JUSTTCG_API_KEY` | JustTCG | Condition pricing API, optional |
| `DEEPSEEK_API_KEY` | DeepSeek | AI features (deck coach, combo discovery, deck builder, etc.) |
| `GEMINI_API_KEY` | Google | Legacy scanner fallback — no longer called by frontend |

### Public (Vercel + .env.local)

| Variable | Value / Notes |
|----------|--------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser SDK init |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jffcyqwhfbegnctpdzpn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Kept for reference, not used in app code |
| `NEXT_PUBLIC_FORMSPREE_URL` | Feedback form endpoint |

---

## FILE MAP — Critical Paths

```
src/
├── app/
│   ├── layout.tsx                        ClerkProvider wrapper, root layout
│   ├── page.tsx                          Home / HeroBanner
│   ├── search/
│   │   ├── page.tsx                      Search page
│   │   └── [id]/page.tsx                 Card detail page
│   ├── collection/
│   │   ├── page.tsx                      Binder list
│   │   └── [binderId]/page.tsx           Binder detail
│   ├── decks/
│   │   ├── page.tsx                      Deck list
│   │   ├── new/page.tsx                  New deck
│   │   ├── ai-builder/page.tsx           AI Deck Builder
│   │   ├── matchup/page.tsx              Matchup Analysis
│   │   └── [deckId]/
│   │       ├── page.tsx                  Deck editor
│   │       └── stats/page.tsx            Deck statistics
│   ├── scan/page.tsx                     Card scanner
│   ├── life/page.tsx                     Life counter
│   ├── news/page.tsx                     News feed
│   ├── games/
│   │   ├── page.tsx                      Game log
│   │   └── analytics/page.tsx            Game analytics + AI insights
│   ├── packages/page.tsx                 Staple card bundles
│   ├── rules/page.tsx                    MTG rules reference
│   ├── wishlist/page.tsx                 Wishlist
│   ├── settings/page.tsx                 Settings + about
│   ├── sign-in/[[...sign-in]]/page.tsx   Clerk sign-in
│   ├── sign-up/[[...sign-up]]/page.tsx   Clerk sign-up
│   └── api/                              ← All API routes below
│
├── middleware.ts                         clerkMiddleware() — all routes, non-blocking
│
├── lib/
│   ├── db/index.ts                       Dexie schema (IndexedDB)
│   ├── supabase/server.ts                getSupabase() — service role client
│   ├── scryfall/client.ts                searchCards() and other Scryfall helpers
│   ├── deepseek/client.ts               getDeepSeek() — OpenAI SDK → api.deepseek.com
│   ├── scan/dhash.ts                     dHash math — dHashFromRaw, hammingDistance, findMatches
│   ├── news/feeds.ts                     RSS feed definitions (8 sources)
│   ├── news/rss.ts                       RSS parser
│   ├── ocr/cardNameExtractor.ts          Image preprocessing for Tesseract
│   ├── packages/staples.ts               Staple card data
│   └── utils/
│       ├── cn.ts                         clsx + tailwind-merge
│       ├── csv.ts                        Deck import/export
│       ├── deckParser.ts                 Parse deck text format
│       ├── deckStats.ts                  Mana curve, colour distribution
│       ├── legality.ts                   Format legality helpers
│       ├── mana.ts                       Mana symbol rendering
│       └── prices.ts                     Price formatting
│
├── hooks/
│   ├── useCameraScanner.ts               Camera + dHash + OCR scanner hook
│   ├── useCardSearch.ts                  Scryfall search with debounce
│   ├── useCardDetail.ts                  Single card fetch
│   ├── useAutocomplete.ts                Name autocomplete (300ms debounce)
│   ├── useCollection.ts                  Binder CRUD (Supabase or Dexie)
│   ├── useCollectionMap.ts               scryfallId → collected qty map
│   ├── useDecks.ts                       Deck CRUD (Supabase or Dexie)
│   ├── useCardCombos.ts                  Commander Spellbook fetch
│   ├── useLifeCounter.ts                 Life counter state
│   ├── useGameLog.ts                     Game history (IndexedDB)
│   ├── useWishlist.ts                    Wishlist (IndexedDB)
│   ├── useSettings.ts                    App settings (localStorage)
│   ├── useValueHistory.ts                Collection value history
│   ├── useDebounce.ts                    Generic debounce hook
│   └── useToast.ts                       Toast notifications
│
├── components/
│   ├── layout/
│   │   ├── BottomNav.tsx                 Mobile bottom navigation
│   │   └── HeroBanner.tsx                Home page hero (z-20 for dropdown stacking)
│   ├── cards/
│   │   ├── CardImage.tsx                 Card image with sizes
│   │   ├── CardPricesPanel.tsx           Scryfall + CK + CardMarket prices
│   │   └── DraftStatsPanel.tsx           17Lands stats with win-rate bars
│   ├── decks/
│   │   ├── AIDeckBuilderClient.tsx       AI deck builder form + results + save flow
│   │   ├── DecksPageClient.tsx           Deck list with search/filter
│   │   ├── DeckStatsClient.tsx           Deck stats, mana curve, AI coach, combos
│   │   └── stats/
│   │       └── ComboDiscovery.tsx        AI combo analysis component
│   ├── games/
│   │   ├── GameAnalyticsClient.tsx       Win-rate charts, opponent records, AI insights
│   │   └── GameInsights.tsx              AI game history analysis component
│   ├── scan/
│   │   └── ScanPageClient.tsx            Full camera UI
│   ├── search/
│   │   └── SearchAutocomplete.tsx        Dropdown (z-50 above tabs z-10)
│   ├── settings/
│   │   └── SettingsPageClient.tsx        Settings + WotC disclaimer
│   └── ui/
│       └── Modal.tsx                     Generic modal component
│
├── types/
│   ├── card.ts                           ScryfallCard interface
│   ├── collection.ts                     Binder, CollectionCard
│   ├── combo.ts                          EnrichedCombo, CombosResponse
│   ├── deck.ts                           Deck, DeckCard, DeckFolder
│   ├── game.ts                           Game log entry
│   ├── life.ts                           LifeGame
│   ├── settings.ts                       AppSettings
│   └── wishlist.ts                       WishlistItem
│
└── (root)
    ├── scripts/build-hash-index.mjs      One-time card hash index builder
    ├── scripts/generate-docs.mjs         PDF doc generator
    ├── public/card-hashes.json           49,191 card artwork hashes (4.8 MB)
    ├── next.config.ts                    Image domains: cards.scryfall.io
    ├── .env.local                        Local dev secrets (gitignored)
    └── docs/architecture.md             ← THIS FILE
```

---

## API ROUTES

### Scryfall (proxy — no API key, free)

| Route | Method | Params | Cache | Returns |
|-------|--------|--------|-------|---------|
| `/api/scryfall/search` | GET | `q, page, order, dir, unique` | 5 min | ScryfallList |
| `/api/scryfall/named` | GET | `fuzzy` or `exact` | 24h | ScryfallCard |
| `/api/scryfall/autocomplete` | GET | `q` | 1 min | string[] |
| `/api/scryfall/suggest` | GET | `q` | 1 min | CardScanSuggestion[] |
| `/api/scryfall/cards/[id]` | GET | — | 24h | ScryfallCard |
| `/api/scryfall/sets` | GET | — | 24h | ScryfallSet[] |
| `/api/scryfall/rulings/[id]` | GET | — | 24h | ScryfallRuling[] |
| `/api/scryfall/image-proxy` | GET | `url` | — | image stream |

### Pricing

| Route | Method | Params | Cache | Returns |
|-------|--------|--------|-------|---------|
| `/api/mtgjson/prices` | GET | `set, scryfallId` | 24h | `{ cardKingdom, cardmarket }` |
| `/api/justtcg/prices` | GET | `name` | 1h | `{ configured, data }` |

### Draft Analytics

| Route | Method | Params | Cache | Returns |
|-------|--------|--------|-------|---------|
| `/api/17lands` | GET | `set, name` | 1h | `{ format, set, stats }` |

### Combos

| Route | Method | Params | Cache | Returns |
|-------|--------|--------|-------|---------|
| `/api/combos` | GET | `name` | Supabase 24h TTL | `{ combos[], count }` |

### AI Features (DeepSeek V4 Flash)

| Route | Method | Body | Returns |
|-------|--------|------|---------|
| `/api/rules-qa` | POST | `{ question }` | AI rules answer |
| `/api/card-alternatives` | POST | `{ cardName, ... }` | Budget/similar card suggestions |
| `/api/matchup-analysis` | POST | `{ deck1, deck2 }` | Head-to-head analysis |
| `/api/bracket-analysis` | POST | `{ cards }` | Draft pick analysis |
| `/api/deck-coach` | POST | `{ deckName, cards }` | Deck improvement advice with grades |
| `/api/combo-discovery` | POST | `{ deckName, cards }` | Infinite/synergy combos + near-miss pieces |
| `/api/game-insights` | POST | `{ entries: GameEntry[] }` | Patterns, deck verdicts, focus area |
| `/api/ai-deck-builder` | POST | `{ format, commander?, budget?, strategy, colors? }` | Full validated decklist via Scryfall |

All AI routes use `getDeepSeek()` from `src/lib/deepseek/client.ts` (OpenAI SDK pointed at `api.deepseek.com`).  
Model: `deepseek-v4-flash` for all routes. Response format: `{ type: "json_object" }`.  
AI Deck Builder additionally validates every card against Scryfall `/cards/collection` POST endpoint (batches of 75).

### Card Scanner (legacy — no longer called by frontend)

| Route | Method | Body | Returns |
|-------|--------|------|---------|
| `/api/scan/identify` | POST | `{ image: "data:image/jpeg;base64,..." }` | Gemini vision card ID (unused) |
| `/api/scan/search` | POST | `{ image: "data:image/jpeg;base64,..." }` | `{ indexed, hash, matches[] }` |

### Collection & Decks (all require Clerk auth)

| Route | Method | Notes |
|-------|--------|-------|
| `/api/binders` | GET, POST | List/create binders |
| `/api/binders/[id]` | GET, PATCH, DELETE | Single binder |
| `/api/binders/[id]/cards` | GET, POST | Cards in binder |
| `/api/binders/[id]/cards/[cardId]` | PATCH, DELETE | Single card in binder |
| `/api/binders/cards` | GET | All cards across all binders |
| `/api/decks` | GET, POST | List/create decks |
| `/api/decks/[id]` | GET, PATCH, DELETE | Single deck |
| `/api/decks/[id]/cards` | GET, POST | Cards in deck |
| `/api/decks/[id]/cards/[cardId]` | PATCH, DELETE | Single card in deck |
| `/api/collection-cards/[cardId]` | PATCH, DELETE | Direct collection card update |
| `/api/deck-cards/[cardId]` | PATCH, DELETE | Direct deck card update |

### Other

| Route | Method | Notes |
|-------|--------|-------|
| `/api/news` | GET | RSS feed aggregation |

---

## AUTHENTICATION — CLERK

```
Flow:
  Browser → <ClerkProvider> (layout.tsx)
         → clerkMiddleware() (middleware.ts) — validates JWT, non-blocking
         → auth() in API routes → { userId }
         → userId used as WHERE user_id = ? in ALL Supabase queries

Guest mode: userId = null → API routes return 401 → hooks fall back to Dexie
Signed-in:  userId = "user_2abc..." → data stored in Supabase
```

- Sign-in page: `/sign-in` (Clerk hosted UI component)
- Sign-up page: `/sign-up` (Clerk hosted UI component)
- No custom JWT claims needed
- userId is the ONLY link between Clerk and Supabase — no users table in Supabase

---

## DATABASE — SUPABASE

### Connection Pattern

```typescript
// src/lib/supabase/server.ts — used in EVERY API route
import { createClient } from "@supabase/supabase-js";
export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-side only
  );
}
```

### Tables

#### binders
```
id              uuid PK
user_id         text  (Clerk userId — scopes ALL queries)
name            text
description     text
cover_image_uri text
created_at      timestamptz
updated_at      timestamptz
```

#### collection_cards
```
id               uuid PK
user_id          text
binder_id        uuid FK→binders
scryfall_id      text
name             text
quantity         int
set_code         text
set_name         text
collector_number text
image_uri        text
price_usd        text
type_line        text
rarity           text
is_foil          boolean
created_at       timestamptz
```

#### decks
```
id             uuid PK
user_id        text
name           text
format         text
cover_card_id  text
cover_image_uri text
created_at     timestamptz
updated_at     timestamptz
```

#### deck_cards
```
id           uuid PK
user_id      text
deck_id      uuid FK→decks
scryfall_id  text
name         text
quantity     int
category     text  (main | side | commander | maybe)
mana_cost    text
type_line    text
image_uri    text
created_at   timestamptz
```

#### combo_cache
```
card_name   text PK
combos      jsonb  (EnrichedCombo[])
count       int
cached_at   timestamptz
expires_at  timestamptz  (TTL: cached_at + 24h)
```

### Security Model
- Service role key bypasses Postgres RLS
- Application-layer scoping: every query has `.eq("user_id", userId)`
- userId comes from Clerk `auth()` — validated by Clerk middleware before route runs

---

## DATABASE — DEXIE (INDEXEDDB)

```typescript
// src/lib/db/index.ts
// Database name: "mtg-houdini"

// v1
decks:           ++id, name, format, folderId, createdAt
deckCards:       ++id, deckId, scryfallId, name, category
deckFolders:     ++id, name, parentId
binders:         ++id, name, createdAt
collectionCards: ++id, binderId, scryfallId, name
lifeGames:       ++id, createdAt

// v2 migration
decks: added updatedAt index
```

**Routing logic:** hooks check Clerk `userId` — if signed in → Supabase API; if guest → Dexie direct  
**Life counter:** always uses Dexie regardless of auth state  
**No auto-sync:** guest data stays local; signed-in data stays in Supabase

---

## CARD SCANNER — DHASH

### Algorithm
```
Input: Camera video frame (or uploaded image)

1. Crop artwork region:
   artX = videoWidth  × 0.07
   artY = videoHeight × 0.14
   artW = videoWidth  × 0.86
   artH = videoHeight × 0.43

2. Resize crop to 9×8 pixels, greyscale

3. For each row (y=0..7), compare pixel[x] vs pixel[x+1]:
   bit = 1 if left > right, else 0
   → 64 bits encoded as 16-char hex string

4. Hamming distance against index entries:
   ≤10  → strong match  → fetch card from Scryfall, show result
   ≤20  → weak match    → show picker (top 5 by distance)
   >20  → no match      → OCR fallback (Tesseract.js)
```

### Hash Index

| Property | Value |
|----------|-------|
| File | `public/card-hashes.json` |
| Size | 4.8 MB |
| Entries | 49,191 unique artworks |
| Format | `{ version, generated, count, cards: [{id, n, s, h}] }` |
| Loading | Module-level cache in `/api/scan/search/route.ts` |
| Source | Scryfall `default_cards` bulk + art_crop images |

### Key Files

| File | Role |
|------|------|
| `src/lib/scan/dhash.ts` | `dHashFromRaw()`, `hammingDistance()`, `findMatches()` |
| `src/app/api/scan/search/route.ts` | POST endpoint — sharp resize → hash → index search |
| `src/hooks/useCameraScanner.ts` | Camera feed, client-side dHash, API call, OCR fallback |
| `src/components/scan/ScanPageClient.tsx` | Camera UI, guide overlay, scan list |
| `scripts/build-hash-index.mjs` | One-time builder — run per new set |
| `public/card-hashes.json` | Pre-built index committed to repo |

### Hook API — useCameraScanner
```typescript
returns: {
  videoRef, canvasRef,
  isStreaming, isProcessing,
  statusText,       // e.g. "Computing visual hash…" | "Match found!" | ""
  suggestions,      // CardScanSuggestion[] — shown as picker
  matchedCard,      // ScryfallCard | null
  error,            // string
  hasHashIndex,     // boolean — probed on mount
  scanList,         // ScanListItem[]
  totalValue,       // number
  addToScanList, removeFromScanList, updateScanListQty, toggleItemFoil, clearScanList,
  autoScan, setAutoScan,
  startCamera, stopCamera, captureAndRecognize, selectSuggestion, reset,
}
```

---

## EXTERNAL API INTEGRATIONS

### DeepSeek
- Base URL: `https://api.deepseek.com` (via OpenAI SDK)
- Auth: `DEEPSEEK_API_KEY` (Bearer token)
- Model: `deepseek-v4-flash` ($0.14/M input tokens)
- Used for: 8 AI routes (rules QA, card alternatives, matchup analysis, bracket analysis, deck coach, combo discovery, game insights, deck builder)
- Client: `src/lib/deepseek/client.ts` — singleton OpenAI instance
- All responses use `response_format: { type: "json_object" }` for structured output

### Scryfall
- Base URL: `https://api.scryfall.com`
- Auth: none
- Rate limit: 10 req/s recommended (debounced in UI, 100ms batch delay in builder)
- Docs: scryfall.com/docs/api

### Commander Spellbook
- Base URL: `https://backend.commanderspellbook.com/variants/`
- Auth: none
- Query: `?q=card:"Name"&ordering=-popularity&limit=50`
- Cache: Supabase `combo_cache` table, 24h TTL
- Filter: `status in (OK, PREVIEW) AND spoiler = false`

### MTGJSON
- Base URL: `https://mtgjson.com/api/v5/{SET}.json`
- Auth: none
- Data: full set JSON with `cards[].identifiers.scryfallId` and `cards[].prices.paper`
- Cache: `next: { revalidate: 86400 }` — 24h entire set file
- Price extraction: `Object.keys(priceMap).sort()` → last date = current price

### 17Lands
- Base URL: `https://www.17lands.com/card_ratings/data`
- Auth: none
- Params: `?expansion=SET&format=FORMAT`
- Formats tried: PremierDraft → QuickDraft → TradDraft
- Cache: `next: { revalidate: 3600 }` — 1h
- License: CC BY 4.0 (attribution in DraftStatsPanel)

### JustTCG
- Base URL: `https://api.justtcg.com/v1/products`
- Auth: `X-API-Key: JUSTTCG_API_KEY`
- Params: `?name=NAME&game=mtg&limit=10`
- Cache: `next: { revalidate: 3600 }` — 1h
- Graceful degradation: returns `{ configured: false }` if key absent

### News RSS Feeds (client-side fetch, no proxy)
| Key | Source URL |
|-----|-----------|
| wizards | magic.wizards.com/en/rss/news |
| tcgplayer | infinite.tcgplayer.com/rss |
| edhrec | edhrec.com/articles/feed/ |
| mtggoldfish | mtggoldfish.com/news/rss |
| arenazone | mtgazone.com/feed/ |
| hipsters | hipstersofthecoast.com/feed/ |
| starcitygames | articles.starcitygames.com/feed/ |
| channelfireball | channelfireball.com/feed/ |
Default enabled: wizards, tcgplayer, edhrec, mtggoldfish, arenazone, hipsters

---

## VERCEL DEPLOYMENT

### Settings
| Setting | Value |
|---------|-------|
| Framework | Next.js (auto-detected) |
| Build command | `next build` |
| Output directory | `.next` |
| Install command | `npm install` |
| Node.js version | 20.x |
| Root directory | `/` |
| Production branch | `main` |

### Deploy Flow
```
git push origin main
  → GitHub webhook fires
  → npm install (includes sharp native binary)
  → next build (TypeScript compile + route generation)
  → env vars injected from Vercel dashboard
  → Deploy to Vercel CDN → live in ~2 min
```

### Static Files
`public/card-hashes.json` is committed to the repo and deployed as a static file.  
The API route `/api/scan/search` loads it into module-level memory once per function instance.

### Manual Redeploy
```bash
git commit --allow-empty -m "chore: trigger redeploy" && git push origin main
```

---

## MAINTENANCE TASKS

### New Set Release (~every 3 months) — MANUAL
```bash
# Step 1: add new set artworks to hash index (~2 min)
SET_CODE=xxx RESUME=true node scripts/build-hash-index.mjs

# Step 2: commit + push (auto-deploys to Vercel)
git add public/card-hashes.json
git commit -m "feat: add [SET NAME] artworks to hash index"
git push origin main
```

### Full Index Rebuild — only if index lost/corrupted
```bash
node scripts/build-hash-index.mjs          # ~45-60 min
RESUME=true node scripts/build-hash-index.mjs  # resume if interrupted
```

### Build Script Options
| Env var | Example | Effect |
|---------|---------|--------|
| `SET_CODE` | `SET_CODE=dsk` | Index only that one set (~2 min) |
| `RESUME` | `RESUME=true` | Keep existing entries, only add new |
| `CONCURRENCY` | `CONCURRENCY=10` | Parallel image downloads (default 10) |

### Automatic (no action needed)
| Data | How it stays fresh |
|------|--------------------|
| Scryfall card data | Live fetch, 24h edge cache |
| MTGJSON CK prices | Live fetch per set, 24h edge cache |
| JustTCG prices | Live fetch, 1h edge cache |
| 17Lands draft stats | Live fetch, 1h edge cache |
| Combos | Supabase TTL cache auto-expires at 24h |
| News feeds | Client-side fetch on each page load |
| Clerk auth | Managed SaaS — no maintenance |
| Supabase DB | Managed PostgreSQL — auto-backups |
| Vercel deploys | Triggered by git push — no manual action |

---

## KEY DECISIONS & GOTCHAS

| Topic | Decision / Gotcha |
|-------|-------------------|
| Auth pattern | `auth()` from `@clerk/nextjs/server` — async, must be awaited |
| Supabase access | Server-only via service role key — never initialise client in browser |
| Route params | Use `request.nextUrl.searchParams` NOT `new URL(request.url).searchParams` |
| Z-index stacking | HeroBanner content: `z-20`, tab bar: `z-10`, dropdown: `z-50`, scanner overlay: `z-55` |
| Card scanner | Guide box covers artwork region (86%×43%), NOT the name bar |
| OCR | Tesseract lazy-loaded — only downloaded on first OCR fallback (~4 MB) |
| Guest vs auth | Life counter always uses Dexie; collection/decks switch based on userId |
| Hash index | Committed to repo as static file — no CDN or DB needed |
| combo_cache | Never auto-deletes — old rows just never get queried (expires_at filter) |
| Windows dev | Use `cmd //c` prefix for commands with `/F` flag in Git Bash |
| Image config | Allowed hostnames: `cards.scryfall.io`, `svgs.scryfall.io` in next.config.ts |
| Sharp | Native module — included in `dependencies` (not devDependencies) for Vercel |
| AI provider | DeepSeek V4 Flash via OpenAI SDK — migrated from Gemini 2.5 Flash (rate limits) |
| AI deck builder | Scryfall `/cards/collection` batch validation (75/req) — not individual lookups |
| Scanner AI | Frontend uses client-side dHash + OCR, not AI API — zero API cost per scan |
| Game insights | Gated on 3+ games in analytics page — avoids useless analysis on empty data |

---

## LEGAL

- Fan Content Policy: unofficial content permitted under WotC Fan Content Policy
- Scryfall: free public API, card data and images
- Commander Spellbook: free public API, combo data
- MTGJSON: free public data, no auth required
- 17Lands: CC BY 4.0 — attribution shown in DraftStatsPanel component
- JustTCG: paid API, key required, condition pricing data
- WotC disclaimer: shown in Settings/About page (SettingsPageClient.tsx)

---

*Last updated: 2026-05-03*
