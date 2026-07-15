# AI Deck Primers (Phase 4b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) or subagent-driven-development. Steps use checkbox syntax.

**Goal:** One-tap AI-generated deck primer (tagline, game plan, key cards, mulligan guide, key lines), stored on the deck, rendered in the owner's deck view and on the public `/d/[id]` share page.

**Architecture:** New `POST /api/deck-primer` (mirrors `deck-coach`) loads the deck server-side, builds a decklist digest via a shared `buildDeckSummary`, calls DeepSeek (JSON), and stores the result on the `decks` row. Owner view gets a `DeckPrimer` component; public server page renders it read-only.

**Tech Stack:** Next.js 16 route handlers, Supabase service role, DeepSeek via OpenAI SDK, Clerk auth, TypeScript strict.

## Global Constraints

- App-layer auth: every route `const { userId } = await auth()` → 401; queries `.eq("user_id", userId)`; `getSupabase()` service role; no Postgres RLS.
- AI routes: `rateLimit("ai:" + userId, 10, 60_000)` → 429; `if (!process.env.DEEPSEEK_API_KEY)` → 503; tolerant JSON parse (strip ``` fences); AI/parse failure → 502. Model `deepseek-v4-flash`, `response_format: { type: "json_object" }`.
- Deck `format` uses lowercase keys; ban list via `formatBanListForPrompt(format)` from `@/lib/data/bannedCards`.
- Verify: `npx tsc --noEmit`; `npx eslint <files>`; `npx next build`. Pure tests via `npx tsx <tempfile>` (delete after).
- Branch `feat/deck-primers`. Do NOT merge (danlo gate).

---

### Task 1: Migration 012 — primer columns

**Files:** Create `supabase/migrations/012_deck_primer.sql`

- [ ] **Step 1: SQL**
```sql
-- 012_deck_primer.sql
alter table decks add column if not exists primer jsonb;
alter table decks add column if not exists primer_generated_at timestamptz;
```
- [ ] **Step 2:** Apply via Supabase MCP `apply_migration` name `012_deck_primer` to project `jffcyqwhfbegnctpdzpn`.
- [ ] **Step 3:** Verify columns exist (`select column_name from information_schema.columns where table_name='decks' and column_name in ('primer','primer_generated_at')`).
- [ ] **Step 4:** Commit `feat(primers): migration 012 deck primer columns`.

---

### Task 2: Extract `buildDeckSummary` to a shared module

**Files:** Create `src/lib/decks/summary.ts`; Modify `src/app/api/deck-coach/route.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DeckCardInput { name: string; quantity: number; category: string; manaCost?: string; cmc?: number; typeLine?: string; rarity?: string; priceUsd?: string | null }
  export function buildDeckSummary(input: { deckName: string; format: string; cards: DeckCardInput[] }): string
  ```

- [ ] **Step 1:** Move the `DeckCardInput` interface and the `buildDeckSummary` function verbatim from `deck-coach/route.ts` into `src/lib/decks/summary.ts` (exported). Signature takes `{ deckName, format, cards }`.
- [ ] **Step 2:** In `deck-coach/route.ts`, delete the local `buildDeckSummary`/`DeckCardInput`, `import { buildDeckSummary, type DeckCardInput } from "@/lib/decks/summary"`, and call `buildDeckSummary({ deckName: body.deckName, format: body.format, cards: body.cards })`.
- [ ] **Step 3: Failing test** (temp `scratch_summary.ts`):
```ts
import { buildDeckSummary } from "./src/lib/decks/summary";
const s = buildDeckSummary({ deckName:"T", format:"commander", cards:[
  {name:"Sol Ring",quantity:1,category:"main",cmc:1,typeLine:"Artifact"},
  {name:"Forest",quantity:10,category:"main",cmc:0,typeLine:"Basic Land — Forest"},
]});
console.log(/Deck: "T"/.test(s) && /Lands: 10/.test(s) && /Sol Ring/.test(s) ? "PASS" : "FAIL\n"+s);
```
- [ ] **Step 4:** `npx tsx scratch_summary.ts` → `PASS`; then `rm scratch_summary.ts`.
- [ ] **Step 5:** `npx tsc --noEmit` clean. Commit `refactor(decks): extract buildDeckSummary to shared module`.

---

### Task 3: `POST /api/deck-primer`

**Files:** Create `src/app/api/deck-primer/route.ts`

**Interfaces:**
- Consumes `buildDeckSummary` (Task 2), `getDeepSeek`, `getSupabase`, `rateLimit`, `formatBanListForPrompt`, `auth`.
- Produces primer JSON `{ tagline, gamePlan, keyCards: [{name, note}], mulligan, keyLines: string[] }`.

- [ ] **Step 1: Implement** (mirrors deck-coach; loads deck server-side, stores result):
```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { getDeepSeek } from "@/lib/deepseek/client";
import { rateLimit } from "@/lib/rateLimit";
import { formatBanListForPrompt } from "@/lib/data/bannedCards";
import { buildDeckSummary, type DeckCardInput } from "@/lib/decks/summary";

const SYSTEM_PROMPT = `You are an expert Magic: The Gathering writer creating a concise, high-signal DECK PRIMER for a deck's shareable page. Be specific and practical; reference real cards in the decklist.
Respond ONLY with valid JSON matching exactly:
{
  "tagline": "one punchy line describing the deck's archetype/hook",
  "gamePlan": "1-2 short paragraphs: the archetype, how it develops, and its primary win condition(s)",
  "keyCards": [{ "name": "exact card name from the decklist", "note": "one line on why it matters" }],
  "mulligan": "what makes a keepable opening hand; what to look for and what to ship",
  "keyLines": ["an important sequence, combo, or interaction tip", "..."]
}
Rules: 3-6 keyCards, 2-5 keyLines. Only reference cards present in the decklist. Never present a banned card as a staple. No markdown fences.`;

interface Body { deckId?: string }
interface DeckRow { name: string; format: string | null }
interface CardRow { name: string; quantity: number; category: string; mana_cost: string | null; cmc: number | null; type_line: string | null; rarity: string | null; price_usd: string | null }

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { success } = rateLimit("ai:" + userId, 10, 60_000);
  if (!success) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  if (!process.env.DEEPSEEK_API_KEY) return NextResponse.json({ error: "AI is not configured." }, { status: 503 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.deckId) return NextResponse.json({ error: "Missing deckId" }, { status: 400 });

  const sb = getSupabase();
  const { data: deck, error: deckErr } = await sb.from("decks").select("name, format").eq("id", body.deckId).eq("user_id", userId).single();
  if (deckErr || !deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  const { data: cardRows } = await sb.from("deck_cards").select("name, quantity, category, mana_cost, cmc, type_line, rarity, price_usd").eq("deck_id", body.deckId).eq("user_id", userId);
  const cards: DeckCardInput[] = (cardRows ?? []).map((c: CardRow) => ({ name: c.name, quantity: c.quantity ?? 1, category: c.category ?? "main", manaCost: c.mana_cost ?? undefined, cmc: c.cmc ?? undefined, typeLine: c.type_line ?? undefined, rarity: c.rarity ?? undefined, priceUsd: c.price_usd ?? null }));
  if (cards.length === 0) return NextResponse.json({ error: "Deck has no cards" }, { status: 400 });

  const d = deck as DeckRow;
  const format = (d.format ?? "commander").toLowerCase();
  try {
    const summary = buildDeckSummary({ deckName: d.name, format, cards });
    const banList = formatBanListForPrompt(format);
    const result = await getDeepSeek().chat.completions.create({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${banList}\n\nWrite a primer for this deck:\n\n${summary}` },
      ],
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    });
    const text = result.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const primer = JSON.parse(cleaned);
    const generatedAt = new Date().toISOString();
    await sb.from("decks").update({ primer, primer_generated_at: generatedAt }).eq("id", body.deckId).eq("user_id", userId);
    return NextResponse.json({ primer, primerGeneratedAt: generatedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI primer failed";
    console.error("Deck primer error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```
- [ ] **Step 2:** `npx tsc --noEmit` + `npx eslint src/app/api/deck-primer/route.ts` clean.
- [ ] **Step 3:** Commit `feat(primers): deck-primer generation endpoint`.

---

### Task 4: Owner deck view — DeckPrimer component + deck payload

**Files:** Create `src/components/decks/DeckPrimer.tsx`; Modify `src/app/api/decks/[id]/route.ts` (add primer to `toDecK`); Modify the deck type + `DeckEditor.tsx` to render `DeckPrimer`.

**Interfaces:**
- `DeckPrimer` props: `{ deckId: string; primer: Primer | null; primerGeneratedAt: string | null; deckUpdatedAt: string }` where `Primer = { tagline: string; gamePlan: string; keyCards: {name:string;note:string}[]; mulligan: string; keyLines: string[] }`.

- [ ] **Step 1:** In `src/app/api/decks/[id]/route.ts` `toDecK`, add `primer: row.primer ?? null, primerGeneratedAt: row.primer_generated_at ?? null`. Add the same two fields to the deck type used by the owner deck view (wherever the `toDecK`-shaped Deck is typed — the deck detail hook/type).
- [ ] **Step 2:** Create `DeckPrimer.tsx` (`"use client"`), mirroring `stats/DeckCoach.tsx` conventions (glass-card sections, loading state, `btn-gradient` button):
  - If `primer` is null and not loading: show a "Generate primer" prompt + button.
  - Button → `fetch("/api/deck-primer", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ deckId }) })`; on success set local primer + generatedAt; on error show a message.
  - When primer present: render tagline (header), Game plan, Key cards (name + note list), Mulligan, Key lines (bulleted). Show **Regenerate** button.
  - Staleness hint when `deckUpdatedAt` > `primerGeneratedAt`: small muted line "Deck changed since this primer — regenerate."
- [ ] **Step 3:** Render `<DeckPrimer .../>` in `DeckEditor.tsx` (owner deck view) — a collapsible/section near the top of the deck view, passing the deck's `id`, `primer`, `primerGeneratedAt`, `updatedAt`. (Confirm DeckEditor has the deck object in scope; if it only holds cards, thread the deck fields from its parent.)
- [ ] **Step 4:** `npx tsc --noEmit` + `npx eslint` on changed files clean.
- [ ] **Step 5:** Commit `feat(primers): owner deck primer UI + deck payload`.

---

### Task 5: Public page render

**Files:** Modify `src/lib/publicDeck.ts`; Modify `src/app/d/[id]/page.tsx`

- [ ] **Step 1:** In `publicDeck.ts`: add `primer` to the select (`.select("name, format, cover_image_uri, updated_at, public, primer")`), add `primer: Primer | null` to `PublicDeck` (define the `Primer` type or import a shared one from `src/types/deck.ts`), map `primer: (deck.primer as Primer | null) ?? null`.
- [ ] **Step 2:** In `d/[id]/page.tsx`: when `deck.primer` present, render a read-only **Primer** section (glass-card) above the "Mana curve"/decklist: tagline, Game plan, Key cards, Mulligan, Key lines. Server component — plain markup, no client JS.
- [ ] **Step 3:** `npx tsc --noEmit` + `npx next build` green.
- [ ] **Step 4:** Commit `feat(primers): render primer on public deck page`.

**DRY note:** define the `Primer` type once (e.g., `src/types/deck.ts`) and import it in `DeckPrimer.tsx`, `publicDeck.ts`, and the deck type.

---

### Task 6: Verification

- [ ] **Step 1:** `npx tsc --noEmit`, `npx eslint` (all changed files), `npx next build` — all green.
- [ ] **Step 2:** Dev server; sign in; on a real deck click Generate primer → confirm all four sections + tagline render and the `decks.primer` row is populated (Supabase).
- [ ] **Step 3:** Make the deck public (if not), open `/d/[id]` → confirm the Primer section renders read-only.
- [ ] **Step 4:** Edit the deck (add/remove a card) → confirm the owner staleness hint appears; Regenerate clears it.
- [ ] **Step 5:** No commit (verification). Record results for review.

## Self-Review

- **Spec coverage:** migration (T1), shared summary + DRY (T2), generation endpoint w/ store (T3), owner UI + payload + staleness (T4), public render (T5), verify incl. live + staleness (T6). All spec sections mapped.
- **Placeholders:** none — real SQL/code/commands throughout (DeckPrimer/public JSX described against the DeckCoach pattern; finalize markup during impl).
- **Type consistency:** `Primer` shape identical across route return, `DeckPrimer` props, `publicDeck`, and the shared type; `buildDeckSummary({deckName,format,cards})` signature consistent in T2/T3; new deck fields `primer`/`primerGeneratedAt` added to both the GET mapping and the deck type.
