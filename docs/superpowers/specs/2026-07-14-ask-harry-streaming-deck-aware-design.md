# Streaming, Deck-Aware Ask Harry (Phase 4a) — Design

**Date:** 2026-07-14
**Status:** Approved (danlo, 2026-07-14)
**Roadmap:** Phase 4 "Intelligence Cluster", sub-feature 4a. (4b AI deck primers already shipped.)

## Goal

Two upgrades to Ask Harry (the AI rules judge):
1. **Deck-aware** — optionally answer with the context of one of the user's decks ("does my deck have an answer to X?", "would this combo fit?").
2. **Streaming** — stream the ruling as prose (SSE-style) for perceived speed instead of waiting on one JSON blob.

## Current state (unchanged parts)

`POST /api/rules-judge`: `auth` → `rateLimit("ai:"+userId,10/min)` → requires **both** `DEEPSEEK_API_KEY` and `OPENAI_API_KEY` (OpenAI = vector-search embeddings). Flow: cache check → resolve card oracle text (local + Scryfall) → `analyzeQuestion` → two-hop retrieval (`vectorSearch`/`directRuleLookup`/`cardRulingsLookup`) → `deduplicateAndCap` → `generateRuling` (DeepSeek, JSON) → cache + return. `RulingResult` renders `ruling` (plain pre-wrap text), a confidence badge, expandable cited rules + cards analyzed, model badge, and feedback thumbs.

**All retrieval stays exactly as-is.** Only the generation + response transport + a deck-context injection change.

## Deck-awareness

- `AskHarryClient` gains a deck `<select>` populated from `useDecks().allDecks` (id → name), default **"No deck"**. Selected `deckId` is sent in the request body.
- The route, when `deckId` is present, loads that deck scoped to `userId` (`decks` + `deck_cards`), builds a digest via the shared `buildDeckSummary` (from 4b), and injects it into the user prompt as a "User's deck" block. Guests / no deck → unchanged behavior.
- `deckId` becomes part of the **cache key** (deck context changes the answer).

## Streaming transport (NDJSON ReadableStream)

The route returns a `ReadableStream` (`Content-Type: application/x-ndjson`) of newline-delimited JSON events instead of a JSON object:

1. `{"type":"meta","citedRules":[{number,text}],"cardsAnalyzed":[{name,oracleText}],"model":"flash"|"pro"}` — emitted first, built from server-side data we already have (a curated subset of the retrieved chunks as "sources consulted" + the resolved cards + the complexity→model choice).
2. `{"type":"confidence","value":"high"|"medium"|"low"}` — parsed from the model's first output line (see below).
3. `{"type":"token","text":"…"}` — repeated; prose deltas.
4. `{"type":"done"}` — terminal. Mid-stream failure → `{"type":"error","message":"…"}`.

**Validation/config/auth errors happen before streaming** and return a normal JSON error with the proper status (400/401/429/503), so the client checks `res.ok` before reading the stream.

### Generation

New `generateRulingStream(question, chunks, cards, complexity, format, deckSummary?)` in `answer.ts` (keep the existing `generateRuling`). It calls DeepSeek with `stream:true` (no `response_format`). Its system prompt:
- "Begin with a single line `Confidence: high|medium|low`, then a blank line, then the ruling in plain prose. Cite Comprehensive Rule numbers inline (e.g., CR 702.19b)."
- Retains the L2-judge guidance (layers, MTR/IPG, etc.), the "only use provided rules/cards" constraint, and (new) "If a user deck is provided, use it to answer deck-specific questions."

It is an async generator: it buffers until the first newline, yields `{ confidence }` once, then yields `{ token }` for all subsequent text. The route frames these into NDJSON + prepends `meta` + appends `done`.

### Cited rules ("sources")

Since we no longer get the model's curated `citedRules` JSON, `meta.citedRules` is derived from the retrieved chunks: prefer the direct rule matches, then top vector hits, mapped `sourceId → number`, `content → text`, capped at ~8, deduped. Labeled "Sources consulted" in the UI. The prose also cites CR numbers inline.

### Caching

Cache key includes `deckId`. On a **cache hit**, the route replays the cached result as a stream (meta + one token with the full ruling text + confidence + done) so the client path is identical. `generateRuling`'s cached shape is reused; a new cache entry is written after a fresh stream completes (accumulate the full text server-side while streaming).

## Frontend

- `AskHarryClient`: deck `<select>`; on submit, `fetch` then read `res.body.getReader()`, decode, split on `\n`, parse each complete JSON line, and dispatch: `meta` → set sources/cards/model + show `RulingResult`; `confidence` → set badge; `token` → append to a live `ruling` string; `done` → finalize + `saveRecentQuestion`; `error` → show message. A buffer handles partial lines. Keep the existing loading affordance until the first token.
- `RulingResult`: accept `confidence: "high"|"medium"|"low"|null` (hide the badge while null/streaming, or show a subtle "Analyzing…"), and an optional `streaming?: boolean` for a small pulsing cursor/indicator. Ruling text renders as it grows (already `whitespace-pre-wrap`). Cited rules/cards/feedback unchanged.

## Error handling

- Missing keys → 503 (before stream). Retrieval throw before streaming → 502 JSON. Mid-stream DeepSeek error → `error` event, client shows message and stops the spinner.
- Empty/short/over-long question, >5 cards → 400 (unchanged).

## Testing

- Unit-test two pure helpers: the **NDJSON line parser/buffer** (client) and the **confidence-first-line extractor** (splits `Confidence: X` from the remaining prose) — via tsx temp scripts.
- `npx tsc --noEmit`, `npx eslint <files>`, `npx next build` green.
- Verify live: a deck-aware question visibly references the selected deck; tokens stream progressively; sources + cards + confidence render; a repeat question (cache hit) still renders correctly.

## Out of scope

- Persisting Ask Harry history server-side (stays localStorage recents).
- Changing retrieval/embeddings.
- Multi-deck or partial-deck context (one deck at a time).
