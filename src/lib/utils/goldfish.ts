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
      return state;
    }
  }
}
