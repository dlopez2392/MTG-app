import { NextResponse } from "next/server";
import { getDeepSeek } from "@/lib/deepseek/client";

interface BuildRequest {
  format: string;
  commander?: string;
  budget?: number;
  strategy: string;
  colors?: string;
}

const SYSTEM_PROMPT = `You are a Magic: The Gathering deck building expert. You create optimized decklists based on player constraints.

INSTRUCTIONS:
- Build a complete, playable decklist for the specified format
- Use REAL card names only — exact official English names as printed. No invented cards.
- For Commander: exactly 100 cards total including the commander. Include 35-38 lands.
- For 60-card formats: exactly 60 main deck + up to 15 sideboard. Include 22-26 lands.
- Respect the format's legality — only suggest cards legal in the specified format
- If a budget is specified, prefer cheaper printings and budget-friendly alternatives
- Build a cohesive strategy, not just good-stuff piles
- Include proper mana fixing (dual lands, signets, etc.) for multicolor decks
- Balance the mana curve appropriately for the strategy

RESPONSE FORMAT (JSON):
{
  "deckName": "Descriptive deck name",
  "strategy": "2-3 sentence description of how the deck wins",
  "commander": "Commander card name (only for Commander format, omit otherwise)",
  "cards": [
    {
      "name": "Exact Card Name",
      "quantity": 1,
      "category": "commander" | "creature" | "instant" | "sorcery" | "artifact" | "enchantment" | "planeswalker" | "land",
      "reason": "Why this card (1 short sentence)"
    }
  ],
  "budgetTips": "Optional: how to cut costs further or where to invest upgrades",
  "keyCards": ["Card Name 1", "Card Name 2", "Card Name 3"],
  "gameplan": ["Early game plan", "Mid game plan", "Late game / win condition"]
}

The commander should also appear in the cards array with category "commander" and quantity 1.
Every card name must be exact — Scryfall will validate each one. Misspelled or invented cards will be flagged as errors.`;

const SCRYFALL_COLLECTION_URL = "https://api.scryfall.com/cards/collection";

interface ScryfallCollectionCard {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  rarity: string;
  image_uris?: { normal?: string; small?: string };
  card_faces?: { image_uris?: { normal?: string } }[];
  prices: { usd?: string | null; usd_foil?: string | null };
  legalities: Record<string, string>;
}

async function validateWithScryfall(
  cardNames: string[]
): Promise<{ found: Map<string, ScryfallCollectionCard>; notFound: string[] }> {
  const found = new Map<string, ScryfallCollectionCard>();
  const notFound: string[] = [];
  const batchSize = 75;

  for (let i = 0; i < cardNames.length; i += batchSize) {
    const batch = cardNames.slice(i, i + batchSize);
    const identifiers = batch.map((name) => ({ name }));

    try {
      const res = await fetch(SCRYFALL_COLLECTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "MTGHoudini/1.0",
        },
        body: JSON.stringify({ identifiers }),
      });

      if (!res.ok) {
        notFound.push(...batch);
        continue;
      }

      const data = await res.json();

      for (const card of data.data ?? []) {
        found.set(card.name.toLowerCase(), card);
      }

      for (const nf of data.not_found ?? []) {
        notFound.push(nf.name);
      }
    } catch {
      notFound.push(...batch);
    }

    if (i + batchSize < cardNames.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return { found, notFound };
}

export async function POST(req: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI deck builder not configured." }, { status: 503 });
  }

  const body: BuildRequest = await req.json();

  if (!body.format || !body.strategy) {
    return NextResponse.json({ error: "Format and strategy are required" }, { status: 400 });
  }

  try {
    const deepseek = getDeepSeek();

    let userPrompt = `Build me a ${body.format} deck.\n\nStrategy: ${body.strategy}`;
    if (body.commander) userPrompt += `\nCommander: ${body.commander}`;
    if (body.budget) userPrompt += `\nBudget: under $${body.budget} total`;
    if (body.colors) userPrompt += `\nColors: ${body.colors}`;

    const result = await deepseek.chat.completions.create({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    });

    const text = result.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const aiDeck = JSON.parse(cleaned);

    const uniqueNames = [...new Set<string>(
      (aiDeck.cards ?? []).map((c: { name: string }) => c.name)
    )];

    const { found, notFound } = await validateWithScryfall(uniqueNames);

    const validatedCards = [];
    let totalPrice = 0;

    for (const aiCard of aiDeck.cards ?? []) {
      const scryfall = found.get(aiCard.name.toLowerCase());
      if (!scryfall) continue;

      const price = parseFloat(scryfall.prices?.usd ?? "0") || 0;
      const cardTotal = price * (aiCard.quantity ?? 1);
      totalPrice += cardTotal;

      const imageUri =
        scryfall.image_uris?.normal ??
        scryfall.card_faces?.[0]?.image_uris?.normal ??
        undefined;

      validatedCards.push({
        scryfallId: scryfall.id,
        name: scryfall.name,
        quantity: aiCard.quantity ?? 1,
        category: aiCard.category ?? "main",
        reason: aiCard.reason ?? "",
        manaCost: scryfall.mana_cost,
        cmc: scryfall.cmc,
        typeLine: scryfall.type_line,
        rarity: scryfall.rarity,
        colors: scryfall.colors,
        imageUri,
        priceUsd: scryfall.prices?.usd ?? null,
        priceTotal: cardTotal,
      });
    }

    return NextResponse.json({
      deckName: aiDeck.deckName ?? "AI Generated Deck",
      strategy: aiDeck.strategy ?? "",
      commander: aiDeck.commander,
      cards: validatedCards,
      notFound,
      totalPrice: Math.round(totalPrice * 100) / 100,
      budgetTips: aiDeck.budgetTips,
      keyCards: aiDeck.keyCards ?? [],
      gameplan: aiDeck.gameplan ?? [],
      cardCount: validatedCards.reduce((sum: number, c: { quantity: number }) => sum + c.quantity, 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deck building failed";
    console.error("AI deck builder error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
