# Deck Import (Phase 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any user — guest or signed-in — paste a Moxfield/Archidekt URL or a text decklist (including MTG Arena export format) and get a new, Scryfall-validated deck, with unresolved cards surfaced for review instead of silently dropped.

**Architecture:** Most plumbing already exists and is REUSED, not rebuilt: `parseDeckList` (`src/lib/utils/deckParser.ts`) handles plain text; `/api/import-deck` already fetches Moxfield/Archidekt decks, resolves via Scryfall `cards/collection` (75/batch), and persists to Supabase; the deck-editor `DeckImportExport` modal already does text import into an existing deck. This plan adds: MTGA-format support to the parser, a URL→source/id parser, a `persist:false` guest mode + skipped-card-names on the API, and a new `/decks/import` page that fronts it all.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, existing UI kit (`Modal`, `Button`, `Input`, `Tabs`), Clerk auth, Supabase (signed-in) / localStorage via `useDecks` (guest).

## Global Constraints

- **No new dependencies.**
- **Guests must be able to import.** Guest decks live in localStorage via `useDecks` (`mtg_guest_decks` + `mtg_guest_deck_cards_{id}` keys) — NOT Dexie. The API's `persist: false` mode returns resolved cards without requiring auth; the client saves locally.
- **Never silently drop cards** (spec 2a): every unresolved name is returned to and shown to the user.
- **Scryfall batching:** `POST https://api.scryfall.com/cards/collection`, identifiers ≤75 per request, ≥100ms between batches (matches existing code).
- **Moxfield reality:** `api2.moxfield.com` sits behind Cloudflare bot protection; unapproved User-Agents commonly get 403. Task 3 must handle 403 with a user-actionable message pointing to text export. Getting a whitelisted UA from Moxfield support is a user-gated follow-up, NOT this plan's job.
- **Do not modify** the existing deck-editor import modal (`src/components/decks/DeckImportExport.tsx`) or `ExploreDecks.tsx` import flow — they keep working as-is.
- **No test framework exists** (no jest/vitest; do not add one). Pure functions are verified with inline `node -e` scripts shown in each task; everything else = `npx tsc --noEmit` (pass), `npx eslint <changed files>` (no NEW errors), `npm run build` (final task). Browser checks deferred to controller.
- Work on branch `feat/deck-import`; do NOT push; commit per task with the given message + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `params`/`searchParams` in route handlers are Promises in Next 16 — always `await`.
- API routes: `const { userId } = await auth()` from `@clerk/nextjs/server`; Supabase via `getSupabase()` from `@/lib/supabase/server`; snake_case columns.

---

### Task 1: MTGA-format support in `parseDeckList`

**Files:**
- Modify: `src/lib/utils/deckParser.ts`

**Interfaces:**
- Produces: `parseDeckList(text: string): ParsedDeckEntry[]` (existing signature unchanged); `ParsedDeckEntry.category` union gains `"companion"`. Consumed by Task 4's UI and by the existing `DeckImportExport` modal (which passes categories straight to `addCardToDeck`, whose `DeckCategory` type already includes `"companion"`).

- [ ] **Step 1: Extend the category union and add MTGA handling**

In `src/lib/utils/deckParser.ts`, change the interface:

```typescript
export interface ParsedDeckEntry {
  quantity: number;
  name: string;
  category: "main" | "sideboard" | "commander" | "companion" | "maybeboard";
}
```

In `parseDeckList`, add a `companion` section header alongside the existing ones (after the `commander` block):

```typescript
    if (/^companion:?$/i.test(line)) {
      currentCategory = "companion";
      continue;
    }
    // MTG Arena "About" section: skip the header and its "Name X" line
    if (/^about:?$/i.test(line)) {
      skipNextName = true;
      continue;
    }
    if (skipNextName && /^name\s/i.test(line)) {
      skipNextName = false;
      continue;
    }
```

Declare `let skipNextName = false;` next to `let currentCategory`.

Then strip MTGA set/collector suffixes from parsed names. After the existing quantity match succeeds, clean the name before pushing:

```typescript
    // Strip MTGA export suffix: "Lightning Bolt (M21) 123" → "Lightning Bolt"
    // Set code in parens followed by a collector number at end of line.
    const cleanName = (raw: string) =>
      raw.replace(/\s*\(([A-Z0-9]{1,6})\)\s+[\w★-]+$/u, "").trim();
```

Apply `cleanName(match[2].trim())` in the quantity branch and `cleanName(line)` in the bare-name branch.

- [ ] **Step 2: Verify with an inline node script**

Run from `C:\Users\danlo\MTG-app` (Git Bash):

```bash
npx tsx --eval '
import { parseDeckList } from "./src/lib/utils/deckParser";
const arena = `About
Name Boros Burn
Deck
4 Lightning Bolt (M21) 123
4 Monastery Swiftspear (BRO) 144
20 Mountain (UNF) 240

Sideboard
2 Roiling Vortex (ZNR) 156
Companion
1 Lurrus of the Dream-Den (IKO) 226`;
const out = parseDeckList(arena);
const expect = (cond, msg) => { if (!cond) { console.error("FAIL:", msg, JSON.stringify(out, null, 1)); process.exit(1); } };
expect(out.length === 5, "5 entries");
expect(out[0].name === "Lightning Bolt" && out[0].quantity === 4 && out[0].category === "main", "bolt clean");
expect(out[2].name === "Mountain", "mountain clean");
expect(out[3].category === "sideboard" && out[3].name === "Roiling Vortex", "sideboard");
expect(out[4].category === "companion" && out[4].name === "Lurrus of the Dream-Den", "companion");
const plain = parseDeckList("4 Lightning Bolt\nFire // Ice\n1 Borrowing 100,000 Arrows");
expect(plain[1].name === "Fire // Ice", "split card untouched");
expect(plain[2].name === "Borrowing 100,000 Arrows", "comma name untouched");
console.log("PASS: all parser checks");
'
```

Expected: `PASS: all parser checks`. (If `npx tsx` is unavailable, install nothing — instead run `npx tsc --noEmit` and verify the same cases by adding a temporary `console.log` harness compiled via `npx tsc src/lib/utils/deckParser.ts --outDir /tmp/parser-check --module commonjs` and running it with node; delete the temp output after.)

- [ ] **Step 3: tsc + eslint**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/lib/utils/deckParser.ts` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/deckParser.ts
git commit -m "feat: MTGA export format support in deck parser"
```

---

### Task 2: Deck-URL parser utility

**Files:**
- Create: `src/lib/utils/deckUrl.ts`

**Interfaces:**
- Produces: `parseDeckUrl(input: string): { source: "moxfield" | "archidekt"; id: string } | null` — consumed by Task 3 (API) and Task 4 (UI validation).

- [ ] **Step 1: Create `src/lib/utils/deckUrl.ts`**

```typescript
export interface ParsedDeckUrl {
  source: "moxfield" | "archidekt";
  id: string;
}

/**
 * Extract source + deck id from a Moxfield or Archidekt deck URL.
 * Accepts with/without protocol and www. Returns null for anything else.
 *
 *   https://moxfield.com/decks/AbC12xYz            → { source: "moxfield",  id: "AbC12xYz" }
 *   https://archidekt.com/decks/1234567/my-deck    → { source: "archidekt", id: "1234567" }
 */
export function parseDeckUrl(input: string): ParsedDeckUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "moxfield.com" || host === "api2.moxfield.com") {
    const m = url.pathname.match(/^\/(?:decks|v2\/decks\/all)\/([A-Za-z0-9_-]+)\/?$/);
    if (m) return { source: "moxfield", id: m[1] };
    return null;
  }

  if (host === "archidekt.com") {
    const m = url.pathname.match(/^\/(?:api\/)?decks\/(\d+)(?:\/|$)/);
    if (m) return { source: "archidekt", id: m[1] };
    return null;
  }

  return null;
}
```

- [ ] **Step 2: Verify with an inline node script**

```bash
npx tsx --eval '
import { parseDeckUrl } from "./src/lib/utils/deckUrl";
const cases: [string, unknown][] = [
  ["https://moxfield.com/decks/AbC12xYz", { source: "moxfield", id: "AbC12xYz" }],
  ["www.moxfield.com/decks/AbC12xYz", { source: "moxfield", id: "AbC12xYz" }],
  ["https://archidekt.com/decks/1234567/boros-burn", { source: "archidekt", id: "1234567" }],
  ["archidekt.com/decks/1234567", { source: "archidekt", id: "1234567" }],
  ["https://archidekt.com/decks/abc", null],
  ["https://tappedout.net/mtg-decks/foo", null],
  ["not a url at all", null],
  ["", null],
];
for (const [input, want] of cases) {
  const got = parseDeckUrl(input);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.error("FAIL:", input, "got", got, "want", want); process.exit(1);
  }
}
console.log("PASS: all url checks");
'
```

Expected: `PASS: all url checks`.

- [ ] **Step 3: tsc + eslint**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/lib/utils/deckUrl.ts` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/deckUrl.ts
git commit -m "feat: deck URL parser for Moxfield/Archidekt links"
```

---

### Task 3: `/api/import-deck` — URL input, guest mode, skipped names, Moxfield 403 handling

**Files:**
- Modify: `src/app/api/import-deck/route.ts`

**Interfaces:**
- Consumes: `parseDeckUrl` from Task 2.
- Produces (request): `POST { url?: string; source?: string; deckId?: string; persist?: boolean }` — either `url` OR (`source` + `deckId`); `persist` defaults to `true`.
- Produces (response, persist=true, auth required): `{ deckId, name, format, totalCards, importedCards, skipped: string[] }`.
- Produces (response, persist=false, NO auth required): `{ name, format, totalCards, skipped: string[], cards: { quantity, category, card: ScryfallCard-shaped }[] }` — Task 4's guest path consumes `cards[].card` fields: `id, name, mana_cost, cmc, type_line, rarity, image_uris, card_faces, prices`.
- Existing behavior preserved: `ExploreDecks.tsx` posts `{ source, deckId }` and reads `deckId/name/importedCards/skippedCards` — keep returning `skippedCards` (count) alongside the new `skipped` (names) so it doesn't break.

- [ ] **Step 1: Rework the POST handler**

Replace the `POST` function (keep all fetch/resolve helpers above it unchanged except where noted):

```typescript
import { parseDeckUrl } from "@/lib/utils/deckUrl";

export async function POST(req: Request) {
  const body = await req.json();
  const { url, persist = true } = body as { url?: string; persist?: boolean };
  let { source, deckId } = body as { source?: string; deckId?: string };

  // URL input: parse into source + id
  if (url) {
    const parsed = parseDeckUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "Unrecognized URL. Paste a Moxfield or Archidekt deck link." },
        { status: 400 }
      );
    }
    source = parsed.source;
    deckId = parsed.id;
  }

  if (!source || !deckId) {
    return NextResponse.json({ error: "url, or source and deckId, are required" }, { status: 400 });
  }

  // Auth only needed when persisting server-side
  let userId: string | null = null;
  if (persist) {
    ({ userId } = await auth());
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch deck from external source
    let deckData: { name: string; format: string; cards: ImportCard[] };
    if (source === "archidekt") {
      deckData = await fetchArchidektDeck(deckId);
    } else if (source === "moxfield") {
      deckData = await fetchMoxfieldDeck(deckId);
    } else {
      return NextResponse.json({ error: "Unsupported source" }, { status: 400 });
    }

    if (deckData.cards.length === 0) {
      return NextResponse.json({ error: "Deck has no cards" }, { status: 400 });
    }

    // 2. Resolve cards via Scryfall
    const resolved = await resolveCards(deckData.cards);
    const resolvedKeys = new Set(resolved.map((c) => c.name.toLowerCase()));
    const skipped = deckData.cards
      .filter((c) => !resolvedKeys.has(c.name.toLowerCase()))
      .map((c) => c.name);

    // 3a. Guest mode: return the resolved deck without persisting
    if (!persist) {
      return NextResponse.json({
        name: deckData.name,
        format: deckData.format,
        totalCards: deckData.cards.length,
        skipped,
        cards: resolved.map((c) => ({
          quantity: c.quantity,
          category: c.category,
          card: c.resolved,
        })),
      });
    }

    // 3b. Persist to Supabase (unchanged logic below)
```

The remainder of the handler (Supabase deck insert, batched card insert) stays exactly as it is, except the final success response becomes:

```typescript
    return NextResponse.json({
      deckId: deck.id,
      name: deckData.name,
      format: deckData.format,
      totalCards: deckData.cards.length,
      importedCards: insertedCount,
      skippedCards: deckData.cards.length - resolved.length, // kept for ExploreDecks
      skipped,
    });
```

- [ ] **Step 2: Friendly Moxfield 403**

In `fetchMoxfieldDeck`, replace the bare error:

```typescript
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        "Moxfield blocks third-party imports. On Moxfield: open your deck → Export → Copy for MTGA, then paste it in the Text tab here."
      );
    }
    throw new Error(`Moxfield returned ${res.status}`);
  }
```

- [ ] **Step 3: Live verification (dev server must be running: `npm run dev`, note the port it prints)**

Archidekt (public API, should succeed) — pick any public deck id from archidekt.com's front page, e.g. browse https://archidekt.com/search/decks and copy one; then:

```bash
curl -s -X POST http://localhost:3001/api/import-deck \
  -H "Content-Type: application/json" \
  -d '{"url":"https://archidekt.com/decks/<REAL_ID>/whatever","persist":false}' | head -c 600
```

Expected: JSON starting with `{"name":"..."` containing `"cards":[` and `"skipped":[`. NOT a 401 (guest mode must not require auth).

Moxfield (expected to 403 through Cloudflare):

```bash
curl -s -X POST http://localhost:3001/api/import-deck \
  -H "Content-Type: application/json" \
  -d '{"url":"https://moxfield.com/decks/7g1DkYUeF0WsIBpaSSTiEA","persist":false}' | head -c 400
```

Expected: either a valid deck JSON (if the UA happens to pass) or `{"error":"Moxfield blocks third-party imports..."}` — both acceptable; a raw `{"error":"Moxfield returned 403"}` is NOT (means Step 2 regressed). Record which outcome occurred in your report.

Also verify persist mode still guards auth:

```bash
curl -s -X POST http://localhost:3001/api/import-deck \
  -H "Content-Type: application/json" \
  -d '{"url":"https://archidekt.com/decks/<REAL_ID>","persist":true}' | head -c 200
```

Expected: `{"error":"Unauthorized"}` (401) since curl has no Clerk session.

- [ ] **Step 4: tsc + eslint**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/app/api/import-deck/route.ts` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/import-deck/route.ts
git commit -m "feat: import-deck API - URL input, guest mode, skipped names"
```

---

### Task 4: Import page — `/decks/import`

**Files:**
- Create: `src/app/decks/import/page.tsx`
- Create: `src/components/decks/ImportDeckClient.tsx`

**Interfaces:**
- Consumes: `parseDeckUrl` (Task 2), `parseDeckList` (Task 1), `/api/import-deck` (Task 3), `useDecks().createDeck/addCardToDeck/updateDeck`, UI kit `Input`, `Button`, `Tabs`, `TopBar`, `PageContainer`.
- Produces: the user-facing import flow. Two tabs: **Link** (Moxfield/Archidekt URL) and **Text** (paste list, MTGA supported). Both end in a review state showing imported/skipped, then navigate to the new deck.

- [ ] **Step 1: Create `src/app/decks/import/page.tsx`**

```tsx
import type { Metadata } from "next";
import ImportDeckClient from "@/components/decks/ImportDeckClient";

export const metadata: Metadata = { title: "Import Deck — MTG Houdini" };

export default function ImportDeckPage() {
  return <ImportDeckClient />;
}
```

- [ ] **Step 2: Create `src/components/decks/ImportDeckClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import TopBar from "@/components/layout/TopBar";
import PageContainer from "@/components/layout/PageContainer";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import { useDecks } from "@/hooks/useDecks";
import { parseDeckUrl } from "@/lib/utils/deckUrl";
import { parseDeckList } from "@/lib/utils/deckParser";
import type { DeckCategory } from "@/types/deck";
import type { ScryfallCard } from "@/types/card";

const TABS = [
  { value: "link", label: "From Link" },
  { value: "text", label: "Paste Text" },
];

interface ResolvedEntry {
  quantity: number;
  category: DeckCategory;
  card: Partial<ScryfallCard> & { id: string; name: string };
}

interface ImportOutcome {
  deckId: string;
  name: string;
  imported: number;
  skipped: string[];
}

export default function ImportDeckClient() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { createDeck, updateDeck, addCardToDeck } = useDecks();

  const [tab, setTab] = useState("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  const urlValid = parseDeckUrl(url) !== null;

  // Save an already-resolved card list as a new local/remote deck via useDecks.
  async function saveResolvedDeck(
    name: string,
    format: string | undefined,
    entries: ResolvedEntry[],
    skipped: string[]
  ) {
    setStatus(`Creating "${name}"…`);
    const deckId = await createDeck(name, format);
    const cover = entries.find(
      (e) => e.card.image_uris?.normal || e.card.card_faces?.[0]?.image_uris?.normal
    );
    if (cover) {
      await updateDeck(deckId, {
        coverCardId: cover.card.id,
        coverImageUri:
          cover.card.image_uris?.normal ?? cover.card.card_faces?.[0]?.image_uris?.normal,
      });
    }
    let done = 0;
    for (const e of entries) {
      await addCardToDeck(deckId, e.card, e.category, e.quantity);
      done++;
      if (done % 20 === 0) setStatus(`Adding cards… ${done}/${entries.length}`);
    }
    setOutcome({ deckId, name, imported: entries.length, skipped });
  }

  async function handleLinkImport() {
    setBusy(true);
    setError(null);
    setStatus("Fetching deck…");
    try {
      if (isSignedIn) {
        // Server persists directly to Supabase
        const res = await fetch("/api/import-deck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, persist: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        setOutcome({
          deckId: data.deckId,
          name: data.name,
          imported: data.importedCards,
          skipped: data.skipped ?? [],
        });
      } else {
        // Guest: resolve server-side, save locally
        const res = await fetch("/api/import-deck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, persist: false }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        await saveResolvedDeck(data.name, data.format, data.cards, data.skipped ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function handleTextImport() {
    const entries = parseDeckList(text);
    if (entries.length === 0) {
      setError("Nothing to import — paste a deck list first.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Looking up cards…");
    try {
      // Resolve names via Scryfall collection endpoint (75/batch, 120ms apart)
      const CHUNK = 75;
      const resolved: ResolvedEntry[] = [];
      const skipped: string[] = [];
      for (let i = 0; i < entries.length; i += CHUNK) {
        const chunk = entries.slice(i, i + CHUNK);
        const res = await fetch("https://api.scryfall.com/cards/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifiers: chunk.map((e) => ({ name: e.name })) }),
        });
        if (!res.ok) {
          skipped.push(...chunk.map((e) => e.name));
          continue;
        }
        const data = await res.json();
        const found = new Map<string, ScryfallCard>(
          (data.data ?? []).map((c: ScryfallCard) => [c.name.toLowerCase(), c])
        );
        for (const entry of chunk) {
          // Scryfall returns full "Front // Back" names; match either exact or front-face
          const card =
            found.get(entry.name.toLowerCase()) ??
            [...found.values()].find((c) =>
              c.name.toLowerCase().startsWith(entry.name.toLowerCase() + " //")
            );
          if (card) {
            resolved.push({ quantity: entry.quantity, category: entry.category, card });
          } else {
            skipped.push(entry.name);
          }
        }
        if (i + CHUNK < entries.length) await new Promise((r) => setTimeout(r, 120));
      }
      if (resolved.length === 0) {
        setError("No cards could be found. Check the list format and spelling.");
        return;
      }
      const deckName = `Imported Deck ${new Date().toLocaleDateString()}`;
      await saveResolvedDeck(deckName, undefined, resolved, skipped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <>
      <TopBar title="Import Deck" showBack />
      <PageContainer>
        <div className="max-w-lg mx-auto w-full flex flex-col gap-4">
          {!outcome && (
            <>
              <Tabs tabs={TABS} active={tab} onChange={(v) => { setTab(v); setError(null); }} />

              {tab === "link" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-text-secondary">
                    Paste a Moxfield or Archidekt deck link.
                  </p>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://moxfield.com/decks/…"
                    autoFocus
                  />
                  {url.trim() && !urlValid && (
                    <p className="text-xs text-banned">
                      That doesn&apos;t look like a Moxfield or Archidekt deck link.
                    </p>
                  )}
                  <Button onClick={handleLinkImport} disabled={!urlValid || busy}>
                    {busy ? status || "Importing…" : "Import Deck"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-text-secondary">
                    Paste any deck list — plain text or MTG Arena export. Section headers
                    (Deck, Sideboard, Commander, Companion) are recognized.
                  </p>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={"4 Lightning Bolt (M21) 123\n20 Mountain\n\nSideboard\n2 Roiling Vortex"}
                    className="w-full h-56 input-base p-3 resize-none font-mono text-sm"
                  />
                  <Button onClick={handleTextImport} disabled={!text.trim() || busy}>
                    {busy ? status || "Importing…" : "Import Deck"}
                  </Button>
                </div>
              )}

              {error && (
                <div className="bg-banned/10 border border-banned/20 rounded-xl p-3">
                  <p className="text-sm text-banned">{error}</p>
                </div>
              )}
            </>
          )}

          {outcome && (
            <div className="flex flex-col gap-4 animate-scale-in">
              <div className="bg-legal/10 border border-legal/20 rounded-xl p-4">
                <p className="text-sm font-semibold text-legal">
                  Imported &quot;{outcome.name}&quot; — {outcome.imported} card
                  {outcome.imported !== 1 ? "s" : ""}
                </p>
              </div>

              {outcome.skipped.length > 0 && (
                <div className="bg-bg-card border border-border rounded-xl p-4">
                  <p className="text-xs font-semibold text-banned mb-2">
                    Couldn&apos;t find {outcome.skipped.length} card
                    {outcome.skipped.length !== 1 ? "s" : ""} — add them manually in the deck
                    editor:
                  </p>
                  <ul className="text-xs text-text-secondary space-y-1 max-h-40 overflow-y-auto">
                    {outcome.skipped.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button onClick={() => router.push(`/decks/${outcome.deckId}`)}>
                Open Deck
              </Button>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}
```

- [ ] **Step 3: tsc + eslint**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/app/decks/import/page.tsx src/components/decks/ImportDeckClient.tsx` → clean. (If `ScryfallCard`'s type doesn't structurally accept the API's card shape in `saveResolvedDeck`, the `Partial<ScryfallCard> & { id: string; name: string }` in `ResolvedEntry` is the compatibility contract — adjust casts there, not in `useDecks`.)

- [ ] **Step 4: Commit**

```bash
git add src/app/decks/import/page.tsx src/components/decks/ImportDeckClient.tsx
git commit -m "feat: deck import page - link and text import for guests and users"
```

---

### Task 5: Entry point on decks page + final verification

**Files:**
- Modify: `src/components/decks/DecksPageClient.tsx` (add Import button beside the AI Deck Builder banner, ~line 118)

**Interfaces:**
- Consumes: `/decks/import` route from Task 4.

- [ ] **Step 1: Add the Import entry**

In `DecksPageClient.tsx`, directly after the AI Deck Builder button block (the `onClick={() => router.push("/decks/ai-builder")}` element ending ~line 140), add a sibling with the same visual pattern (copy the AI banner's outer classes exactly as they appear in the file, swapping content):

```tsx
            {/* Import Deck button */}
            <button
              onClick={() => router.push("/decks/import")}
              className="w-full flex items-center gap-3 glass-card border border-accent/20 rounded-2xl px-4 py-3 hover:border-accent/40 transition-colors active:scale-[0.99]"
            >
              <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold text-text-primary">Import Deck</p>
                <p className="text-xs text-text-muted truncate">From Moxfield, Archidekt, or any text list</p>
              </div>
              <svg className="ml-auto w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
```

Note: before inserting, read the AI Deck Builder button's actual wrapper classes in the file and mirror its container structure (it may be a `<button>` or a wrapped `<div>`) so the two banners render as visual siblings. The SVG (download-tray icon) and copy above are exact; the wrapper classes defer to what's in the file.

- [ ] **Step 2: Full verification**

Run: `npx tsc --noEmit` → PASS. Run: `npx eslint src/components/decks/DecksPageClient.tsx` → clean. Run: `npm run build` → succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/decks/DecksPageClient.tsx
git commit -m "feat: import deck entry point on decks page"
```

Browser verification (controller, after all tasks): `/decks` shows Import banner → `/decks/import` → paste an Archidekt URL as guest → deck created locally with skipped-cards list shown → Open Deck works; text tab with an MTGA export; signed-in URL import persists to Supabase.

---

## Self-Review Notes

- **Spec 2a coverage:** URL paste (Tasks 2-4) ✓; text paste incl. MTGA (Tasks 1, 4) ✓; Scryfall batch validation reused (existing `resolveCards`, client chunker in Task 4) ✓; per-card error review, never silent (Task 3 `skipped` names + Task 4 outcome panel) ✓; works for guests (Task 3 `persist:false` + Task 4 local save path) ✓.
- **Deliberately NOT done (YAGNI / reuse):** no changes to the deck-editor import modal or ExploreDecks (both keep working; ExploreDecks gets `skipped` names in its response for free but isn't required to render them); no editable-line re-try UI — the skipped list + deck editor's autocomplete covers the spec's "kept editable" intent at lower complexity.
- **Type consistency:** `ParsedDeckEntry.category` (Task 1) ⊂ `DeckCategory`; `ResolvedEntry.card` (Task 4) matches what Task 3's `persist:false` returns (`c.resolved` = ScryfallCard-shaped) and what `addCardToDeck(deckId, card: Partial<ScryfallCard>, category, quantity)` accepts.
- **Moxfield 403** is handled at fetch (Task 3 Step 2) and surfaces verbatim in the UI's error panel (Task 4), steering users to the Text tab.
