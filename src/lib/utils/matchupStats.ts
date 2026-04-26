import type { GameEntry } from "@/types/game";

export interface DeckMatchup {
  deckName: string;
  deckId?: string;
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number;
}

export interface OpponentMatchups {
  opponentName: string;
  overall: { wins: number; losses: number; draws: number; total: number; winRate: number };
  byDeck: DeckMatchup[];
}

export function computeDeckMatchups(
  entries: GameEntry[],
  opponentName: string,
): OpponentMatchups {
  const nameLower = opponentName.toLowerCase();
  const deckMap = new Map<string, DeckMatchup>();
  const overall = { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 };

  for (const entry of entries) {
    if (!entry.opponentNames) continue;
    const opponents = entry.opponentNames.split(",").map((n) => n.trim().toLowerCase());
    if (!opponents.includes(nameLower)) continue;

    overall.total++;
    if (entry.result === "win") overall.wins++;
    else if (entry.result === "loss") overall.losses++;
    else overall.draws++;

    const key = entry.deckName.toLowerCase();
    let deck = deckMap.get(key);
    if (!deck) {
      deck = { deckName: entry.deckName, deckId: entry.deckId, wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 };
      deckMap.set(key, deck);
    }
    deck.total++;
    if (entry.result === "win") deck.wins++;
    else if (entry.result === "loss") deck.losses++;
    else deck.draws++;
  }

  overall.winRate = overall.total > 0 ? Math.round((overall.wins / overall.total) * 100) : 0;

  const byDeck = Array.from(deckMap.values())
    .map((d) => ({ ...d, winRate: d.total > 0 ? Math.round((d.wins / d.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  return { opponentName, overall, byDeck };
}

export function computeMyDeckMatchups(
  entries: GameEntry[],
  deckId?: string,
  deckName?: string,
): { opponentName: string; wins: number; losses: number; draws: number; total: number; winRate: number }[] {
  const opponentMap = new Map<string, { opponentName: string; wins: number; losses: number; draws: number; total: number }>();

  for (const entry of entries) {
    if (!entry.opponentNames) continue;
    const matchesDeck = deckId
      ? entry.deckId === deckId
      : deckName
        ? entry.deckName.toLowerCase() === deckName.toLowerCase()
        : false;
    if (!matchesDeck) continue;

    const opponents = entry.opponentNames.split(",").map((n) => n.trim());
    for (const opp of opponents) {
      if (!opp) continue;
      const key = opp.toLowerCase();
      let stats = opponentMap.get(key);
      if (!stats) {
        stats = { opponentName: opp, wins: 0, losses: 0, draws: 0, total: 0 };
        opponentMap.set(key, stats);
      }
      stats.total++;
      if (entry.result === "win") stats.wins++;
      else if (entry.result === "loss") stats.losses++;
      else stats.draws++;
    }
  }

  return Array.from(opponentMap.values())
    .map((s) => ({ ...s, winRate: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);
}
