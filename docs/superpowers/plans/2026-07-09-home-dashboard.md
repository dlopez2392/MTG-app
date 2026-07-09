# Home Dashboard (Phase 2d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The home page greets the user and surfaces their live data — recent decks, collection value with 7-day movement, current win streak, and a next-set countdown — while keeping the existing hero/search/Ask Harry/features/news layout as the no-data fallback.

**Architecture:** One new client component, `DashboardStrip`, mounted in `src/app/page.tsx` between the Ask Harry shortcut and the Features grid. It composes small cards that each read an existing auth-aware hook (`useDecks`, `useValueHistory`, `useGameLog`) or the Scryfall sets proxy, and each card renders `null` when its data is absent — so guests and brand-new users see exactly today's page, and the strip grows as data appears. The win-streak logic moves from `GameAnalyticsClient` into a shared util so both consumers use one implementation.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, Clerk `useUser` (greeting name), existing hooks/utilities.

## Global Constraints

- **No new dependencies.**
- **Auth-aware by construction:** all data comes from the existing hooks, which already branch guest/signed-in. The dashboard must render nothing personal for a user with no data — the existing hero/search/Ask Harry/features/news sections remain untouched as the baseline experience (this IS the spec's "what this app does" guest layout).
- **No layout shift jank:** every card renders `null` until its data has loaded AND is non-empty (no skeletons in the strip — absence, then appearance; the strip container collapses to nothing when all cards are null).
- Clerk gate: greeting uses `useUser()`; anything conditioned on sign-in state checks `isLoaded` first (established repo lesson).
- Phone-first; the strip uses the same `max-w-2xl mx-auto px-4` container pattern as the page's existing sections.
- No test framework (do not add one). Pure logic (`computeStreak` extraction, 7-day delta) verified via `npx tsx` temp-file scripts; UI via tsc/eslint/build + guest-mode browser check (controller). Signed-in visuals = user on-device.
- Work on branch `feat/home-dashboard`; do NOT push; commit per task with the given message + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Do not start this branch until `feat/deck-sharing` (Phase 2c) has merged to main** — branch from the post-2c main.

---

### Task 1: Extract `computeStreak` into a shared util

**Files:**
- Create: `src/lib/utils/gameStats.ts`
- Modify: `src/components/games/GameAnalyticsClient.tsx` (delete its private `computeStreak` at ~lines 147-170; import from the new util instead)

**Interfaces:**
- Produces: `computeStreak(entries: GameEntry[]): { current: number; type: "win" | "loss" | "none"; best: number }` — exact same signature/behavior as the current private function. `GameEntry` imports from the same module GameAnalyticsClient already uses (check its imports; likely `@/types/games` or `@/hooks/useGameLog` — mirror whatever the existing file does).

- [ ] **Step 1: Move the function**

Open `src/components/games/GameAnalyticsClient.tsx`, locate the private `function computeStreak(entries: GameEntry[]): { current: number; type: "win" | "loss" | "none"; best: number }` (~line 147, ends before the component definition). Create `src/lib/utils/gameStats.ts` containing exactly:

```typescript
import type { GameEntry } from "<same module GameAnalyticsClient imports GameEntry from — copy its import path verbatim>";

export function computeStreak(entries: GameEntry[]): { current: number; type: "win" | "loss" | "none"; best: number } {
  // <the function body moved VERBATIM from GameAnalyticsClient.tsx — do not edit any logic>
}
```

Then in `GameAnalyticsClient.tsx`: delete the private function and add `import { computeStreak } from "@/lib/utils/gameStats";` with the other imports. No other change to that file.

- [ ] **Step 2: Verify behavior is preserved with a temp-file check**

Create `src/lib/utils/__tmpcheck.mts`:

```typescript
import { computeStreak } from "./gameStats";
type E = Parameters<typeof computeStreak>[0][number];
const g = (date: string, result: string) => ({ date, result } as E);
const fail = (m: string, v: unknown) => { console.error("FAIL:", m, v); process.exit(1); };

const empty = computeStreak([]);
if (empty.current !== 0 || empty.type !== "none" || empty.best !== 0) fail("empty", empty);

const winStreak = computeStreak([g("2026-07-09", "win"), g("2026-07-08", "win"), g("2026-07-07", "loss")]);
if (winStreak.current !== 2 || winStreak.type !== "win") fail("2-win streak", winStreak);

const lossNow = computeStreak([g("2026-07-09", "loss"), g("2026-07-08", "win")]);
if (lossNow.current !== 1 || lossNow.type !== "loss") fail("1-loss streak", lossNow);

const drawTop = computeStreak([g("2026-07-09", "draw"), g("2026-07-08", "win")]);
if (drawTop.type !== "none") fail("draw breaks streak", drawTop);

console.log("PASS: computeStreak checks");
```

Run `npx tsx src/lib/utils/__tmpcheck.mts` → `PASS: computeStreak checks`. If any assertion fails, the MOVE was not verbatim (or the sort direction differs) — fix the move, not the test, unless reading the original shows the original itself behaves differently (then match the original and adjust the failing assertion to the original's actual behavior, noting it in your report). DELETE the temp file after.

- [ ] **Step 3: tsc + eslint**

`npx tsc --noEmit` → PASS. `npx eslint src/lib/utils/gameStats.ts src/components/games/GameAnalyticsClient.tsx` → no NEW errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/gameStats.ts src/components/games/GameAnalyticsClient.tsx
git commit -m "refactor: extract computeStreak into shared gameStats util"
```

---

### Task 2: DashboardStrip component

**Files:**
- Create: `src/components/home/DashboardStrip.tsx`

**Interfaces:**
- Consumes: `useDecks()` (`allDecks: Deck[]` with `updatedAt`, `coverImageUri`, `name`, `format`, `id`), `useValueHistory()` (`history: ValueSnapshot[]` sorted ascending by date, `{ date: "YYYY-MM-DD", value, cards }`), `useGameLog()` (`entries: GameEntry[]`), `computeStreak` (Task 1), Clerk `useUser` (greeting name), `GET /api/scryfall/sets` (Scryfall list — mirror `src/components/search/SetsTab.tsx`'s fetch + `ScryfallSet` type from `@/types/card` with `released_at?`, `name`, `code`, `set_type`).
- Produces: `export default function DashboardStrip()` — no props; renders `null` when nothing to show.

- [ ] **Step 1: Create `src/components/home/DashboardStrip.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useDecks } from "@/hooks/useDecks";
import { useValueHistory } from "@/hooks/useValueHistory";
import { useGameLog } from "@/hooks/useGameLog";
import { computeStreak } from "@/lib/utils/gameStats";
import type { ScryfallSet } from "@/types/card";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late brewing";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Latest snapshot value + delta vs the closest snapshot ≥7 days older, if any. */
function valueMovement(history: { date: string; value: number }[]): { value: number; delta: number | null } | null {
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const past = [...history].reverse().find((s) => s.date <= cutoff);
  return { value: latest.value, delta: past ? latest.value - past.value : null };
}

export default function DashboardStrip() {
  const { user, isLoaded } = useUser();
  const { allDecks, loading: decksLoading } = useDecks();
  const { history } = useValueHistory();
  const { entries, loading: gamesLoading } = useGameLog();
  const [nextSet, setNextSet] = useState<ScryfallSet | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scryfall/sets")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const today = new Date().toISOString().slice(0, 10);
        const sets: ScryfallSet[] = data.data ?? [];
        const upcoming = sets
          .filter((s) => (s.set_type === "expansion" || s.set_type === "core") && (s.released_at ?? "") > today)
          .sort((a, b) => (a.released_at ?? "").localeCompare(b.released_at ?? ""));
        setNextSet(upcoming[0] ?? null);
      })
      .catch(() => { /* card simply doesn't render */ });
    return () => { cancelled = true; };
  }, []);

  const recentDecks = decksLoading ? [] : [...(allDecks ?? [])]
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 3);
  const movement = valueMovement(history);
  const streak = gamesLoading ? null : computeStreak(entries);
  const showStreak = streak !== null && streak.type === "win" && streak.current >= 2;
  const daysToSet = nextSet?.released_at
    ? Math.max(1, Math.ceil((new Date(nextSet.released_at).getTime() - Date.now()) / 86400000))
    : null;

  const hasAnything = recentDecks.length > 0 || movement !== null || showStreak || nextSet !== null;
  if (!hasAnything) return null;

  return (
    <div className="px-4 pb-2 max-w-2xl mx-auto w-full">
      {/* Greeting */}
      <p className="text-section-label text-text-muted mb-2">
        {greeting()}
        {isLoaded && user?.firstName ? `, ${user.firstName}` : ""}
      </p>

      {/* Stat chips row */}
      {(movement || showStreak || nextSet) && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
          {movement && (
            <Link
              href="/collection"
              className="glass-card border border-border rounded-xl px-3 py-2 shrink-0 hover:border-accent/40 transition-colors"
            >
              <p className="text-caption">Collection</p>
              <p className="text-sm font-bold text-text-primary tabular-nums">
                ${movement.value.toFixed(2)}
                {movement.delta !== null && movement.delta !== 0 && (
                  <span className={`ml-1.5 text-xs font-semibold ${movement.delta > 0 ? "text-legal" : "text-banned"}`}>
                    {movement.delta > 0 ? "▲" : "▼"} ${Math.abs(movement.delta).toFixed(2)}
                  </span>
                )}
              </p>
            </Link>
          )}
          {showStreak && streak && (
            <Link
              href="/games/analytics"
              className="glass-card border border-legal/30 rounded-xl px-3 py-2 shrink-0 hover:border-legal/60 transition-colors"
            >
              <p className="text-caption">Win streak</p>
              <p className="text-sm font-bold text-legal tabular-nums">🔥 {streak.current} in a row</p>
            </Link>
          )}
          {nextSet && daysToSet !== null && (
            <Link
              href="/search"
              className="glass-card border border-border rounded-xl px-3 py-2 shrink-0 hover:border-accent/40 transition-colors"
            >
              <p className="text-caption">{nextSet.name}</p>
              <p className="text-sm font-bold text-accent tabular-nums">
                {daysToSet} day{daysToSet !== 1 ? "s" : ""} away
              </p>
            </Link>
          )}
        </div>
      )}

      {/* Recent decks */}
      {recentDecks.length > 0 && (
        <div className="grid grid-cols-3 gap-2 stagger-children">
          {recentDecks.map((deck) => (
            <Link
              key={deck.id}
              href={`/decks/${deck.id}`}
              className="relative glass-card border border-border rounded-xl overflow-hidden aspect-[3/2] hover:border-accent/40 transition-colors active:scale-[0.97]"
            >
              {deck.coverImageUri && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={deck.coverImageUri}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-40"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/90 via-bg-primary/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-xs font-semibold text-text-primary truncate">{deck.name}</p>
                {deck.format && <p className="text-[10px] text-text-secondary capitalize">{deck.format}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

Implementer notes: verify `ScryfallSet` in `@/types/card` actually has `set_type` — if the field is missing from the type but present in the API payload (SetsTab may reveal this), extend the FILTER to tolerate `undefined` rather than editing the shared type unless it's a one-line optional addition (`set_type?: string;` is acceptable to add if absent). Verify `useDecks` exposes `loading` (it does — `{ allDecks, loading }`).

- [ ] **Step 2: tsc + eslint**

`npx tsc --noEmit` → PASS. `npx eslint src/components/home/DashboardStrip.tsx` → clean (the sets fetch runs in `useEffect` with only remote-data `setNextSet` — the repo's `set-state-in-effect` rule targets synchronous setState, async callbacks are fine; if the rule still complains, report DONE_WITH_CONCERNS rather than suppressing).

- [ ] **Step 3: Commit**

```bash
git add src/components/home/DashboardStrip.tsx
git commit -m "feat: DashboardStrip with greeting, stats chips, recent decks"
```

---

### Task 3: Mount on home page + final verification

**Files:**
- Modify: `src/app/page.tsx` (import + mount between the Ask Harry shortcut block and the Features grid)

**Interfaces:**
- Consumes: `DashboardStrip` from Task 2.

- [ ] **Step 1: Mount**

In `src/app/page.tsx`, add the import:

```tsx
import DashboardStrip from "@/components/home/DashboardStrip";
```

Insert `<DashboardStrip />` directly after the Ask Harry shortcut block's closing `</div>` (the block added in Phase 1, ends before the `{/* ── Feature Grid ── */}` comment):

```tsx
      <DashboardStrip />

      {/* ── Feature Grid ── */}
```

- [ ] **Step 2: Verify**

`npx tsc --noEmit` → PASS. `npx eslint src/app/page.tsx` → clean. `npm run build` → succeeds.

Browser (controller): as a guest with NO data — home page is pixel-identical to before (strip renders null... except the next-set chip, which shows for everyone once the sets fetch resolves; that is intended — it's not personal data). Seed a guest deck in localStorage → recent-decks row appears with it. No hydration warnings in console.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: mount dashboard strip on home page"
```

---

## Self-Review Notes

- **Spec 2d coverage:** greeting ✓ (time-of-day + Clerk first name); collection value + 7-day movement ✓ (`valueMovement` on ValueSnapshot history — movement shows only when a ≥7-day-old snapshot exists, honest about data availability); recent decks tap-to-resume ✓; win streak ✓ (shared `computeStreak`, shown only for ≥2 wins — a 1-loss "streak" is not dashboard material); latest-set countdown ✓ (Scryfall sets, expansion/core only); news headline ✓ (NewsWidget already on the page, untouched); guest "what the app does" layout ✓ (strip self-collapses; existing sections untouched).
- **Sequencing:** branch AFTER 2c merges (recorded in Global Constraints).
- **Type consistency:** `computeStreak` signature identical between Task 1 util and Task 2 consumer; `ValueSnapshot`/`ScryfallSet`/`Deck` all pre-existing types.
- **YAGNI:** no snapshot-recording changes (dashboard reads history passively; value only appears once the user has visited collection pages that record snapshots — acceptable and honest), no new API routes, no dashboard settings.
