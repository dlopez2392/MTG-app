# AI Deck Primers (Phase 4b) — Design

**Date:** 2026-07-14
**Status:** Approved (danlo, 2026-07-14)
**Roadmap:** Phase 4 "Intelligence Cluster", sub-feature 4b. (4a streaming deck-aware Ask Harry is a separate later spec.)

## Problem / goal

Give each deck a one-tap, AI-generated **primer** — game plan, key cards, mulligan guide, key
lines — that the owner can generate and that renders on the deck's public share page
(`/d/[id]`) as a high-signal, shareable overview.

## Model

Owner generates once (DeepSeek, same pattern as the existing AI deck coach) → the primer is
**stored on the deck** → rendered both in the owner's deck view and on the public page. A
Regenerate button refreshes it.

## Data model (migration 012)

Add two columns to `decks`:
- `primer jsonb` — null until generated
- `primer_generated_at timestamptz` — null until generated

Primer JSON shape:
```json
{
  "tagline": "one-line archetype/hook",
  "gamePlan": "1-2 paragraphs: archetype, strategy, primary win condition(s)",
  "keyCards": [{ "name": "Card Name", "note": "why it matters" }],
  "mulligan": "what makes a keepable hand; what to look for / ship",
  "keyLines": ["important sequence / combo / interaction tip", "..."]
}
```

No RLS (app-layer, consistent with the rest of the app).

## API — `POST /api/deck-primer`

Mirrors `src/app/api/deck-coach/route.ts`:
1. `const { userId } = await auth()` → 401 if absent.
2. `rateLimit("ai:" + userId, 10, 60_000)` → 429.
3. If `!process.env.DEEPSEEK_API_KEY` → 503.
4. Body `{ deckId: string }`. Load the deck **scoped to userId** (`decks` + `deck_cards`,
   `.eq("user_id", userId)`); 404 if not found; 400 if no cards.
5. Build a decklist digest via the shared `buildDeckSummary` (see DRY below).
6. Call DeepSeek `deepseek-v4-flash`, `response_format: json_object`, temperature 0.7,
   system prompt = primer instructions + the format ban list (`formatBanListForPrompt`).
7. Parse JSON (strip ``` fences, tolerant parse like deck-coach).
8. Upsert `primer` + `primer_generated_at = now()` onto the deck row (scoped to userId).
9. Return the primer JSON.

Errors mirror deck-coach: parse/AI failure → 502.

## DRY improvement

`buildDeckSummary` currently lives inside `deck-coach/route.ts`. Extract it to
`src/lib/decks/summary.ts` (pure function, typed input) and have **both** `deck-coach` and
`deck-primer` import it. No behavior change to deck-coach.

## Owner deck view

New client component `DeckPrimer` rendered in the deck editor view:
- If `primer` present: render the four sections + tagline.
- **Generate** button (or **Regenerate** if one exists) → `POST /api/deck-primer` with loading state; on success, update in place.
- Subtle staleness hint when `deck.updated_at > primer_generated_at`: "Deck changed since this primer — regenerate."
- The owner deck-fetch payload must include `primer` + `primer_generated_at` (add to the deck GET mapping).

## Public page

`getPublicDeck` (`src/lib/publicDeck.ts`) also selects `primer` (add to `PublicDeck` type).
The public page (`src/app/d/[id]/page.tsx`, server component) renders a read-only **Primer**
section (tagline + 4 sections) above the decklist when `primer` is present.

## Content

The four sections chosen (game plan / how it wins; key cards & engines; mulligan guide; key
lines & interactions) plus a one-line tagline for the header.

## Edge cases

- Empty deck → 400.
- DeepSeek not configured → 503; AI/parse failure → 502.
- Guests unaffected — primers are for Supabase (signed-in) decks, which is also the only kind
  that can be shared publicly.
- Ban list included in the prompt so the primer never references banned cards as staples.
- Deck edited after generation → owner sees the staleness hint; public page shows whatever was
  last generated (acceptable).

## Testing

- Unit-test the extracted `buildDeckSummary` (pure) with a small decklist fixture (via tsx temp
  script; delete after).
- `npx tsc --noEmit`, `npx eslint <changed files>`, `npx next build` green.
- Verify generation live on a real deck; confirm the primer renders in the owner view AND on the
  public `/d/[id]` page; confirm the staleness hint appears after editing the deck.

## Out of scope

- 4a (streaming deck-aware Ask Harry) — separate spec.
- OG image changes for primers.
- Automatic regeneration on deck edit (manual Regenerate only).
