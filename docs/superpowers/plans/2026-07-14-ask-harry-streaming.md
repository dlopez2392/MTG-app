# Streaming, Deck-Aware Ask Harry (Phase 4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use checkbox syntax.

**Goal:** Make Ask Harry deck-aware (inject a chosen deck's decklist) and stream the ruling as prose (NDJSON ReadableStream) instead of a single JSON blob, preserving sources/cards/confidence.

**Architecture:** Retrieval stays synchronous server-side; the route then streams NDJSON events — `meta` (sources+cards+model, from server data), `confidence` (model's first line), `token` deltas, `done`. New `generateRulingStream` async generator; two pure helpers (confidence-prefix extractor, NDJSON line splitter) are unit-tested. Frontend reads the stream and renders progressively.

**Tech Stack:** Next.js 16 route handler returning a `ReadableStream`, DeepSeek via OpenAI SDK (`stream:true`), Clerk, Supabase, TypeScript strict.

## Global Constraints

- Route: `auth()` → 401; `rateLimit("ai:"+userId,10,60_000)` → 429; require `DEEPSEEK_API_KEY` AND `OPENAI_API_KEY` → 503; question 3–2000 chars, ≤5 cards → 400. All BEFORE streaming (normal JSON errors).
- Retrieval unchanged: `oracleCardLookup`/`fetchCardOracle`, `analyzeQuestion`, `vectorSearch`/`directRuleLookup`/`cardRulingsLookup`, `deduplicateAndCap`.
- `buildDeckSummary` from `@/lib/decks/summary`. Deck load scoped `.eq("user_id", userId)`.
- NDJSON events: `{type:"meta",citedRules,cardsAnalyzed,model}` | `{type:"confidence",value}` | `{type:"token",text}` | `{type:"done"}` | `{type:"error",message}`. Response `Content-Type: application/x-ndjson`.
- Verify: `npx tsc --noEmit`; `npx eslint <files>`; `npx next build`. Pure tests via `npx tsx <tempfile>` (delete after).
- Branch `feat/ask-harry-streaming`. Do NOT merge (danlo gate).

---

### Task 1: Pure stream helpers + tests

**Files:** Create `src/lib/rules/stream.ts`

**Interfaces:**
```ts
// Splits a confidence-prefixed model output. Returns the parsed confidence (or null)
// and the remaining text once the first line has been consumed. `settled` is false
// until the first newline has arrived (so the caller keeps buffering).
export function parseConfidencePrefix(buf: string): { settled: boolean; confidence: "high"|"medium"|"low"|null; rest: string };

// Client-side NDJSON buffering: returns complete parsed events + leftover partial line.
export interface StreamEvent { type: string; [k: string]: unknown }
export function splitNdjson(buf: string): { events: StreamEvent[]; remainder: string };
```

- [ ] **Step 1: Implement**
```ts
export function parseConfidencePrefix(buf: string): { settled: boolean; confidence: "high" | "medium" | "low" | null; rest: string } {
  const nl = buf.indexOf("\n");
  if (nl === -1) return { settled: false, confidence: null, rest: "" };
  const first = buf.slice(0, nl).trim();
  const m = first.match(/^confidence\s*[:\-]\s*(high|medium|low)/i);
  const confidence = m ? (m[1].toLowerCase() as "high" | "medium" | "low") : null;
  // If the first line wasn't a confidence marker, keep it as part of the ruling.
  const rest = confidence ? buf.slice(nl + 1).replace(/^\n+/, "") : buf;
  return { settled: true, confidence, rest };
}

export interface StreamEvent { type: string; [k: string]: unknown }

export function splitNdjson(buf: string): { events: StreamEvent[]; remainder: string } {
  const parts = buf.split("\n");
  const remainder = parts.pop() ?? "";
  const events: StreamEvent[] = [];
  for (const line of parts) {
    const t = line.trim();
    if (!t) continue;
    try { events.push(JSON.parse(t) as StreamEvent); } catch { /* skip malformed */ }
  }
  return { events, remainder };
}
```
- [ ] **Step 2: Failing test** (temp `scratch_stream.ts`):
```ts
import { parseConfidencePrefix, splitNdjson } from "./src/lib/rules/stream";
let ok = true;
const a = parseConfidencePrefix("Confidence: high\n\nThe ruling…");
ok = ok && a.settled && a.confidence === "high" && a.rest.startsWith("The ruling");
const b = parseConfidencePrefix("Confidence: hi"); // no newline yet
ok = ok && b.settled === false;
const c = parseConfidencePrefix("No marker here\nmore"); // first line not a marker
ok = ok && c.settled && c.confidence === null && c.rest.startsWith("No marker");
const d = splitNdjson('{"type":"meta"}\n{"type":"token","text":"a"}\n{"type":"tok');
ok = ok && d.events.length === 2 && d.events[0].type === "meta" && d.remainder === '{"type":"tok';
console.log(ok ? "PASS" : "FAIL");
```
- [ ] **Step 3:** `npx tsx scratch_stream.ts` → `PASS`; `rm scratch_stream.ts`.
- [ ] **Step 4:** `npx tsc --noEmit` clean. Commit `feat(ask-harry): pure stream helpers`.

---

### Task 2: `generateRulingStream`

**Files:** Modify `src/lib/rules/answer.ts` (add streaming generator; keep `generateRuling`).

**Interfaces:**
```ts
export type StreamPart = { confidence: "high"|"medium"|"low"|null } | { token: string };
export async function* generateRulingStream(
  question: string,
  ruleChunks: RuleChunk[],
  cardOracleTexts: { name: string; oracleText: string }[],
  complexity: "simple" | "complex",
  format?: string,
  deckSummary?: string,
): AsyncGenerator<StreamPart>;
```

- [ ] **Step 1:** Add a `STREAM_SYSTEM_PROMPT` (reuse the L2-judge guidance from `SYSTEM_PROMPT`, minus the JSON instructions) ending with:
  "Begin your response with a single line `Confidence: high` (or medium/low). Then a blank line, then your ruling in plain prose. Cite Comprehensive Rule numbers inline (e.g., CR 702.19b). Only use the rules and card text provided. If a user deck is provided, use it to answer deck-specific questions."
- [ ] **Step 2:** Implement `generateRulingStream`: build the same `rulesContext` + `cardContext` + `formatContext` as `generateRuling`, plus `deckContext = deckSummary ? "\n\nUser's deck:\n" + deckSummary : ""`. Call:
```ts
const stream = await deepseek.chat.completions.create({
  model, temperature: 0.3, max_tokens: maxTokens, stream: true,
  messages: [
    { role: "system", content: STREAM_SYSTEM_PROMPT },
    { role: "user", content: `Question: ${question}${formatContext}${deckContext}\n\nRelevant Rules:\n${rulesContext}${cardContext}` },
  ],
});
let buf = ""; let confidenceSent = false;
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content ?? "";
  if (!delta) continue;
  if (!confidenceSent) {
    buf += delta;
    const p = parseConfidencePrefix(buf);
    if (!p.settled) continue;
    confidenceSent = true;
    yield { confidence: p.confidence };
    if (p.rest) yield { token: p.rest };
    buf = "";
  } else {
    yield { token: delta };
  }
}
if (!confidenceSent && buf) { yield { confidence: null }; yield { token: buf }; }
```
  (import `parseConfidencePrefix` from `./stream`.)
- [ ] **Step 3:** `npx tsc --noEmit` clean. Commit `feat(ask-harry): streaming ruling generator`.

---

### Task 3: Rewrite `/api/rules-judge` to stream + deck-aware

**Files:** Modify `src/app/api/rules-judge/route.ts`

- [ ] **Step 1:** Add `deckId?: string` to `RulesJudgeRequest`. After the existing validation, if `deckId`: load `decks` (name, format) + `deck_cards` scoped to userId; build `deckSummary = buildDeckSummary({deckName, format, cards})`. (Skip silently if not found.)
- [ ] **Step 2:** Cache: include `deckId` in the key (extend `getCachedRuling`/`setCachedRuling` calls with a `deckId` param — add the param to `cache.ts`). On cache hit, return a stream that emits `meta` (from the cached `citedRules`/`cardsAnalyzed`/`model`) + `confidence` + one `token` with the cached `ruling` + `done`.
- [ ] **Step 3:** Keep retrieval unchanged through `allChunks`. Build `meta`:
```ts
const sourceChunks = allChunks
  .filter((c) => ["comprehensive_rules","glossary","scryfall_ruling","tournament_rules","infraction_procedure","regular_rel"].includes(c.source))
  .slice(0, 8)
  .map((c) => ({ number: c.sourceId, text: c.content.slice(0, 400) }));
const model = analysis.complexity === "complex" ? "pro" : "flash";
```
- [ ] **Step 4:** Return a `ReadableStream` (encode each event + "\n"): enqueue `meta`; then `for await (const part of generateRulingStream(...))` → if `"confidence" in part` enqueue confidence + capture value, else enqueue token + append to `full`; on completion `setCachedRuling(..., { ruling: full, confidence, citedRules: sourceChunks, cardsAnalyzed: cardOracleTexts, model })` then enqueue `done`; wrap the loop in try/catch → enqueue `{type:"error",message}`. Return with `headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" }`.
- [ ] **Step 5:** `npx tsc --noEmit` + `npx eslint src/app/api/rules-judge/route.ts src/lib/rules/answer.ts src/lib/rules/cache.ts` clean. Commit `feat(ask-harry): stream rulings + deck context in route`.

---

### Task 4: Frontend — deck picker + stream reader

**Files:** Modify `src/components/ask-harry/AskHarryClient.tsx`, `src/components/ask-harry/RulingResult.tsx`

- [ ] **Step 1: `RulingResult`** — change `confidence` prop to `"high"|"medium"|"low"|null`; when null, hide the confidence badge (render nothing or a subtle "Analyzing…"). Add optional `streaming?: boolean` → show a small pulsing dot/caret after the ruling text while true. Everything else unchanged. `citedRules` label may read "Sources".
- [ ] **Step 2: `AskHarryClient`** — add `const { allDecks } = useDecks();` and a `deckId` state with a `<select>` ("No deck" + each deck name) above/below the card input. Replace `handleSubmit`'s single JSON fetch with a streaming reader:
```ts
setLoading(true); setError(null);
setResult({ ruling: "", confidence: null, citedRules: [], cardsAnalyzed: [], model: "flash" });
setStreaming(true);
const res = await fetch("/api/rules-judge", { method:"POST", headers:{"Content-Type":"application/json"},
  body: JSON.stringify({ question: question.trim(), cards: cards.length ? cards : undefined, deckId: deckId || undefined }) });
if (!res.ok || !res.body) { /* parse JSON error, setError, setStreaming(false), return */ }
const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
while (true) {
  const { done, value } = await reader.read(); if (done) break;
  buf += dec.decode(value, { stream: true });
  const { events, remainder } = splitNdjson(buf); buf = remainder;
  for (const ev of events) {
    if (ev.type === "meta") setResult((r) => ({ ...r!, citedRules: ev.citedRules, cardsAnalyzed: ev.cardsAnalyzed, model: ev.model }));
    else if (ev.type === "confidence") setResult((r) => ({ ...r!, confidence: ev.value ?? null }));
    else if (ev.type === "token") setResult((r) => ({ ...r!, ruling: r!.ruling + ev.text }));
    else if (ev.type === "error") setError(ev.message ?? "Stream error");
  }
}
setStreaming(false); setLoading(false); saveRecentQuestion(question.trim(), cards);
```
  (Type the events; `RulingData.confidence` becomes nullable. Show `RulingResult` whenever `result` is set; keep the "Harry is thinking…" affordance until the first token arrives.)
- [ ] **Step 3:** `npx tsc --noEmit` + `npx eslint` on changed files clean. Commit `feat(ask-harry): deck picker + streaming UI`.

---

### Task 5: Verification

- [ ] **Step 1:** `npx tsc --noEmit`, `npx eslint` (changed files), `npx next build` — green.
- [ ] **Step 2:** Dev server; sign in; ask a plain rules question → tokens visibly stream; confidence badge, sources, cards render; feedback thumbs work.
- [ ] **Step 3:** Pick a deck; ask a deck-specific question ("does my deck have a way to deal with an indestructible creature?") → answer references the deck's actual cards.
- [ ] **Step 4:** Re-ask the same question (cache hit) → still renders correctly (meta + full ruling).
- [ ] **Step 5:** No commit (verification). Record results for review.

## Self-Review

- **Spec coverage:** pure helpers+tests (T1), streaming generator w/ deck context + confidence-first-line (T2), route rewrite: deck load + cache key + meta + NDJSON stream + cache replay (T3), frontend deck picker + stream reader + nullable confidence (T4), verify incl. deck-aware + cache (T5). All spec sections mapped.
- **Placeholders:** none — real code for helpers, generator, route framing, and client reader (JSX styling follows existing AskHarry/RulingResult conventions).
- **Type consistency:** `StreamEvent`/event `type` strings identical across `stream.ts`, route emit, and client dispatch; `StreamPart` from `generateRulingStream` consumed in the route; `confidence` nullable end-to-end (generator → route → client → RulingResult); `buildDeckSummary({deckName,format,cards})` matches the 4b signature; cache gains a `deckId` param in `cache.ts` used by both get/set.
