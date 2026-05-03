@AGENTS.md

## Context Recovery

If you lose context or start a new session on this project, immediately read:

  docs/architecture.md

That file contains the full architecture index: tech stack, all file paths, every API route,
database schemas, environment variables, integrations, maintenance commands, and key gotchas.
It is the single source of truth for this project. Read it before asking the user for context.

---

## Project Overview

**MTG Houdini** — a full-featured Magic: The Gathering companion app.
- Version: 0.4.0
- Framework: Next.js 16 (App Router) + React 19 + TypeScript strict
- Styling: Tailwind CSS v4 with custom design tokens (violet accent `#7C5CFC`)
- Auth: Clerk (`@clerk/nextjs`)
- Database: Supabase PostgreSQL (service role key, application-layer RLS)
- Local/Guest: IndexedDB via Dexie, localStorage fallback
- Hosting: Vercel (push to main = production deploy)
- PWA: Installable on Android/iOS with service worker + manifest

---

## Key Patterns

### Hybrid Auth (Signed-in vs Guest)
Every data hook (`useDecks`, `useGameLog`, `usePlaygroup`, etc.) follows the same pattern:
- Signed in → fetch from `/api/*` routes (Supabase backend)
- Guest → localStorage or IndexedDB (Dexie)
- The `useUser()` hook from Clerk determines the mode

### API Routes
- All in `src/app/api/`
- Always start with `const { userId } = await auth();` from `@clerk/nextjs/server`
- All queries scoped with `.eq("user_id", userId)` — no Postgres RLS, app-layer only
- Supabase client: `getSupabase()` from `@/lib/supabase/server` (service role)

### Database Migrations
- Located in `supabase/migrations/` (001 through 006)
- Must be run manually in Supabase SQL Editor (no CLI installed)
- Current tables: `match_history`, `match_players`, `game_logs`, `trades`, `trade_cards`, `playgroup_members`, `user_profiles`, `decks`, `deck_cards`, `collection_binders`, `collection_cards`

### Component Conventions
- Client components use `"use client"` directive
- Dynamic imports with `{ ssr: false }` for heavy client pages
- `cn()` utility for className merging (clsx + tailwind-merge)
- Glass card style: `glass-card rounded-2xl border border-border`
- Gradient buttons: `btn-gradient` class
- Input fields: `input-base` class

### Design System
- Dark theme only (bg: `#0B0E14`)
- Accent: violet `#7C5CFC`
- Text colors: `text-text-primary`, `text-text-secondary`, `text-text-muted`
- Background tiers: `bg-bg-primary`, `bg-bg-card`, `bg-bg-hover`
- Border: `border-border`
- Status: `text-legal` (green), `text-banned` (red), `text-accent` (violet)

---

## Features by Area

| Area | Key Files | Notes |
|------|-----------|-------|
| Life Counter | `src/app/life/page.tsx` | Wake lock, fullscreen, orientation lock, game timer, poison, commander damage |
| Deck Editor | `src/components/decks/DeckEditor.tsx` | Moxfield-style grouping/sorting, compact card rows, value summary |
| Playgroup | `src/app/playgroup/page.tsx`, `src/hooks/usePlaygroup.ts` | Member CRUD, head-to-head stats, friend email search, account linking |
| Game Log | `src/app/games/page.tsx`, `src/hooks/useGameLog.ts` | Log results per deck, playgroup opponent chips |
| Game Analytics | `src/components/games/GameAnalyticsClient.tsx` | Win-rate charts, streaks, format/opponent stats, AI insights |
| Deck Stats | `src/components/decks/DeckStatsClient.tsx` | Mana curve, color pie, rarity, AI coach, opponent matchups |
| Combo Discovery | `src/components/decks/stats/ComboDiscovery.tsx` | AI finds infinite combos, synergies, near-miss pieces in decklist |
| AI Deck Builder | `src/components/decks/AIDeckBuilderClient.tsx` | Generate full decklist from constraints, Scryfall-validated, save to deck |
| AI Game Insights | `src/components/games/GameInsights.tsx` | AI analyzes game history for patterns, weak matchups, deck verdicts |
| Card Scanner | `src/components/scan/ScanPageClient.tsx` | Camera + dHash + OCR (client-side, no AI API) |
| Collection | `src/hooks/useCollection.ts` | Binders with card tracking |
| User Profiles | `src/app/api/profile/route.ts` | Auto-created from Clerk, discoverable opt-in |
| PWA | `src/app/manifest.ts`, `public/sw.js` | Installable, offline shell caching |
| Settings | `src/components/settings/SettingsPageClient.tsx` | Install app prompt, version changelog, display prefs |

---

## Common Tasks

### Run locally
```bash
npm run dev    # starts on port 3001
```

### Type check
```bash
npx tsc --noEmit
```

### Run a migration
Paste SQL into Supabase Dashboard → SQL Editor → Run

### Deploy
Push to `main` — Vercel auto-deploys

---

## Gotchas

- `params` in route handlers is a `Promise` in Next.js 16 — always `await params`
- Supabase uses snake_case columns; API routes transform to camelCase for the frontend
- `useEffect` dependencies: `isSignedIn` from Clerk can be `undefined` during SSR — always guard
- Screen Orientation API `lock()` not in TS types — cast through extended type
- Browser extensions can inject attributes causing harmless hydration warnings (not bugs)
- The `card-hashes.json` in public/ is 4.8MB — don't read it in Claude sessions
