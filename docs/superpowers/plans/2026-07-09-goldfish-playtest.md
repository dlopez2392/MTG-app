# Goldfish Playtest Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing HandSimulator (opening-hand + London mulligan) into a full solo "goldfish" playtest: battlefield/graveyard/exile zones, tap-to-play, tap/untap, and a turn counter with auto-draw.

**Architecture:** A pure, framework-free state machine (`goldfishReducer`) in `src/lib/utils/goldfish.ts` owns all game state (zones, turn, tapped flags) and is verified with a temp `tsx` script. `HandSimulator.tsx` gains a third phase `"playtest"` entered when the user taps **Keep**; it holds the board via `useReducer` and renders a new `PlaytestBoard.tsx` component (battlefield grid, hand row, zone piles, action sheets). No new dependencies, no server/API changes — everything is client-side and ephemeral.

**Tech Stack:** Next.js 16 App Router, React 19 (`useReducer`), TypeScript strict, Tailwind CSS v4 design tokens.

## Global Constraints

- **No new dependencies.** (Spec cost constraint: current stack only.)
- **Phone-first.** Design for narrow portrait; must not look broken at `lg:` (the overlay is full-screen `fixed inset-0`, so it inherits nothing from the sidebar shell).
- **Keep visual identity:** dark navy, existing tokens (`bg-bg-primary`, `bg-bg-card`, `border-border`, `text-text-*`, `btn-gradient`, `text-accent`, `bg-mtg-green`). No new colors.
- **ESLint purity rules are strict** (`react-hooks/set-state-in-effect` etc.). Do NOT add new `setState`/`dispatch` calls inside new `useEffect`s — put state transitions in event handlers. (The one pre-existing deal-on-open effect in HandSimulator stays as-is; reset the board inside the existing `deal7` callback, not in a new effect.)
- **Pure-logic verification uses temp `tsx` script files** run with `npx tsx <file>` — `tsx --eval` swallows stdout on this machine. Delete temp scripts before committing.
- **Verification per task:** `npx tsc --noEmit` and `npm run lint` must be green. Final task adds `npm run build` + browser verification.
- **Dev server:** `npm run dev` — port varies (3000/3001); READ the startup output. A stale service worker may serve cached shells on localhost — unregister via DevTools → Application → Service Workers if pages look stale.
- **`prefers-reduced-motion`:** `globals.css:418` already zeroes ALL animation/transition durations globally — using plain Tailwind `transition-*` classes is automatically guarded. Do not add per-element guards.
- **Branch:** all work on `feat/goldfish-playtest` off `main`. Do not merge without danlo's explicit go-ahead.

---

## Design decisions (locked)

- **Entry:** Tapping **Keep** (after any London bottoming) no longer closes the overlay — it starts a playtest at turn 1 with the kept hand. The X button still closes at any time. The header "new game" icon restarts back to the opening-hand phase.
- **Tap semantics (spec: "tap-to-play"):** tapping a hand card plays it to the battlefield untapped; tapping a battlefield card toggles tapped (rotates 90° via CSS transform). Every card gets a small `⋯` overflow button opening a bottom action sheet for other zone moves.
- **Turn counter with auto-draw:** **Next Turn** button = turn+1, untap all battlefield cards, draw 1. Turn 1 does not auto-draw (you keep 7 and play). Drawing from an empty library is a silent no-op (goldfish — no loss tracking).
- **Zones:** library (`[0]` = top), hand, battlefield (cards carry `tapped`), graveyard, exile. "Top of Library" is the only library-return action (no shuffle-in — YAGNI). Graveyard/exile render as count chips; tapping a chip opens a list sheet; tapping a listed card opens the same action sheet.
- **Engine actions:** `START`, `MOVE` (generic zone→zone; covers play/discard/exile/reanimate), `TOGGLE_TAP`, `DRAW`, `NEXT_TURN`, `RESET`. No separate `PLAY` action — play is `MOVE hand→battlefield`.
- **No commander zone, no tokens, no counters, no opponent** — explicitly out of scope for 3b.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/utils/goldfish.ts` (create) | Pure types + reducer + shared sim helpers (`SimCard`, `buildLibrary`, `shuffle`, `isLand` move here from HandSimulator) |
| `src/components/decks/HandSimulator.tsx` (modify) | Adds `"playtest"` phase, owns board via `useReducer`, header shows turn counter; delegates board UI |
| `src/components/decks/PlaytestBoard.tsx` (create) | Battlefield grid, hand row, zone chips, card action sheet, zone viewer sheet, Draw/Next Turn bar |
| `public/sw.js` (modify, final task) | Bump `CACHE_NAME` so returning PWA users get the new bundle |

---

### Task 1: Goldfish engine (`src/lib/utils/goldfish.ts`)

**Files:**
- Create: `src/lib/utils/goldfish.ts`
- Temp (delete before commit): `temp-goldfish-test.ts` (repo root)

**Interfaces:**
- Consumes: `DeckCard` from `@/types/deck` (fields used: `deckId`, `scryfallId`, `name`, `quantity`, `category`, `typeLine?`, `cmc?`, `imageUri?`).
- Produces (later tasks import ALL of these from `@/lib/utils/goldfish`):
  - `interface SimCard extends DeckCard { uid: string }`
  - `interface BoardCard extends SimCard { tapped: boolean }`
  - `type Zone = "library" | "hand" | "battlefield" | "graveyard" | "exile"`
  - `interface GoldfishState { turn: number; library: SimCard[]; hand: SimCard[]; battlefield: BoardCard[]; graveyard: SimCard[]; exile: SimCard[] }`
  - `type GoldfishAction = { type: "START"; hand: SimCard[]; library: SimCard[] } | { type: "TOGGLE_TAP"; uid: string } | { type: "MOVE"; uid: string; from: Zone; to: Zone } | { type: "DRAW" } | { type: "NEXT_TURN" } | { type: "RESET" }`
  - `function goldfishReducer(state: GoldfishState | null, action: GoldfishAction): GoldfishState | null`
  - `function buildLibrary(cards: DeckCard[]): SimCard[]`
  - `function shuffle<T>(arr: T[]): T[]`
  - `function isLand(card: Pick<DeckCard, "typeLine">): boolean`

- [ ] **Step 1: Write the failing verification script**

Create `temp-goldfish-test.ts` at the repo root:

```ts
// temp-goldfish-test.ts — temp verification for the goldfish engine. DELETE BEFORE COMMIT.
import {
  goldfishReducer,
  isLand,
  type GoldfishAction,
  type GoldfishState,
  type SimCard,
} from "./src/lib/utils/goldfish";

function card(name: string, i: number, typeLine = "Creature — Test"): SimCard {
  return {
    deckId: "d1",
    scryfallId: name,
    name,
    quantity: 1,
    category: "main",
    typeLine,
    cmc: 2,
    uid: `${name}-${i}`,
  };
}

let failures = 0;
function check(label: string, cond: boolean) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"} — ${label}`);
}

function apply(state: GoldfishState | null, ...actions: GoldfishAction[]) {
  return actions.reduce(goldfishReducer, state);
}

// START
const hand = [card("Bolt", 0), card("Bear", 0), card("Island", 0, "Basic Land — Island")];
const library = [card("Top", 0), card("Second", 0), card("Third", 0)];
const s0 = goldfishReducer(null, { type: "START", hand, library });
check("START: turn 1", s0?.turn === 1);
check("START: hand 3", s0?.hand.length === 3);
check("START: library 3", s0?.library.length === 3);
check("START: empty battlefield/graveyard/exile",
  s0?.battlefield.length === 0 && s0?.graveyard.length === 0 && s0?.exile.length === 0);

// MOVE hand → battlefield (tap-to-play) enters untapped
const s1 = apply(s0, { type: "MOVE", uid: "Bear-0", from: "hand", to: "battlefield" });
check("PLAY: battlefield 1, hand 2", s1?.battlefield.length === 1 && s1?.hand.length === 2);
check("PLAY: enters untapped", s1?.battlefield[0]?.tapped === false);

// TOGGLE_TAP
const s2 = apply(s1, { type: "TOGGLE_TAP", uid: "Bear-0" });
check("TAP: tapped true", s2?.battlefield[0]?.tapped === true);
const s2b = apply(s2, { type: "TOGGLE_TAP", uid: "Bear-0" });
check("UNTAP: tapped false", s2b?.battlefield[0]?.tapped === false);

// NEXT_TURN: turn+1, untap all, draw 1
const s3 = apply(s2, { type: "NEXT_TURN" });
check("NEXT_TURN: turn 2", s3?.turn === 2);
check("NEXT_TURN: untapped all", s3?.battlefield.every((c) => !c.tapped) === true);
check("NEXT_TURN: drew top card", s3?.hand.some((c) => c.uid === "Top-0") === true);
check("NEXT_TURN: library shrank", s3?.library.length === 2);

// DRAW
const s4 = apply(s3, { type: "DRAW" });
check("DRAW: hand grew", s4!.hand.length === s3!.hand.length + 1);

// DRAW on empty library is a no-op
const empty = goldfishReducer(null, { type: "START", hand: [card("Solo", 0)], library: [] });
const emptyDraw = apply(empty, { type: "DRAW" });
check("DRAW empty library: no-op", emptyDraw === empty);
const emptyTurn = apply(empty, { type: "NEXT_TURN" });
check("NEXT_TURN empty library: turn still advances", emptyTurn?.turn === 2 && emptyTurn?.hand.length === 1);

// MOVE battlefield → graveyard strips tapped
const s5 = apply(s2, { type: "MOVE", uid: "Bear-0", from: "battlefield", to: "graveyard" });
check("DIES: graveyard 1, battlefield 0", s5?.graveyard.length === 1 && s5?.battlefield.length === 0);
check("DIES: tapped flag stripped", !("tapped" in (s5?.graveyard[0] ?? {})));

// MOVE graveyard → battlefield re-enters untapped
const s6 = apply(s5, { type: "MOVE", uid: "Bear-0", from: "graveyard", to: "battlefield" });
check("REANIMATE: enters untapped", s6?.battlefield[0]?.tapped === false);

// MOVE hand → library goes on TOP
const s7 = apply(s0, { type: "MOVE", uid: "Bolt-0", from: "hand", to: "library" });
check("TO LIBRARY: on top", s7?.library[0]?.uid === "Bolt-0");
const s8 = apply(s7, { type: "DRAW" });
check("TO LIBRARY: draw gets it back", s8?.hand.some((c) => c.uid === "Bolt-0") === true);

// MOVE with wrong uid / wrong zone is a no-op
check("MOVE bad uid: no-op", apply(s0, { type: "MOVE", uid: "Nope-0", from: "hand", to: "exile" }) === s0);
check("MOVE same zone: no-op", apply(s0, { type: "MOVE", uid: "Bolt-0", from: "hand", to: "hand" }) === s0);

// RESET
check("RESET: null", apply(s0, { type: "RESET" }) === null);
// Actions on null state stay null (except START)
check("null state: non-START is null", goldfishReducer(null, { type: "DRAW" }) === null);

// isLand
check("isLand: land true", isLand({ typeLine: "Basic Land — Island" }) === true);
check("isLand: creature false", isLand({ typeLine: "Creature — Bear" }) === false);
check("isLand: undefined false", isLand({}) === false);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx temp-goldfish-test.ts`
Expected: FAIL — `Cannot find module './src/lib/utils/goldfish'`

- [ ] **Step 3: Implement the engine**

Create `src/lib/utils/goldfish.ts`:

```ts
import type { DeckCard } from "@/types/deck";

// ── Shared sim types & helpers ───────────────────────────────────────────────
// (Used by both the opening-hand phase and goldfish playtest in HandSimulator.)

export interface SimCard extends DeckCard {
  uid: string; // unique instance id (same card can appear multiple times)
}

export function buildLibrary(cards: DeckCard[]): SimCard[] {
  const lib: SimCard[] = [];
  for (const c of cards) {
    if (c.category !== "main") continue;
    for (let i = 0; i < c.quantity; i++) {
      lib.push({ ...c, uid: `${c.scryfallId}-${i}` });
    }
  }
  return lib;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isLand(card: Pick<DeckCard, "typeLine">): boolean {
  return (card.typeLine ?? "").toLowerCase().includes("land");
}

// ── Goldfish playtest state machine ──────────────────────────────────────────

export type Zone = "library" | "hand" | "battlefield" | "graveyard" | "exile";

export interface BoardCard extends SimCard {
  tapped: boolean;
}

export interface GoldfishState {
  turn: number;
  library: SimCard[]; // [0] = top of library
  hand: SimCard[];
  battlefield: BoardCard[];
  graveyard: SimCard[];
  exile: SimCard[];
}

export type GoldfishAction =
  | { type: "START"; hand: SimCard[]; library: SimCard[] }
  | { type: "TOGGLE_TAP"; uid: string } // battlefield only
  | { type: "MOVE"; uid: string; from: Zone; to: Zone }
  | { type: "DRAW" }
  | { type: "NEXT_TURN" } // turn+1, untap all, draw 1
  | { type: "RESET" };

function drawOne(state: GoldfishState): GoldfishState {
  if (state.library.length === 0) return state;
  return {
    ...state,
    hand: [...state.hand, state.library[0]],
    library: state.library.slice(1),
  };
}

function withoutZoneCard(state: GoldfishState, zone: Zone, uid: string): GoldfishState {
  switch (zone) {
    case "library":
      return { ...state, library: state.library.filter((c) => c.uid !== uid) };
    case "hand":
      return { ...state, hand: state.hand.filter((c) => c.uid !== uid) };
    case "battlefield":
      return { ...state, battlefield: state.battlefield.filter((c) => c.uid !== uid) };
    case "graveyard":
      return { ...state, graveyard: state.graveyard.filter((c) => c.uid !== uid) };
    case "exile":
      return { ...state, exile: state.exile.filter((c) => c.uid !== uid) };
  }
}

export function goldfishReducer(
  state: GoldfishState | null,
  action: GoldfishAction
): GoldfishState | null {
  if (action.type === "START") {
    return {
      turn: 1,
      hand: action.hand,
      library: action.library,
      battlefield: [],
      graveyard: [],
      exile: [],
    };
  }
  if (action.type === "RESET") return null;
  if (!state) return null;

  switch (action.type) {
    case "TOGGLE_TAP":
      return {
        ...state,
        battlefield: state.battlefield.map((c) =>
          c.uid === action.uid ? { ...c, tapped: !c.tapped } : c
        ),
      };
    case "DRAW":
      return drawOne(state);
    case "NEXT_TURN":
      return drawOne({
        ...state,
        turn: state.turn + 1,
        battlefield: state.battlefield.map((c) => (c.tapped ? { ...c, tapped: false } : c)),
      });
    case "MOVE": {
      if (action.from === action.to) return state;
      const found = state[action.from].find((c) => c.uid === action.uid);
      if (!found) return state;
      // Strip battlefield-only state when the card leaves the battlefield.
      const { tapped: _tapped, ...plain } = found as BoardCard;
      void _tapped;
      const next = withoutZoneCard(state, action.from, action.uid);
      switch (action.to) {
        case "battlefield":
          return { ...next, battlefield: [...next.battlefield, { ...plain, tapped: false }] };
        case "library":
          return { ...next, library: [plain, ...next.library] }; // top of library
        case "hand":
          return { ...next, hand: [...next.hand, plain] };
        case "graveyard":
          return { ...next, graveyard: [...next.graveyard, plain] };
        case "exile":
          return { ...next, exile: [...next.exile, plain] };
      }
    }
  }
}
```

Note: if `npx tsc --noEmit` complains that `goldfishReducer` lacks an ending return path (TS can't always prove switch exhaustiveness through the nested switch), add `return state;` as the last line of the `"MOVE"` case's inner switch fallthrough — i.e. after the inner `switch`, not a `default` clause. Keep the function warning-free without disabling any rules.

- [ ] **Step 4: Run the verification script — all checks pass**

Run: `npx tsx temp-goldfish-test.ts`
Expected: every line `PASS`, final line `ALL CHECKS PASSED`, exit code 0.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run lint` → no new errors/warnings.

- [ ] **Step 6: Delete the temp script and commit**

```bash
rm temp-goldfish-test.ts
git add src/lib/utils/goldfish.ts
git commit -m "feat(playtest): pure goldfish state machine (zones, tap, turn/auto-draw)"
```

---

### Task 2: Playtest phase in HandSimulator + PlaytestBoard core loop

**Files:**
- Modify: `src/components/decks/HandSimulator.tsx` (entire file replaced — full content below)
- Create: `src/components/decks/PlaytestBoard.tsx`

**Interfaces:**
- Consumes from Task 1 (`@/lib/utils/goldfish`): `SimCard`, `BoardCard`, `GoldfishState`, `GoldfishAction`, `goldfishReducer`, `buildLibrary`, `shuffle`, `isLand`.
- Produces: `PlaytestBoard` default export with props `{ board: GoldfishState; dispatch: (action: GoldfishAction) => void }`. Task 3 rewrites `PlaytestBoard.tsx` with the same props — HandSimulator will not change again.
- HandSimulator public props are UNCHANGED: `{ open: boolean; onClose: () => void; cards: DeckCard[] }` — no change needed in `DeckEditor.tsx`.

**Behavior changes:**
- `phase` union gains `"playtest"`.
- **Keep** with 0 mulligans → `START` playtest (was: close). **Confirm** after bottoming → `START` playtest with kept hand and bottomed cards at the BOTTOM of the library (was: close).
- Header in playtest: title `Playtest · Turn {n}`, subline `{library} in library`; the existing refresh icon restarts to a fresh opening hand (deal7 already resets, now also `RESET`s the board).
- Local `SimCard`/`buildLibrary`/`shuffle`/`isLand` definitions are deleted in favor of the Task 1 imports.

- [ ] **Step 1: Replace `src/components/decks/HandSimulator.tsx` with:**

```tsx
"use client";

import { useState, useCallback, useEffect, useReducer } from "react";
import { cn } from "@/lib/utils/cn";
import type { DeckCard } from "@/types/deck";
import {
  buildLibrary,
  shuffle,
  isLand,
  goldfishReducer,
  type SimCard,
} from "@/lib/utils/goldfish";
import PlaytestBoard from "./PlaytestBoard";

interface Props {
  open: boolean;
  onClose: () => void;
  cards: DeckCard[]; // all deck cards (we only use "main")
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function handStats(hand: SimCard[]) {
  const lands = hand.filter(isLand).length;
  const nonLands = hand.filter((c) => !isLand(c));
  const avgCmc =
    nonLands.length > 0
      ? nonLands.reduce((s, c) => s + (c.cmc ?? 0), 0) / nonLands.length
      : 0;
  return { lands, avgCmc };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HandSimulator({ open, onClose, cards }: Props) {
  const [library, setLibrary]           = useState<SimCard[]>([]);
  const [hand, setHand]                 = useState<SimCard[]>([]);
  const [mulligans, setMulligans]       = useState(0);
  // Cards selected to put on the bottom (London mulligan — chosen at keep time)
  const [putBack, setPutBack]           = useState<Set<string>>(new Set());
  const [phase, setPhase]               = useState<"hand" | "bottoming" | "playtest">("hand");
  const [flipped, setFlipped]           = useState<Set<string>>(new Set());
  const [board, dispatchBoard]          = useReducer(goldfishReducer, null);

  const deal7 = useCallback((lib: SimCard[]) => {
    const shuffled = shuffle(lib);
    setHand(shuffled.slice(0, 7));
    setLibrary(shuffled.slice(7));
    setPutBack(new Set());
    setFlipped(new Set());
    setPhase("hand");
    dispatchBoard({ type: "RESET" });
  }, []);

  // Draw fresh hand on open
  useEffect(() => {
    if (open) {
      setMulligans(0);
      deal7(buildLibrary(cards));
    }
  }, [open, cards, deal7]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const mainCount = cards.filter((c) => c.category === "main").reduce((s, c) => s + c.quantity, 0);
  const stats = handStats(hand);
  // London: when keeping after N mulligans, put N cards on the bottom of the library.
  const bottomTarget = mulligans;

  // ── Actions ──────────────────────────────────────────────────────────────

  function handleNewHand() {
    // "New game" — reset everything (incl. playtest board) and deal a fresh 7
    setMulligans(0);
    deal7(buildLibrary(cards));
  }

  function handleMulligan() {
    // London mulligan: shuffle the entire hand back into the library,
    // then draw a fresh 7. Increment the mulligan counter.
    const full = shuffle([...library, ...hand]);
    setHand(full.slice(0, 7));
    setLibrary(full.slice(7));
    setMulligans((m) => m + 1);
    setPutBack(new Set());
    setFlipped(new Set());
    setPhase("hand");
  }

  function handleKeep() {
    // London: if we've taken mulligans, choose `mulligans` cards to bottom first.
    if (mulligans === 0) {
      dispatchBoard({ type: "START", hand, library });
      setPhase("playtest");
      return;
    }
    setPhase("bottoming");
    setPutBack(new Set());
  }

  function togglePutBack(uid: string) {
    if (phase !== "bottoming") return;
    setPutBack((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else if (next.size < bottomTarget) {
        next.add(uid);
      }
      return next;
    });
  }

  function confirmBottom() {
    // Bottom the selected cards, then start the playtest with the kept hand.
    // The board owns library/hand state from here until restart.
    const bottomed = hand.filter((c) => putBack.has(c.uid));
    const kept = hand.filter((c) => !putBack.has(c.uid));
    dispatchBoard({ type: "START", hand: kept, library: [...library, ...bottomed] });
    setPutBack(new Set());
    setFlipped(new Set());
    setPhase("playtest");
  }

  function handleDraw() {
    if (library.length === 0) return;
    setHand((h) => [...h, library[0]]);
    setLibrary((l) => l.slice(1));
  }

  function toggleFlip(uid: string) {
    setFlipped((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const inPlaytest = phase === "playtest" && board !== null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 z-[100]" onClick={phase === "hand" ? onClose : undefined} />

      {/* Panel */}
      <div className={cn(
        "fixed inset-0 z-[101] flex flex-col items-center justify-start bg-bg-primary",
        inPlaytest ? "overflow-hidden" : "overflow-y-auto"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 w-full">
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="text-center">
            <h2 className="text-sm font-bold text-text-primary">
              {inPlaytest ? `Playtest · Turn ${board.turn}` : "Opening Hand"}
            </h2>
            <p className="text-xs text-text-muted">
              {inPlaytest
                ? `${board.library.length} in library`
                : `${mainCount} cards · ${library.length} in library`}
            </p>
          </div>
          <button
            onClick={handleNewHand}
            className="p-1 text-text-muted hover:text-accent transition-colors"
            title="New game"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        {inPlaytest ? (
          <PlaytestBoard board={board} dispatch={dispatchBoard} />
        ) : (
          <>
            {/* Bottoming instruction (London) */}
            {phase === "bottoming" && (
              <div className="px-4 py-2 bg-accent/10 border-b border-accent/20 text-center shrink-0 w-full">
                <p className="text-xs font-semibold text-accent">
                  London mulligan — select {bottomTarget - putBack.size} more card{bottomTarget - putBack.size !== 1 ? "s" : ""} to put on the bottom
                  {putBack.size === bottomTarget && " — tap Confirm"}
                </p>
              </div>
            )}

            {/* Mulligans taken badge */}
            {mulligans > 0 && phase === "hand" && (
              <div className="px-4 pt-2 shrink-0">
                <div className="flex justify-center">
                  <span className="px-2.5 py-0.5 rounded-full bg-bg-card border border-border text-xs text-text-muted">
                    {mulligans} mulligan{mulligans !== 1 ? "s" : ""} taken
                  </span>
                </div>
              </div>
            )}

            {/* Card hand */}
            <div className="px-3 py-3 w-full">
              {/* Cards grid — 4 cols so they fit nicely */}
              <div className="grid grid-cols-4 gap-2">
                {hand.map((card) => {
                  const selected = putBack.has(card.uid);
                  const isFlipped = flipped.has(card.uid);
                  const land = isLand(card);

                  return (
                    <button
                      key={card.uid}
                      onClick={() => phase === "bottoming" ? togglePutBack(card.uid) : toggleFlip(card.uid)}
                      className={cn(
                        "relative rounded-lg overflow-hidden border-2 transition-all active:scale-95",
                        selected
                          ? "border-accent opacity-50 scale-95"
                          : "border-transparent",
                        phase === "bottoming" && !selected && putBack.size >= bottomTarget
                          ? "opacity-40"
                          : ""
                      )}
                      style={{ aspectRatio: "488/680" }}
                    >
                      {card.imageUri ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.imageUri}
                          alt={card.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className={cn(
                          "w-full h-full flex flex-col items-center justify-center gap-1 p-1 text-center",
                          land ? "bg-mtg-green/20" : "bg-bg-card"
                        )}>
                          <p className="text-[9px] font-semibold text-text-primary leading-tight line-clamp-3">{card.name}</p>
                          {card.cmc !== undefined && !land && (
                            <span className="text-[8px] text-text-muted">{card.cmc} CMC</span>
                          )}
                        </div>
                      )}

                      {/* Land indicator */}
                      {land && (
                        <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-mtg-green/80 border border-white/30" />
                      )}

                      {/* Selected overlay */}
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      )}

                      {/* Flipped — show card name overlay */}
                      {isFlipped && phase === "hand" && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-1 text-center">
                          <p className="text-[9px] font-semibold text-white leading-tight">{card.name}</p>
                          {card.typeLine && (
                            <p className="text-[8px] text-text-muted mt-0.5 leading-tight line-clamp-2">{card.typeLine}</p>
                          )}
                          {card.cmc !== undefined && (
                            <p className="text-[8px] text-accent mt-0.5">{card.cmc} CMC</p>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stats bar */}
            <div className="px-4 py-2 border-t border-border shrink-0 w-full">
              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-mtg-green" />
                  <span className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{stats.lands}</span> land{stats.lands !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="text-xs text-text-secondary">
                  Avg CMC: <span className="font-semibold text-text-primary">{stats.avgCmc.toFixed(1)}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="text-xs text-text-secondary">
                  {hand.length} cards
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 flex gap-2 border-t border-border shrink-0 w-full">
              {phase === "hand" ? (
                <>
                  <button
                    onClick={handleDraw}
                    disabled={library.length === 0}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    Draw
                  </button>
                  <button
                    onClick={handleMulligan}
                    disabled={mainCount < 7 || mulligans >= 7}
                    className="flex-1 py-2.5 rounded-xl border border-accent/50 text-sm font-semibold text-accent hover:bg-accent/10 transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    Mulligan
                  </button>
                  <button
                    onClick={handleKeep}
                    className="flex-1 py-2.5 rounded-xl btn-gradient text-sm font-bold transition-all active:scale-[0.98]"
                  >
                    {mulligans > 0 ? `Keep (bottom ${mulligans})` : "Keep & Play"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setPutBack(new Set()); setPhase("hand"); }}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBottom}
                    disabled={putBack.size < bottomTarget}
                    className="flex-1 py-2.5 rounded-xl btn-gradient text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    Confirm ({putBack.size}/{bottomTarget})
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
```

Notes for the implementer:
- The diff vs. the old file: imports (goldfish module + PlaytestBoard), removed local `SimCard`/`buildLibrary`/`shuffle`/`isLand`, `phase` union gains `"playtest"`, new `board` reducer, `deal7` dispatches `RESET`, `handleKeep`/`confirmBottom` start the playtest instead of closing, header is phase-aware, the old body is wrapped in the `inPlaytest` ternary, panel becomes `overflow-hidden` in playtest (PlaytestBoard scrolls internally), several inner containers gained `w-full`, and the Keep label reads "Keep & Play".
- The deal-on-open `useEffect` is pre-existing; do NOT add any new effects.

- [ ] **Step 2: Create `src/components/decks/PlaytestBoard.tsx` (core version):**

```tsx
"use client";

import { cn } from "@/lib/utils/cn";
import {
  isLand,
  type BoardCard,
  type GoldfishAction,
  type GoldfishState,
  type SimCard,
} from "@/lib/utils/goldfish";

interface Props {
  board: GoldfishState;
  dispatch: (action: GoldfishAction) => void;
}

export default function PlaytestBoard({ board, dispatch }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      {/* Battlefield */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {board.battlefield.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-text-muted text-center px-8">
              Tap a card in your hand to play it
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {board.battlefield.map((card) => (
              <BattlefieldCard
                key={card.uid}
                card={card}
                onTap={() => dispatch({ type: "TOGGLE_TAP", uid: card.uid })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Zone strip */}
      <div className="px-4 py-1.5 border-t border-border flex items-center gap-2 shrink-0">
        <ZoneChip label="Graveyard" count={board.graveyard.length} />
        <ZoneChip label="Exile" count={board.exile.length} />
        <span className="ml-auto text-xs text-text-muted">{board.hand.length} in hand</span>
      </div>

      {/* Hand */}
      <div className="border-t border-border shrink-0">
        <div className="flex gap-2 px-3 py-2 overflow-x-auto">
          {board.hand.length === 0 ? (
            <p className="text-xs text-text-muted py-4 mx-auto">Hand is empty</p>
          ) : (
            board.hand.map((card) => (
              <HandCard
                key={card.uid}
                card={card}
                onPlay={() => dispatch({ type: "MOVE", uid: card.uid, from: "hand", to: "battlefield" })}
              />
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 flex gap-2 border-t border-border shrink-0">
        <button
          onClick={() => dispatch({ type: "DRAW" })}
          disabled={board.library.length === 0}
          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all active:scale-[0.98] disabled:opacity-40"
        >
          Draw
        </button>
        <button
          onClick={() => dispatch({ type: "NEXT_TURN" })}
          className="flex-[2] py-2.5 rounded-xl btn-gradient text-sm font-bold transition-all active:scale-[0.98]"
        >
          Next Turn
        </button>
      </div>
    </div>
  );
}

// ── Card faces ────────────────────────────────────────────────────────────────

function CardFace({ card }: { card: SimCard }) {
  const land = isLand(card);
  if (card.imageUri) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={card.imageUri} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
    );
  }
  return (
    <div className={cn(
      "w-full h-full flex flex-col items-center justify-center gap-1 p-1 text-center",
      land ? "bg-mtg-green/20" : "bg-bg-card"
    )}>
      <p className="text-[9px] font-semibold text-text-primary leading-tight line-clamp-3">{card.name}</p>
      {card.cmc !== undefined && !land && (
        <span className="text-[8px] text-text-muted">{card.cmc} CMC</span>
      )}
    </div>
  );
}

function BattlefieldCard({ card, onTap }: { card: BoardCard; onTap: () => void }) {
  return (
    <div
      className={cn("relative transition-transform", card.tapped && "rotate-90 scale-[0.72]")}
      style={{ aspectRatio: "488/680" }}
    >
      <button
        onClick={onTap}
        aria-pressed={card.tapped}
        aria-label={`${card.name}${card.tapped ? " (tapped)" : ""}`}
        className="absolute inset-0 rounded-lg overflow-hidden active:scale-95 transition-transform"
      >
        <CardFace card={card} />
      </button>
    </div>
  );
}

function HandCard({ card, onPlay }: { card: SimCard; onPlay: () => void }) {
  return (
    <div className="relative shrink-0 w-16" style={{ aspectRatio: "488/680" }}>
      <button
        onClick={onPlay}
        aria-label={`Play ${card.name}`}
        className="absolute inset-0 rounded-lg overflow-hidden active:scale-95 transition-transform"
      >
        <CardFace card={card} />
      </button>
    </div>
  );
}

function ZoneChip({ label, count }: { label: string; count: number }) {
  return (
    <span className="px-2.5 py-0.5 rounded-full bg-bg-card border border-border text-xs text-text-muted">
      {label}: <span className="font-semibold text-text-primary">{count}</span>
    </span>
  );
}
```

(The `div`-wrapping-`button` structure looks redundant now but is deliberate: Task 3 adds a sibling `⋯` overflow button inside the wrapper — nested `<button>` elements are invalid HTML and break hydration.)

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run lint` → no new errors/warnings.

- [ ] **Step 4: Browser-verify the core loop**

Run: `npm run dev` (read the startup output for the port; unregister a stale service worker via DevTools if pages look cached). At phone width (~390px) open any deck → hand simulator:

1. Tap **Keep & Play** → playtest starts, header shows `Playtest · Turn 1` and library count.
2. Tap a hand card → it appears on the battlefield; hand count drops.
3. Tap the battlefield card → rotates 90° (tapped); tap again → untaps.
4. Tap **Next Turn** → header shows Turn 2, all battlefield cards untap, hand grows by 1, library count drops by 1.
5. Tap **Draw** → hand grows by 1.
6. Mulligan once → Keep (bottom 1) → select a card → Confirm → playtest starts with 6 cards in hand.
7. Header refresh icon → back to a fresh opening hand (board gone).
8. X closes; reopening deals a fresh hand (no leftover board).

- [ ] **Step 5: Commit**

```bash
git add src/components/decks/HandSimulator.tsx src/components/decks/PlaytestBoard.tsx
git commit -m "feat(playtest): playtest phase — battlefield, tap-to-play, turn counter with auto-draw"
```

---

### Task 3: Card action sheet + graveyard/exile viewers

**Files:**
- Modify: `src/components/decks/PlaytestBoard.tsx` (entire file replaced — full content below)

**Interfaces:**
- Consumes: same goldfish module exports as Task 2. Props signature `{ board, dispatch }` UNCHANGED — no HandSimulator edits.
- Produces: final PlaytestBoard. All new UI is internal to this file.

**Behavior added:**
- Every battlefield and hand card gets a small `⋯` button (top-right) opening a bottom action sheet: card name/type/CMC header + move actions to every other zone ("Tap"/"Untap" included for battlefield cards). Actions dispatch `MOVE`/`TOGGLE_TAP` and close the sheet.
- Graveyard/exile chips become buttons; tapping opens a zone viewer sheet listing that zone's cards (thumbnail + name + type). Tapping a listed card switches to its action sheet.
- Sheets: backdrop `z-[109]`, sheet `z-[110]`, `animate-sheet-up` (existing keyframe in `globals.css`), `pb-[calc(env(safe-area-inset-bottom)+1rem)]`, backdrop tap closes.

- [ ] **Step 1: Replace `src/components/decks/PlaytestBoard.tsx` with:**

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  isLand,
  type BoardCard,
  type GoldfishAction,
  type GoldfishState,
  type SimCard,
  type Zone,
} from "@/lib/utils/goldfish";

interface Props {
  board: GoldfishState;
  dispatch: (action: GoldfishAction) => void;
}

interface Selected {
  card: SimCard;
  zone: Zone;
}

const MOVE_TARGETS: { to: Zone; label: string }[] = [
  { to: "battlefield", label: "To Battlefield" },
  { to: "hand",        label: "To Hand" },
  { to: "graveyard",   label: "To Graveyard" },
  { to: "exile",       label: "To Exile" },
  { to: "library",     label: "Top of Library" },
];

export default function PlaytestBoard({ board, dispatch }: Props) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [viewZone, setViewZone] = useState<"graveyard" | "exile" | null>(null);

  function moveSelected(to: Zone) {
    if (!selected) return;
    dispatch({ type: "MOVE", uid: selected.card.uid, from: selected.zone, to });
    setSelected(null);
    setViewZone(null);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      {/* Battlefield */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {board.battlefield.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-text-muted text-center px-8">
              Tap a card in your hand to play it
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {board.battlefield.map((card) => (
              <BattlefieldCard
                key={card.uid}
                card={card}
                onTap={() => dispatch({ type: "TOGGLE_TAP", uid: card.uid })}
                onMenu={() => setSelected({ card, zone: "battlefield" })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Zone strip */}
      <div className="px-4 py-1.5 border-t border-border flex items-center gap-2 shrink-0">
        <ZoneChip label="Graveyard" count={board.graveyard.length} onClick={() => setViewZone("graveyard")} />
        <ZoneChip label="Exile" count={board.exile.length} onClick={() => setViewZone("exile")} />
        <span className="ml-auto text-xs text-text-muted">{board.hand.length} in hand</span>
      </div>

      {/* Hand */}
      <div className="border-t border-border shrink-0">
        <div className="flex gap-2 px-3 py-2 overflow-x-auto">
          {board.hand.length === 0 ? (
            <p className="text-xs text-text-muted py-4 mx-auto">Hand is empty</p>
          ) : (
            board.hand.map((card) => (
              <HandCard
                key={card.uid}
                card={card}
                onPlay={() => dispatch({ type: "MOVE", uid: card.uid, from: "hand", to: "battlefield" })}
                onMenu={() => setSelected({ card, zone: "hand" })}
              />
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 flex gap-2 border-t border-border shrink-0">
        <button
          onClick={() => dispatch({ type: "DRAW" })}
          disabled={board.library.length === 0}
          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all active:scale-[0.98] disabled:opacity-40"
        >
          Draw
        </button>
        <button
          onClick={() => dispatch({ type: "NEXT_TURN" })}
          className="flex-[2] py-2.5 rounded-xl btn-gradient text-sm font-bold transition-all active:scale-[0.98]"
        >
          Next Turn
        </button>
      </div>

      {/* Zone viewer sheet */}
      {viewZone && !selected && (
        <Sheet onClose={() => setViewZone(null)} title={viewZone === "graveyard" ? "Graveyard" : "Exile"}>
          {board[viewZone].length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">Empty</p>
          ) : (
            <ul className="max-h-[50vh] overflow-y-auto">
              {board[viewZone].map((card) => (
                <li key={card.uid}>
                  <button
                    onClick={() => setSelected({ card, zone: viewZone })}
                    className="w-full flex items-center gap-3 px-1 py-2 text-left hover:bg-bg-hover rounded-lg transition-colors"
                  >
                    <div className="w-8 shrink-0 rounded overflow-hidden" style={{ aspectRatio: "488/680" }}>
                      <CardFace card={card} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{card.name}</p>
                      {card.typeLine && (
                        <p className="text-xs text-text-muted truncate">{card.typeLine}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}

      {/* Card action sheet */}
      {selected && (
        <Sheet onClose={() => setSelected(null)} title={selected.card.name}>
          {(selected.card.typeLine || selected.card.cmc !== undefined) && (
            <p className="text-xs text-text-muted -mt-2 mb-3">
              {selected.card.typeLine}
              {selected.card.typeLine && selected.card.cmc !== undefined && " · "}
              {selected.card.cmc !== undefined && `${selected.card.cmc} CMC`}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {selected.zone === "battlefield" && (
              <button
                onClick={() => {
                  dispatch({ type: "TOGGLE_TAP", uid: selected.card.uid });
                  setSelected(null);
                }}
                className="w-full py-2.5 rounded-xl border border-accent/50 text-sm font-semibold text-accent hover:bg-accent/10 transition-all active:scale-[0.98]"
              >
                {board.battlefield.find((c) => c.uid === selected.card.uid)?.tapped ? "Untap" : "Tap"}
              </button>
            )}
            {MOVE_TARGETS.filter((t) => t.to !== selected.zone).map((t) => (
              <button
                key={t.to}
                onClick={() => moveSelected(t.to)}
                className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all active:scale-[0.98]"
              >
                {t.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ── Bottom sheet ─────────────────────────────────────────────────────────────

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[109]" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-[110] bg-bg-card border-t border-border rounded-t-2xl px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] animate-sheet-up"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text-primary truncate pr-2">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 text-text-muted hover:text-text-primary transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

// ── Card faces ────────────────────────────────────────────────────────────────

function CardFace({ card }: { card: SimCard }) {
  const land = isLand(card);
  if (card.imageUri) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={card.imageUri} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
    );
  }
  return (
    <div className={cn(
      "w-full h-full flex flex-col items-center justify-center gap-1 p-1 text-center",
      land ? "bg-mtg-green/20" : "bg-bg-card"
    )}>
      <p className="text-[9px] font-semibold text-text-primary leading-tight line-clamp-3">{card.name}</p>
      {card.cmc !== undefined && !land && (
        <span className="text-[8px] text-text-muted">{card.cmc} CMC</span>
      )}
    </div>
  );
}

function MenuButton({ name, onMenu }: { name: string; onMenu: () => void }) {
  return (
    <button
      onClick={onMenu}
      aria-label={`Actions for ${name}`}
      className="absolute top-0.5 right-0.5 z-10 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] leading-none flex items-center justify-center"
    >
      ⋯
    </button>
  );
}

function BattlefieldCard({ card, onTap, onMenu }: { card: BoardCard; onTap: () => void; onMenu: () => void }) {
  return (
    <div
      className={cn("relative transition-transform", card.tapped && "rotate-90 scale-[0.72]")}
      style={{ aspectRatio: "488/680" }}
    >
      <button
        onClick={onTap}
        aria-pressed={card.tapped}
        aria-label={`${card.name}${card.tapped ? " (tapped)" : ""}`}
        className="absolute inset-0 rounded-lg overflow-hidden active:scale-95 transition-transform"
      >
        <CardFace card={card} />
      </button>
      <MenuButton name={card.name} onMenu={onMenu} />
    </div>
  );
}

function HandCard({ card, onPlay, onMenu }: { card: SimCard; onPlay: () => void; onMenu: () => void }) {
  return (
    <div className="relative shrink-0 w-16" style={{ aspectRatio: "488/680" }}>
      <button
        onClick={onPlay}
        aria-label={`Play ${card.name}`}
        className="absolute inset-0 rounded-lg overflow-hidden active:scale-95 transition-transform"
      >
        <CardFace card={card} />
      </button>
      <MenuButton name={card.name} onMenu={onMenu} />
    </div>
  );
}

function ZoneChip({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-0.5 rounded-full bg-bg-card border border-border text-xs text-text-muted hover:border-accent/40 hover:text-text-primary transition-colors active:scale-[0.97]"
    >
      {label}: <span className="font-semibold text-text-primary">{count}</span>
    </button>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run lint` → no new errors/warnings.

- [ ] **Step 3: Browser-verify zone management**

At phone width in the running dev server (Keep & Play into a playtest first):

1. Battlefield card `⋯` → sheet shows card name/type/CMC + Tap/Untap + 4 move targets (no "To Battlefield").
2. "To Graveyard" → card leaves battlefield, Graveyard chip count increments, sheet closes.
3. Graveyard chip → viewer lists the card; tap it → action sheet; "To Battlefield" → returns untapped, both sheets closed.
4. Hand card `⋯` → "To Graveyard" discards (does NOT play it); `⋯` → "Top of Library" then **Draw** → same card comes back.
5. Tap a tapped battlefield card's `⋯` → button reads "Untap"; it untaps.
6. Exile chip on an empty exile → "Empty" state; backdrop tap closes.
7. `⋯` tap does NOT also trigger play/tap (the buttons are siblings — verify no double-fire).

- [ ] **Step 4: Commit**

```bash
git add src/components/decks/PlaytestBoard.tsx
git commit -m "feat(playtest): card action sheet + graveyard/exile viewers"
```

---

### Task 4: Final verification, SW cache bump

**Files:**
- Modify: `public/sw.js:1`

**Interfaces:**
- Consumes: everything above. Produces: shippable branch.

- [ ] **Step 1: Bump the service worker cache**

In `public/sw.js` line 1, change:

```js
const CACHE_NAME = "mtg-houdini-v0.5.0";
```

to:

```js
const CACHE_NAME = "mtg-houdini-v0.5.1";
```

(A stale SW masked the entire Phase 1 redesign for returning PWA users — this is mandatory for any user-visible feature.)

- [ ] **Step 2: Full verification suite**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run lint` → no new errors/warnings.
Run: `npm run build` → completes successfully.

- [ ] **Step 3: Full manual pass (phone width, dev server)**

End-to-end: open deck → simulator → mulligan twice → Keep (bottom 2) → confirm → playtest starts with 5 cards → play a land + a spell → tap both → Next Turn ×3 (turn counter, untaps, auto-draws) → kill a creature to graveyard → reanimate it → exile something → restart via header icon → back at Opening Hand → X → reopen → clean state. Also sanity-check at desktop width (`lg:`) that the overlay still renders sensibly (it's `fixed inset-0`, so the grid just gets wider — acceptable).

- [ ] **Step 4: Commit**

```bash
git add public/sw.js
git commit -m "chore: bump SW cache for goldfish playtest release"
```

- [ ] **Step 5: STOP — ask danlo before merging**

Whole-branch review, then present the branch. Merge authorization is per-session; do NOT merge `feat/goldfish-playtest` to main without an explicit go-ahead.
