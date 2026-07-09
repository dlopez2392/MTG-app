# Public Deck Sharing (Phase 2c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any deck flagged public gets a read-only page at `/d/[deckId]` (cover hero, grouped decklist, mana curve, total value) with an auto-generated OG preview image so links unfurl in Discord/X — plus a copy-link button in the deck editor.

**Architecture:** Reuses what exists: the `decks.public` column, the PUT whitelist (`src/app/api/decks/[id]/route.ts:29` already accepts `public`), and the editor's eye toggle (`DeckEditorPageClient.tsx:59-78`, currently labeled for playgroup visibility — its meaning broadens to "anyone with the link", tooltip updated accordingly). New: a server-component page at `src/app/d/[id]/page.tsx` reading Supabase directly (no auth, `public=true` gate), an `opengraph-image.tsx` sibling using `next/og`'s `ImageResponse` (built into Next, no new dependency), and a copy-link button beside the toggle.

**Tech Stack:** Next.js 16 App Router (RSC + `generateMetadata` + `ImageResponse`), Supabase via `getSupabase()`, existing `calculateDeckStats` + `ManaCurveChart`, Tailwind v4.

## Global Constraints

- **No new dependencies** (`next/og` ships with Next).
- **Privacy gate is absolute:** `/d/[id]` and its OG image return 404 unless the deck row has `public = true`. Never expose `user_id` or any owner-identifying field in the rendered page, metadata, or OG image.
- **Live schema (verified 2026-07-09, do NOT trust docs/architecture.md):** `decks` columns = `id, user_id, name, format, cover_card_id, cover_image_uri, created_at, updated_at, public`. There is NO `description` and NO `slug` column — the share URL uses the deck UUID (`/d/{uuid}`), no migration needed (migrations are user-gated in this repo).
- Validate the `[id]` param as a UUID (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) before querying.
- `params` is a `Promise` in Next 16 route files — always `await params`.
- Guest decks (localStorage) cannot be shared — the copy-link button only renders for signed-in users' decks (which is implicit: the editor's toggle already only affects server decks via the PUT; a guest toggling `public` writes only to localStorage and `/d/{guest-uuid}` will 404. Acceptable; the toggle+copy affordances must therefore be hidden for guests — gate on `isSignedIn`).
- `metadataBase` is `https://mtghoudini.com` (set in root layout) — OG URLs resolve from it automatically; the copy-link button uses `window.location.origin` so it works on previews too.
- No test framework (do not add one). Verification = `npx tsc --noEmit`, `npx eslint <changed files>`, `npm run build`, plus live dev-server curl checks (a non-public/nonexistent deck 404s) and a browser check of a public page (a public deck exists in prod data; for local verification create one via the API is impossible without a session — instead the page is verified with a temporary local `public=true` row IF one exists, otherwise via the 404 paths + build; note honestly which ran).
- Work on branch `feat/deck-sharing`; do NOT push; commit per task with the given message + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Public deck fetch helper + `/d/[id]` page

**Files:**
- Create: `src/lib/publicDeck.ts` (server-only fetch helper shared by page + OG image)
- Create: `src/app/d/[id]/page.tsx`

**Interfaces:**
- Produces: `getPublicDeck(id: string): Promise<PublicDeck | null>` where `PublicDeck = { name: string; format: string | null; coverImageUri: string | null; updatedAt: string; cards: PublicDeckCard[] }` and `PublicDeckCard = { scryfallId: string; name: string; quantity: number; category: string; manaCost?: string; cmc?: number; typeLine?: string; rarity?: string; imageUri?: string; priceUsd?: string | null }`. Returns `null` for invalid UUID, missing deck, or `public !== true`. Task 2's OG image imports the same helper.

- [ ] **Step 1: Create `src/lib/publicDeck.ts`**

```typescript
import { getSupabase } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PublicDeckCard {
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

export interface PublicDeck {
  name: string;
  format: string | null;
  coverImageUri: string | null;
  updatedAt: string;
  cards: PublicDeckCard[];
}

/** Fetch a deck for public display. Returns null unless the deck exists AND is public. */
export async function getPublicDeck(id: string): Promise<PublicDeck | null> {
  if (!UUID_RE.test(id)) return null;

  const sb = getSupabase();
  const { data: deck, error } = await sb
    .from("decks")
    .select("name, format, cover_image_uri, updated_at, public")
    .eq("id", id)
    .single();
  if (error || !deck || deck.public !== true) return null;

  const { data: cards } = await sb
    .from("deck_cards")
    .select("scryfall_id, name, quantity, category, mana_cost, cmc, type_line, rarity, image_uri, price_usd")
    .eq("deck_id", id);

  return {
    name: deck.name as string,
    format: (deck.format as string | null) ?? null,
    coverImageUri: (deck.cover_image_uri as string | null) ?? null,
    updatedAt: deck.updated_at as string,
    cards: (cards ?? []).map((c) => ({
      scryfallId: c.scryfall_id as string,
      name: c.name as string,
      quantity: (c.quantity as number) ?? 1,
      category: (c.category as string) ?? "main",
      manaCost: (c.mana_cost as string) ?? undefined,
      cmc: (c.cmc as number) ?? undefined,
      typeLine: (c.type_line as string) ?? undefined,
      rarity: (c.rarity as string) ?? undefined,
      imageUri: (c.image_uri as string) ?? undefined,
      priceUsd: (c.price_usd as string | null) ?? null,
    })),
  };
}
```

- [ ] **Step 2: Create `src/app/d/[id]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicDeck } from "@/lib/publicDeck";
import { calculateDeckStats } from "@/lib/utils/deckStats";
import ManaCurveChart from "@/components/decks/stats/ManaCurveChart";
import ManaCost from "@/components/cards/ManaCost";
import type { DeckCard } from "@/types/deck";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const deck = await getPublicDeck(id);
  if (!deck) return { title: "Deck not found — MTG Houdini" };
  const count = deck.cards.reduce((s, c) => s + c.quantity, 0);
  return {
    title: `${deck.name} — MTG Houdini`,
    description: `${deck.format ? deck.format.charAt(0).toUpperCase() + deck.format.slice(1) + " deck" : "Deck"} · ${count} cards · shared via MTG Houdini`,
  };
}

const CATEGORY_ORDER = ["commander", "companion", "main", "sideboard", "maybeboard"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  commander: "Commander",
  companion: "Companion",
  main: "Mainboard",
  sideboard: "Sideboard",
  maybeboard: "Maybeboard",
};

export default async function PublicDeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await getPublicDeck(id);
  if (!deck) notFound();

  // calculateDeckStats expects DeckCard[]; PublicDeckCard is structurally compatible
  // apart from the required deckId field.
  const stats = calculateDeckStats(deck.cards.map((c) => ({ ...c, deckId: id } as DeckCard)));
  const totalCount = deck.cards.reduce((s, c) => s + c.quantity, 0);

  const groups = CATEGORY_ORDER
    .map((cat) => ({
      cat,
      label: CATEGORY_LABELS[cat],
      cards: deck.cards
        .filter((c) => c.category === cat)
        .sort((a, b) => (a.cmc ?? 0) - (b.cmc ?? 0) || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.cards.length > 0);

  return (
    <main className="flex-1 w-full max-w-2xl lg:max-w-4xl mx-auto px-4 pb-24 animate-page-enter">
      {/* Hero */}
      <div className="relative -mx-4 mb-4 overflow-hidden">
        {deck.coverImageUri && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deck.coverImageUri}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
        <div className="relative z-10 px-4 pt-16 pb-4">
          <p className="text-label text-accent mb-1">Shared deck</p>
          <h1 className="font-display text-3xl font-black uppercase tracking-wide text-text-primary">
            {deck.name}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {deck.format ? deck.format.charAt(0).toUpperCase() + deck.format.slice(1) : "No format"} · {totalCount} cards
            {stats.totalValue > 0 && <> · ${stats.totalValue.toFixed(2)}</>}
          </p>
        </div>
      </div>

      {/* Mana curve */}
      <div className="glass-card border border-border rounded-2xl p-4 mb-4">
        <p className="text-section-label text-text-muted mb-2">Mana curve</p>
        <ManaCurveChart manaCurve={stats.manaCurve} />
      </div>

      {/* Decklist */}
      {groups.map((group) => (
        <div key={group.cat} className="glass-card border border-border rounded-2xl p-4 mb-4">
          <p className="text-section-label text-text-muted mb-2">
            {group.label} ({group.cards.reduce((s, c) => s + c.quantity, 0)})
          </p>
          <ul className="divide-y divide-border/50">
            {group.cards.map((card) => (
              <li key={`${card.scryfallId}-${card.category}`} className="flex items-center gap-2 py-1.5">
                <span className="text-xs text-text-muted w-6 text-right tabular-nums shrink-0">
                  {card.quantity}×
                </span>
                <span className="text-sm text-text-primary truncate">{card.name}</span>
                {card.manaCost && (
                  <span className="ml-auto shrink-0">
                    <ManaCost cost={card.manaCost} size="sm" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* CTA */}
      <div className="glass-card border border-accent/20 rounded-2xl p-4 text-center">
        <p className="text-sm text-text-secondary mb-3">
          Built with MTG Houdini — deck building, life counter, AI coach and more.
        </p>
        <Link
          href="/"
          className="inline-block btn-gradient rounded-xl px-6 py-2.5 text-sm font-bold"
        >
          Try MTG Houdini
        </Link>
      </div>
    </main>
  );
}
```

Note: `ManaCost`'s props — verify its actual signature in `src/components/cards/ManaCost.tsx` before use; if it takes `cost: string` without `size`, drop the `size` prop (adjust to the real interface, do not modify ManaCost).

- [ ] **Step 3: Verify**

`npx tsc --noEmit` → PASS. `npx eslint src/lib/publicDeck.ts src/app/d/[id]/page.tsx` → clean. `npm run build` → succeeds and the route table lists `/d/[id]`.

Live 404 checks (dev server running, port from startup output):

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/d/not-a-uuid
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/d/00000000-0000-4000-8000-000000000000
```

Expected: `404` twice (invalid format; valid-format-but-nonexistent). A positive render check needs a real public deck row — if none exists locally you cannot create one without a Clerk session; note that the positive path is covered by the controller/user post-merge.

- [ ] **Step 4: Commit**

```bash
git add src/lib/publicDeck.ts src/app/d/[id]/page.tsx
git commit -m "feat: public deck page at /d/[id]"
```

---

### Task 2: OG preview image

**Files:**
- Create: `src/app/d/[id]/opengraph-image.tsx`

**Interfaces:**
- Consumes: `getPublicDeck` from Task 1.

- [ ] **Step 1: Create `src/app/d/[id]/opengraph-image.tsx`**

```tsx
import { ImageResponse } from "next/og";
import { getPublicDeck } from "@/lib/publicDeck";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Shared MTG deck";

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await getPublicDeck(id);

  const name = deck?.name ?? "Deck not found";
  const count = deck ? deck.cards.reduce((s, c) => s + c.quantity, 0) : 0;
  const format = deck?.format ? deck.format.charAt(0).toUpperCase() + deck.format.slice(1) : null;
  const cover = deck?.coverImageUri ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#0B0E14",
          position: "relative",
        }}
      >
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.35,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "linear-gradient(to top, #0B0E14 10%, rgba(11,14,20,0.6) 50%, rgba(11,14,20,0.3) 100%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 64,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", color: "#ED9A57", fontSize: 28, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            MTG Houdini
          </div>
          <div
            style={{
              display: "flex",
              color: "#E8EAF0",
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.1,
              marginTop: 8,
              maxWidth: 1000,
            }}
          >
            {name.length > 40 ? name.slice(0, 40) + "…" : name}
          </div>
          {deck && (
            <div style={{ display: "flex", color: "#8B90A0", fontSize: 32, marginTop: 12 }}>
              {format ? `${format} · ` : ""}{count} cards
            </div>
          )}
        </div>
      </div>
    ),
    size
  );
}
```

Notes for the implementer: `next/og` JSX supports only a flexbox subset — every div with children needs `display: "flex"`. Do not import app CSS or Tailwind classes here; inline styles only. The privacy gate is inherited from `getPublicDeck` returning null (image then renders the neutral "Deck not found" card with no deck data — acceptable and leak-free).

- [ ] **Step 2: Verify**

`npx tsc --noEmit` → PASS. `npx eslint src/app/d/[id]/opengraph-image.tsx` → clean. `npm run build` → succeeds.

Live: with the dev server running,

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:3000/d/00000000-0000-4000-8000-000000000000/opengraph-image
```

Expected: `200 image/png` (the neutral not-found card — the route itself renders for any UUID-shaped id; deck DATA only appears when public). Confirm the bytes are a PNG: `curl -s http://localhost:3000/d/00000000-0000-4000-8000-000000000000/opengraph-image | head -c 8 | xxd` starts with `8950 4e47` (PNG magic).

- [ ] **Step 3: Commit**

```bash
git add src/app/d/[id]/opengraph-image.tsx
git commit -m "feat: OG preview image for shared deck pages"
```

---

### Task 3: Copy-link affordance + toggle copy update

**Files:**
- Modify: `src/components/decks/DeckEditorPageClient.tsx` (the eye-toggle block at ~lines 59-78)

**Interfaces:**
- Consumes: the `/d/[id]` route from Task 1; existing `deck?.public` state + `updateDeck`.

- [ ] **Step 1: Update the toggle block**

The file already imports `useUser`? Check the imports — if not, add `import { useUser } from "@clerk/nextjs";` and inside the component `const { isSignedIn, isLoaded } = useUser();`. Also add a copied-state: `const [linkCopied, setLinkCopied] = useState(false);` (the file already imports `useState`).

Replace the existing eye-toggle `<button>` block (lines ~59-78, the one calling `updateDeck(deckId, { public: next })`) with a signed-in-gated fragment containing the toggle (tooltips updated to the new meaning) plus a share button that appears when public:

```tsx
            {isLoaded && isSignedIn && (
              <>
                <button
                  onClick={async () => {
                    const next = !deck?.public;
                    await updateDeck(deckId, { public: next });
                    setDeck((d) => d ? { ...d, public: next } : d);
                  }}
                  className={`p-1.5 transition-colors ${deck?.public ? "text-accent" : "text-text-secondary hover:text-text-primary"}`}
                  title={deck?.public ? "Deck is public — anyone with the link can view it" : "Deck is private — click to make it shareable"}
                >
                  {deck?.public ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                      <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  )}
                </button>
                {deck?.public && (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/d/${deckId}`);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }}
                    className={`p-1.5 transition-colors ${linkCopied ? "text-legal" : "text-text-secondary hover:text-accent"}`}
                    title={linkCopied ? "Link copied!" : "Copy share link"}
                  >
                    {linkCopied ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                      </svg>
                    )}
                  </button>
                )}
              </>
            )}
```

(The SVGs for the eye states are the file's existing ones — preserve them exactly; the diff should show only the wrapper gate, tooltip strings, and the new share button.)

- [ ] **Step 2: Verify**

`npx tsc --noEmit` → PASS. `npx eslint src/components/decks/DeckEditorPageClient.tsx` → no NEW errors. `npm run build` → succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/decks/DeckEditorPageClient.tsx
git commit -m "feat: share-link copy button and public-toggle copy update"
```

---

## Self-Review Notes

- **Spec 2c coverage:** share toggle ✓ (pre-existing, semantics broadened + copy updated); public read-only page with hero/decklist/curve/price ✓ (Task 1); OG image for unfurls ✓ (Task 2); viral-loop CTA on the page ✓ (Task 1's footer). "Slug" from the spec resolved as deck UUID — no slug column exists and migrations are user-gated (recorded in Global Constraints).
- **Privacy:** page + OG gate on `public === true` via one shared helper; no `user_id` selected in either query; OG for non-public decks renders a neutral card.
- **Semantics change flagged:** `public` previously meant "visible to playgroup friends" (per the old tooltip). It now also means "anyone with the link" — tooltip updated to say so; existing public decks become link-accessible on deploy, which the user should be told at merge time.
- **Type consistency:** `PublicDeck`/`PublicDeckCard` (Task 1) consumed by Task 2; `calculateDeckStats(cards: DeckCard[])` fed via structural mapping with `deckId` added.
