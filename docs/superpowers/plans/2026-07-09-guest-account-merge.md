# Guest→Account Merge (Phase 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user signs in on a device that has guest data (decks/binders in localStorage), offer a one-tap "bring my data" migration into their Supabase account — copy-then-clear, never destructive, with per-item error reporting.

**Architecture:** Three units: (1) `guestData.ts` util that reads/summarizes/clears the guest localStorage keys; (2) a single bulk `POST /api/merge-guest-data` endpoint (auth-required) that inserts decks+cards and binders+cards server-side in batches — one round trip, not hundreds (lesson from Phase 2a's sequential-POST finding); (3) a `MergeGuestPrompt` client component mounted in the root layout that detects `isLoaded && isSignedIn && hasGuestData()` and shows the offer.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Clerk (`useUser`), Supabase via `getSupabase()` (service role, snake_case columns), existing UI kit (`Modal`, `Button`).

## Global Constraints

- **No new dependencies.**
- **Guest storage reality (NOT Dexie, despite the spec's wording):** decks in `mtg_guest_decks` + `mtg_guest_deck_cards_{deckId}`; binders in `mtg_guest_binders` + `mtg_guest_binder_cards_{binderId}`. Wishlist is localStorage-only for ALL users (no Supabase table/API) — **excluded from merge scope**; life-counter history is Dexie-by-design for all users — also excluded.
- **Never destructive:** guest keys are cleared ONLY after the server confirms full success (no `errors` in response). Partial failure → keep local data, show what failed.
- **No guest IDs sent to the server** — Supabase generates new row IDs; cards nest under their deck/binder in the payload.
- **Clerk hydration guard:** every signed-in check must gate on `isLoaded` (Phase 2a lesson — `isSignedIn` is `undefined` during load).
- Supabase inserts mirror existing column usage exactly: `decks`/`deck_cards` columns as in `src/app/api/import-deck/route.ts`; `binders`/`collection_cards` columns as in `src/app/api/binders/route.ts` and `src/app/api/binders/[id]/cards/route.ts` — including that route's optional-column fallback (retry without `collector_number`/`type_line`/`rarity` if the schema lacks them).
- **No test framework** (do not add one). Pure utils verified with `npx tsx` temp-file scripts (localStorage stubbed); endpoint via curl (401 check); UI via tsc/eslint/build + guest-mode browser check. Signed-in end-to-end merge requires a real Clerk session → controller/user on-device QA, noted explicitly.
- Work on branch `feat/guest-merge`; do NOT push; commit per task with the given message + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- API route pattern: `const { userId } = await auth();` → 401 if null; `getSupabase()` from `@/lib/supabase/server`.

---

### Task 1: Guest data utilities

**Files:**
- Create: `src/lib/utils/guestData.ts`

**Interfaces:**
- Produces (consumed by Tasks 2's payload contract and Task 3):
  - `interface GuestMergePayload { decks: { deck: GuestDeckMeta; cards: GuestDeckCard[] }[]; binders: { binder: GuestBinderMeta; cards: GuestBinderCard[] }[] }` (full shapes below)
  - `hasGuestData(): boolean`
  - `guestDataSummary(): { decks: number; binders: number; cards: number }`
  - `collectGuestData(): GuestMergePayload`
  - `clearGuestData(): void`
  - `isMergeDismissed(): boolean` / `dismissMerge(): void` (key `mtg_guest_merge_dismissed` = `"1"`)

- [ ] **Step 1: Create `src/lib/utils/guestData.ts`**

```typescript
// Guest data lives in localStorage under these keys (written by useDecks/useCollection):
//   mtg_guest_decks                      Deck[]
//   mtg_guest_deck_cards_{deckId}        DeckCard[]
//   mtg_guest_binders                    Binder[]
//   mtg_guest_binder_cards_{binderId}    CollectionCard[]

export interface GuestDeckMeta {
  name: string;
  format?: string;
  description?: string;
  coverCardId?: string;
  coverImageUri?: string;
}

export interface GuestDeckCard {
  scryfallId: string;
  name: string;
  quantity: number;
  category: string;
  manaCost?: string;
  cmc?: number;
  typeLine?: string;
  rarity?: string;
  imageUri?: string;
  priceUsd?: string | null;
}

export interface GuestBinderMeta {
  name: string;
  description?: string;
  coverImageUri?: string;
}

export interface GuestBinderCard {
  scryfallId: string;
  name: string;
  quantity: number;
  condition?: string;
  isFoil?: boolean;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  imageUri?: string;
  priceUsd?: string | null;
  typeLine?: string;
  rarity?: string;
}

export interface GuestMergePayload {
  decks: { deck: GuestDeckMeta; cards: GuestDeckCard[] }[];
  binders: { binder: GuestBinderMeta; cards: GuestBinderCard[] }[];
}

const DECKS_KEY = "mtg_guest_decks";
const BINDERS_KEY = "mtg_guest_binders";
const DECK_CARDS_PREFIX = "mtg_guest_deck_cards_";
const BINDER_CARDS_PREFIX = "mtg_guest_binder_cards_";
const DISMISSED_KEY = "mtg_guest_merge_dismissed";

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}

interface StoredDeck { id?: string; name: string; format?: string; description?: string; coverCardId?: string; coverImageUri?: string }
interface StoredBinder { id?: string; name: string; description?: string; coverImageUri?: string }

export function guestDataSummary(): { decks: number; binders: number; cards: number } {
  const decks = lsGet<StoredDeck[]>(DECKS_KEY, []);
  const binders = lsGet<StoredBinder[]>(BINDERS_KEY, []);
  let cards = 0;
  for (const d of decks) cards += lsGet<unknown[]>(`${DECK_CARDS_PREFIX}${d.id}`, []).length;
  for (const b of binders) cards += lsGet<unknown[]>(`${BINDER_CARDS_PREFIX}${b.id}`, []).length;
  return { decks: decks.length, binders: binders.length, cards };
}

export function hasGuestData(): boolean {
  const s = guestDataSummary();
  return s.decks > 0 || s.binders > 0;
}

export function collectGuestData(): GuestMergePayload {
  const decks = lsGet<StoredDeck[]>(DECKS_KEY, []);
  const binders = lsGet<StoredBinder[]>(BINDERS_KEY, []);
  return {
    decks: decks.map((d) => ({
      deck: {
        name: d.name || "Untitled Deck",
        format: d.format,
        description: d.description,
        coverCardId: d.coverCardId,
        coverImageUri: d.coverImageUri,
      },
      cards: lsGet<GuestDeckCard[]>(`${DECK_CARDS_PREFIX}${d.id}`, []),
    })),
    binders: binders.map((b) => ({
      binder: {
        name: b.name || "Untitled Binder",
        description: b.description,
        coverImageUri: b.coverImageUri,
      },
      cards: lsGet<GuestBinderCard[]>(`${BINDER_CARDS_PREFIX}${b.id}`, []),
    })),
  };
}

export function clearGuestData(): void {
  if (typeof window === "undefined") return;
  const decks = lsGet<StoredDeck[]>(DECKS_KEY, []);
  const binders = lsGet<StoredBinder[]>(BINDERS_KEY, []);
  for (const d of decks) localStorage.removeItem(`${DECK_CARDS_PREFIX}${d.id}`);
  for (const b of binders) localStorage.removeItem(`${BINDER_CARDS_PREFIX}${b.id}`);
  localStorage.removeItem(DECKS_KEY);
  localStorage.removeItem(BINDERS_KEY);
}

export function isMergeDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(DISMISSED_KEY) === "1";
}

export function dismissMerge(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISSED_KEY, "1");
}
```

- [ ] **Step 2: Verify with a temp-file node script** (localStorage stubbed; `npx tsx --eval` is known to swallow stdout on this machine — use a temp file)

Create `src/lib/utils/__tmpcheck.mts`:

```typescript
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
const { hasGuestData, guestDataSummary, collectGuestData, clearGuestData, isMergeDismissed, dismissMerge } = await import("./guestData");

const fail = (m: string) => { console.error("FAIL:", m); process.exit(1); };
if (hasGuestData()) fail("empty store should have no guest data");
store.set("mtg_guest_decks", JSON.stringify([{ id: "d1", name: "Burn", format: "modern" }]));
store.set("mtg_guest_deck_cards_d1", JSON.stringify([{ scryfallId: "x", name: "Lightning Bolt", quantity: 4, category: "main" }]));
store.set("mtg_guest_binders", JSON.stringify([{ id: "b1", name: "Trade Binder" }]));
store.set("mtg_guest_binder_cards_b1", JSON.stringify([{ scryfallId: "y", name: "Forest", quantity: 8 }]));
if (!hasGuestData()) fail("should detect guest data");
const s = guestDataSummary();
if (s.decks !== 1 || s.binders !== 1 || s.cards !== 2) fail("summary wrong: " + JSON.stringify(s));
const p = collectGuestData();
if (p.decks[0].deck.name !== "Burn" || p.decks[0].cards.length !== 1) fail("deck payload wrong");
if (p.binders[0].cards[0].name !== "Forest") fail("binder payload wrong");
if ((p.decks[0].deck as Record<string, unknown>).id) fail("guest ids must not leak into payload");
if (isMergeDismissed()) fail("not dismissed yet");
dismissMerge();
if (!isMergeDismissed()) fail("dismiss flag not set");
clearGuestData();
if (hasGuestData()) fail("clear did not remove data");
if (store.has("mtg_guest_deck_cards_d1")) fail("per-deck cards key not removed");
console.log("PASS: all guestData checks");
```

Run: `npx tsx src/lib/utils/__tmpcheck.mts` → `PASS: all guestData checks`. Then DELETE the temp file.

- [ ] **Step 3: tsc + eslint**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/lib/utils/guestData.ts` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/guestData.ts
git commit -m "feat: guest data collection utilities for account merge"
```

---

### Task 2: Bulk merge API route

**Files:**
- Create: `src/app/api/merge-guest-data/route.ts`

**Interfaces:**
- Consumes: `GuestMergePayload` shape from Task 1 (duplicated as a local interface — API routes don't import client-util types here; keep field names identical).
- Produces: `POST /api/merge-guest-data` — auth required (401 otherwise). Body: `GuestMergePayload`. Response 200: `{ decks: number, binders: number, cards: number, errors: string[] }` (counts = successfully inserted; `errors` = human-readable per-item failures, empty on full success). 400 on empty/invalid payload; 413 if body > 2 MB.

- [ ] **Step 1: Create `src/app/api/merge-guest-data/route.ts`**

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

interface GuestDeckCard {
  scryfallId: string; name: string; quantity: number; category: string;
  manaCost?: string; cmc?: number; typeLine?: string; rarity?: string;
  imageUri?: string; priceUsd?: string | null;
}
interface GuestBinderCard {
  scryfallId: string; name: string; quantity: number; condition?: string;
  isFoil?: boolean; setCode?: string; setName?: string; collectorNumber?: string;
  imageUri?: string; priceUsd?: string | null; typeLine?: string; rarity?: string;
}
interface MergeBody {
  decks?: { deck: { name: string; format?: string; description?: string; coverCardId?: string; coverImageUri?: string }; cards: GuestDeckCard[] }[];
  binders?: { binder: { name: string; description?: string; coverImageUri?: string }; cards: GuestBinderCard[] }[];
}

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const BATCH = 50;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: MergeBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const decks = body.decks ?? [];
  const binders = body.binders ?? [];
  if (decks.length === 0 && binders.length === 0) {
    return NextResponse.json({ error: "Nothing to merge" }, { status: 400 });
  }

  const sb = getSupabase();
  const now = new Date().toISOString();
  const errors: string[] = [];
  let deckCount = 0;
  let binderCount = 0;
  let cardCount = 0;

  // ── Decks ──
  for (const { deck, cards } of decks) {
    if (!deck?.name) { errors.push("Skipped a deck with no name"); continue; }
    const { data: row, error: deckError } = await sb
      .from("decks")
      .insert({
        user_id: userId,
        name: deck.name,
        format: deck.format ?? null,
        description: deck.description ?? null,
        cover_card_id: deck.coverCardId ?? null,
        cover_image_uri: deck.coverImageUri ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (deckError || !row) {
      errors.push(`Deck "${deck.name}": ${deckError?.message ?? "insert failed"}`);
      continue;
    }
    deckCount++;

    const cardRows = (cards ?? [])
      .filter((c) => c.scryfallId && c.name)
      .map((c) => ({
        deck_id: row.id,
        user_id: userId,
        scryfall_id: c.scryfallId,
        name: c.name,
        quantity: c.quantity ?? 1,
        category: c.category ?? "main",
        mana_cost: c.manaCost ?? null,
        cmc: c.cmc ?? null,
        type_line: c.typeLine ?? null,
        rarity: c.rarity ?? null,
        image_uri: c.imageUri ?? null,
        price_usd: c.priceUsd ?? null,
      }));
    for (let i = 0; i < cardRows.length; i += BATCH) {
      const batch = cardRows.slice(i, i + BATCH);
      const { error: cardError } = await sb.from("deck_cards").insert(batch);
      if (cardError) errors.push(`Deck "${deck.name}" cards: ${cardError.message}`);
      else cardCount += batch.length;
    }
  }

  // ── Binders ──
  for (const { binder, cards } of binders) {
    if (!binder?.name) { errors.push("Skipped a binder with no name"); continue; }
    const { data: row, error: binderError } = await sb
      .from("binders")
      .insert({
        user_id: userId,
        name: binder.name,
        description: binder.description ?? null,
        cover_image_uri: binder.coverImageUri ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (binderError || !row) {
      errors.push(`Binder "${binder.name}": ${binderError?.message ?? "insert failed"}`);
      continue;
    }
    binderCount++;

    const fullRows = (cards ?? [])
      .filter((c) => c.scryfallId && c.name)
      .map((c) => ({
        binder_id: row.id,
        user_id: userId,
        scryfall_id: c.scryfallId,
        name: c.name,
        quantity: c.quantity ?? 1,
        foil: c.isFoil ?? false,
        condition: c.condition ?? "near_mint",
        set_code: c.setCode ?? null,
        set_name: c.setName ?? null,
        collector_number: c.collectorNumber ?? null,
        image_uri: c.imageUri ?? null,
        price_usd: c.priceUsd ?? null,
        type_line: c.typeLine ?? null,
        rarity: c.rarity ?? null,
      }));
    for (let i = 0; i < fullRows.length; i += BATCH) {
      let batch: Record<string, unknown>[] = fullRows.slice(i, i + BATCH);
      let { error: cardError } = await sb.from("collection_cards").insert(batch);
      // Older schema fallback (mirrors /api/binders/[id]/cards): retry without optional columns
      if (cardError && (cardError.message.includes("collector_number") || cardError.message.includes("type_line") || cardError.message.includes("rarity"))) {
        batch = batch.map((r) => {
          const { collector_number, type_line, rarity, ...core } = r;
          void collector_number; void type_line; void rarity;
          return core;
        });
        ({ error: cardError } = await sb.from("collection_cards").insert(batch));
      }
      if (cardError) errors.push(`Binder "${binder.name}" cards: ${cardError.message}`);
      else cardCount += batch.length;
    }
  }

  return NextResponse.json({ decks: deckCount, binders: binderCount, cards: cardCount, errors });
}
```

- [ ] **Step 2: Verify — tsc, eslint, live 401/400 checks**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/app/api/merge-guest-data/route.ts` → clean.

Start the dev server (`npm run dev`, background — note the port it prints; use it below), then:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/merge-guest-data -H "Content-Type: application/json" -d '{"decks":[{"deck":{"name":"X"},"cards":[]}]}'
```

Expected: `401` (no Clerk session). Signed-in insert behavior cannot be verified without a session — state that explicitly in your report; the controller/user covers it on-device.

Kill the dev server if you started it.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/merge-guest-data/route.ts
git commit -m "feat: bulk guest-data merge endpoint"
```

---

### Task 3: MergeGuestPrompt component + layout mount

**Files:**
- Create: `src/components/layout/MergeGuestPrompt.tsx`
- Modify: `src/app/layout.tsx` (mount inside body, next to `<BottomNav />`)

**Interfaces:**
- Consumes: Task 1 utils (`hasGuestData`, `guestDataSummary`, `collectGuestData`, `clearGuestData`, `isMergeDismissed`, `dismissMerge`), Task 2 endpoint, `Modal`/`Button` UI kit, Clerk `useUser`.

- [ ] **Step 1: Create `src/components/layout/MergeGuestPrompt.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import {
  hasGuestData,
  guestDataSummary,
  collectGuestData,
  clearGuestData,
  isMergeDismissed,
  dismissMerge,
} from "@/lib/utils/guestData";

type Phase = "offer" | "merging" | "done" | "error";

export default function MergeGuestPrompt() {
  const { isSignedIn, isLoaded } = useUser();
  const [dismissedNow, setDismissedNow] = useState(false);
  const [phase, setPhase] = useState<Phase>("offer");
  const [result, setResult] = useState<{ decks: number; binders: number; cards: number; errors: string[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Render-time gate — no effects (repo lint forbids setState-in-effect).
  const eligible =
    isLoaded && isSignedIn === true && !dismissedNow && !isMergeDismissed() && hasGuestData();

  if (!eligible && phase === "offer") return null;

  const summary = guestDataSummary();

  async function handleMerge() {
    setPhase("merging");
    try {
      const res = await fetch("/api/merge-guest-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectGuestData()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Merge failed");
      setResult(data);
      if ((data.errors ?? []).length === 0) {
        clearGuestData();
      }
      setPhase("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Merge failed");
      setPhase("error");
    }
  }

  function handleClose() {
    // Reload after a successful merge so all data hooks refetch from the account.
    if (phase === "done") {
      window.location.reload();
      return;
    }
    setDismissedNow(true);
    setPhase("offer");
  }

  return (
    <Modal open onClose={handleClose} title="Bring your data with you">
      {phase === "offer" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            This device has {summary.decks} deck{summary.decks !== 1 ? "s" : ""}
            {summary.binders > 0 && <> and {summary.binders} binder{summary.binders !== 1 ? "s" : ""}</>}
            {" "}({summary.cards} cards) saved from before you signed in. Copy them into your
            account so they sync everywhere?
          </p>
          <Button onClick={handleMerge}>Bring my data</Button>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setDismissedNow(true)}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Not now
            </button>
            <button
              onClick={() => { dismissMerge(); setDismissedNow(true); }}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Don&apos;t ask again
            </button>
          </div>
        </div>
      )}

      {phase === "merging" && (
        <p className="text-sm text-text-secondary py-4 text-center">Copying your data…</p>
      )}

      {phase === "done" && result && (
        <div className="flex flex-col gap-4">
          <div className="bg-legal/10 border border-legal/20 rounded-xl p-3">
            <p className="text-sm text-legal">
              Copied {result.decks} deck{result.decks !== 1 ? "s" : ""}, {result.binders} binder
              {result.binders !== 1 ? "s" : ""}, {result.cards} cards to your account.
            </p>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-3">
              <p className="text-xs font-semibold text-banned mb-1">
                Some items couldn&apos;t be copied (your local copies are untouched):
              </p>
              <ul className="text-xs text-text-secondary space-y-0.5 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={`${e}-${i}`}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <Button onClick={handleClose}>Done</Button>
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-4">
          <div className="bg-banned/10 border border-banned/20 rounded-xl p-3">
            <p className="text-sm text-banned">{errorMsg}</p>
            <p className="text-xs text-text-secondary mt-1">
              Your local data is untouched. You can try again from this prompt next time.
            </p>
          </div>
          <Button onClick={handleClose}>Close</Button>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Mount in `src/app/layout.tsx`**

Add the import:

```tsx
import MergeGuestPrompt from "@/components/layout/MergeGuestPrompt";
```

In the body, after `<BottomNav />`:

```tsx
          <BottomNav />
          <MergeGuestPrompt />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/components/layout/MergeGuestPrompt.tsx src/app/layout.tsx` → clean (note: the component intentionally has NO `useEffect` — the eligibility check runs at render time — so the repo's `set-state-in-effect` rule can't fire). Run: `npm run build` → succeeds.

Guest-mode browser check (controller can also do this): as a guest with no data, no modal appears anywhere; seed `localStorage.mtg_guest_decks` with a deck while signed OUT → still no modal (prompt requires sign-in). The signed-in path (modal appears, merge copies, reload shows account data) requires a real Clerk session — explicitly flagged for on-device QA.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/MergeGuestPrompt.tsx src/app/layout.tsx
git commit -m "feat: guest data merge prompt on sign-in"
```

---

## Self-Review Notes

- **Spec 2b coverage:** detect guest data on sign-in ✓ (render-time gate, Clerk `isLoaded` guarded); one-tap migration ✓; non-destructive ✓ (clear only on zero-error success; partial failure keeps local + lists errors); conflict-safe ✓ (new rows, no ID reuse, duplicate names allowed — decks/binders are keyed by ID).
- **Spec correction recorded:** spec said "Dexie data (decks, binders, wishlist)" — reality is localStorage for all three, and wishlist has no server-side home to merge into (localStorage-only feature for signed-in users too), so it's excluded; life-counter Dexie data is by-design local for everyone.
- **Type consistency:** `GuestMergePayload` field names in Task 1 = `MergeBody` field names in Task 2 = what Task 3 posts (`collectGuestData()` output). Response `{ decks, binders, cards, errors }` consistent between Task 2 and Task 3's `result` state.
- **YAGNI:** no Settings re-trigger UI, no per-item selection, no dedupe-by-name — the prompt reappears next session after "Not now", which covers the retry path.
