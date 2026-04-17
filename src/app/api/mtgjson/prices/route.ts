import { NextRequest, NextResponse } from "next/server";

interface MtgjsonPriceMap {
  [date: string]: string;
}

interface MtgjsonPriceGroup {
  retail?: MtgjsonPriceMap;
  buylist?: MtgjsonPriceMap;
}

interface MtgjsonCardPrices {
  paper?: {
    cardkingdom?: MtgjsonPriceGroup;
    cardkingdomFoil?: MtgjsonPriceGroup;
    cardmarket?: MtgjsonPriceGroup;
    cardmarketFoil?: MtgjsonPriceGroup;
  };
}

function getLatest(map: MtgjsonPriceMap | undefined): string | null {
  if (!map) return null;
  const dates = Object.keys(map).sort();
  if (dates.length === 0) return null;
  return map[dates[dates.length - 1]] ?? null;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const setCode = sp.get("set");
  const scryfallId = sp.get("scryfallId");

  if (!setCode || !scryfallId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://mtgjson.com/api/v5/${setCode.toUpperCase()}.json`,
      { next: { revalidate: 86400 } } // cache 24h
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Set not found" }, { status: 404 });
    }

    const data = await res.json();
    const cards: Array<{ identifiers?: { scryfallId?: string }; prices?: MtgjsonCardPrices }> =
      data.data?.cards ?? [];

    const card = cards.find(
      (c) =>
        c.identifiers?.scryfallId === scryfallId
    );

    if (!card) {
      return NextResponse.json({ error: "Card not found in set" }, { status: 404 });
    }

    const paper = card.prices?.paper ?? {};

    return NextResponse.json({
      cardKingdom: {
        retail: getLatest(paper.cardkingdom?.retail),
        buylist: getLatest(paper.cardkingdom?.buylist),
        retailFoil: getLatest(paper.cardkingdomFoil?.retail),
        buylistFoil: getLatest(paper.cardkingdomFoil?.buylist),
      },
      cardmarket: {
        retail: getLatest(paper.cardmarket?.retail),
        retailFoil: getLatest(paper.cardmarketFoil?.retail),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch MTGJSON data" }, { status: 500 });
  }
}
