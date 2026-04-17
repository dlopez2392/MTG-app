import { NextRequest, NextResponse } from "next/server";

interface SeventeenLandsCard {
  name: string;
  avg_seen: number | null;
  avg_pick: number | null;
  game_count: number | null;
  win_rate: number | null;
  opening_hand_win_rate: number | null;
  drawn_win_rate: number | null;
  ever_drawn_win_rate: number | null;
  never_drawn_win_rate: number | null;
  drawn_improvement_win_rate: number | null;
}

const FORMATS = ["PremierDraft", "QuickDraft", "TradDraft"];

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const set = sp.get("set");
  const name = sp.get("name");

  if (!set || !name) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const cardName = name.split(" // ")[0].trim().toLowerCase();

  for (const format of FORMATS) {
    try {
      const res = await fetch(
        `https://www.17lands.com/card_ratings/data?expansion=${set.toUpperCase()}&format=${format}`,
        { next: { revalidate: 3600 } } // cache 1h
      );

      if (!res.ok) continue;

      const cards: SeventeenLandsCard[] = await res.json();
      if (!Array.isArray(cards) || cards.length === 0) continue;

      const card = cards.find(
        (c) => c.name?.split(" // ")[0].trim().toLowerCase() === cardName
      );

      if (!card) continue;

      return NextResponse.json({
        format,
        set: set.toUpperCase(),
        stats: {
          avgSeen: card.avg_seen,
          avgPick: card.avg_pick,
          gameCount: card.game_count,
          winRate: card.win_rate,
          openingHandWinRate: card.opening_hand_win_rate,
          drawnWinRate: card.drawn_win_rate,
          everDrawnWinRate: card.ever_drawn_win_rate,
          neverDrawnWinRate: card.never_drawn_win_rate,
          drawnImprovementWinRate: card.drawn_improvement_win_rate,
        },
      });
    } catch {
      continue;
    }
  }

  // No draft data found for this card/set
  return NextResponse.json({ stats: null });
}
