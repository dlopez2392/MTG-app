# Design Modernization & Feature Roadmap — Design Spec

**Date:** 2026-07-08
**Status:** Approved by danlo
**Context:** Designer-aspect audit of MTG Houdini + combined design/feature roadmap.

## Goals & Constraints

- **Ambition:** public product someday — first-run experience, onboarding, and shareability matter.
- **Platform:** phone-first PWA; desktop must stop looking broken but stays secondary.
- **Cost:** near-free — current stack only (DeepSeek pennies, Supabase/Clerk/Vercel free tiers). No new paid services. Only new external calls are Moxfield/Archidekt public APIs.
- **Identity:** keep the existing visual identity (dark navy + orange/gold, Big Shoulders/Cinzel, glass cards). Modernize, don't redesign.

## Audit Findings (2026-07-08, v0.4.0)

### Strengths
- Distinctive visual identity; consistent component patterns (segmented tabs, FAB, empty states); safe-area handling; deep feature set (AI coach/combos/builder, realtime multiplayer life counter, trades, matchups).

### Gaps
1. **Desktop = stretched phone app.** Fixed ~576px column + mobile bottom tab bar on wide screens; life counter setup is inconsistently full-bleed (1400px-wide buttons).
2. **Loading states.** Card detail black-screens for seconds (no skeleton); search skeletons are bare gray boxes; no image-failure fallback (broken-img icon observed).
3. **Navigation IA.** ~29 routes in 5 tabs; "Ask Harry" holds a top-level slot while Search/Collection/Trades/Packages/Pods hide behind "More"/home grid; home page is a feature directory, not a dashboard.
4. **Contrast/hierarchy.** Muted text `#4E5364` on `#0B0E14` fails WCAG AA; labels over darkened art lack scrim; card detail spends first viewport on near-black art; floating orange back button overlaps titles.
5. **No motion system.** Abrupt transitions everywhere; no page transitions, micro-interactions, or animated numbers.

## Roadmap

Each phase is independently shippable. Each feature cluster applies the Phase 1 treatment (skeletons, motion, contrast) to its own screens as it lands.

### Phase 1 — Experience Foundation

- **1a. Loading & feedback system.** Shared skeleton family (shimmer; card/row/stat variants); card-detail skeleton layout (never black-screen); card-back placeholder for failed Scryfall images.
- **1b. Motion layer.** No new dependency: CSS + View Transitions API (Next 16 native). Page cross-fades, staggered card settle-in, animated number roll on life counter, FAB spring. `prefers-reduced-motion` guard throughout.
- **1c. Navigation IA.** Bottom nav → **Home / Search / Decks / Life / More**. Ask Harry moves to Home + persistent floating entry. "More" becomes a grouped sheet (Collection, Playgroup, Tools, Settings) — everything discoverable. Home converts to dashboard shell (content lands in 2d).
- **1d. Responsive desktop shell.** At `lg:`: bottom nav swaps for slim left sidebar rail; multi-column grids for search/deck lists; life counter setup gets max-width container.
- **1e. Consistency & contrast pass.** Muted text to WCAG AA; scrim behind text-over-art; retire floating back button for consistent header; align life counter to container system; discipline feature-icon palette.

### Phase 2 — Public Product Cluster (adoption & sharing)

- **2a. Deck import.** Paste Moxfield/Archidekt URL or text list (MTGA/MTGO/plain) → parse (`deckParser.ts` exists) → Scryfall batch validation (`/cards/collection`, 75/req) → import flow with per-card error review. #1 onboarding lever.
- **2b. Guest→account merge.** On first sign-in, detect Dexie data (decks/binders/wishlist), offer one-tap migration to Supabase. Non-destructive copy; local data retained until user confirms.
- **2c. Public deck sharing.** Per-deck share toggle → public read-only `/d/[slug]` page (commander art hero, decklist, mana curve, price) + Vercel OG auto-generated preview image for Discord/X unfurls.
- **2d. Home dashboard.** Greeting, collection value + 7-day movement, recent decks, win streak, latest-set countdown, news headline. Guests get same layout with "what this app does" content.

### Phase 3 — At-the-Table Cluster

- **3a. QR join for multiplayer life rooms.** Host displays QR; friends scan to join Realtime room. Tiny QR SVG lib (~2KB).
- **3b. Goldfish playtest mode.** Extend hand simulator: battlefield/graveyard/exile zones, tap-to-play, turn counter with auto-draw. (London mulligan already shipped 400e122.)
- **3c. Ban-list watchdog.** Parse B&R announcements from existing news RSS; cross-reference user decks; dashboard alert + PWA push ("X banned in Modern — 3 decks affected").

### Phase 4 — Intelligence Cluster

- **4a. Streaming, deck-aware Ask Harry.** Token streaming (DeepSeek supports SSE); deck context injection ("would this combo fit my Atraxa deck?").
- **4b. AI deck primers.** One tap → shareable primer (game plan, key lines, mulligan guide) rendered on the 2c public deck page.

## Error Handling & Testing Notes

- Image failures: every card image gets the fallback placeholder (1a) — applies app-wide.
- Import (2a): per-card validation errors surfaced in a review list, never silent drops; unrecognized lines kept editable.
- Merge (2b): copy-then-confirm; no deletion of Dexie data without explicit user action.
- Public pages (2c): no auth-gated data leakage — public route reads only decks flagged shared; OG route rate-limited by Vercel defaults.
- Push (3c): permission requested in-context (after user views an affected-deck alert), never on load.
- Verification: `npx tsc --noEmit` green per slice; visual checks phone-width first; `prefers-reduced-motion` verified for all Phase 1b work.

## Out of Scope (explicitly deferred)

- Card scanner revival (client-side not viable on mobile; Gemini vision fallback is a paid-ish path — revisit later).
- Full visual redesign / rebrand.
- Native app wrappers; paid AI providers.
