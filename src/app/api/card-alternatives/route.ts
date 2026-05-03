import { NextResponse } from "next/server";
import { getDeepSeek } from "@/lib/deepseek/client";

interface AlternativesRequest {
  cardName: string;
  typeLine?: string;
  manaCost?: string;
  oracleText?: string;
  priceUsd?: string;
  colors?: string[];
  format?: string;
  budget?: "budget" | "moderate" | "any";
}

const SYSTEM_PROMPT = `You are a Magic: The Gathering card substitution expert built into the MTG Houdini app. Your job is to suggest alternative cards that serve a similar role.

INSTRUCTIONS:
- Given a card, suggest 5-8 alternatives that fill a similar strategic role
- Consider: similar effects, mana cost, card type, and strategic purpose
- For each alternative, explain WHY it's a good substitute (not just what it does)
- If the original card is expensive, prioritize budget-friendly options
- Respect format legality when a format is specified
- Include a mix of: direct upgrades, budget downgrades, and sidegrades (different but comparable)
- Only suggest real, existing Magic cards

RESPONSE FORMAT (JSON):
{
  "alternatives": [
    {
      "name": "Card Name",
      "reason": "Why this is a good alternative (1 sentence)",
      "role": "budget" | "sidegrade" | "upgrade",
      "estimatedPrice": "$X.XX",
      "keyDifference": "Main tradeoff vs the original (1 sentence)"
    }
  ],
  "summary": "Brief overview of what role this card fills and what to look for in substitutes (1-2 sentences)",
  "deckbuildingTip": "Optional practical tip about using alternatives in this slot"
}`;

export async function POST(req: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI alternatives not configured. Add DEEPSEEK_API_KEY." }, { status: 503 });
  }

  const body: AlternativesRequest = await req.json();

  if (!body.cardName || body.cardName.trim().length < 2) {
    return NextResponse.json({ error: "Card name is required" }, { status: 400 });
  }

  try {
    const deepseek = getDeepSeek();

    const cardContext = [
      `Card: ${body.cardName}`,
      body.typeLine ? `Type: ${body.typeLine}` : "",
      body.manaCost ? `Mana Cost: ${body.manaCost}` : "",
      body.oracleText ? `Oracle Text: ${body.oracleText}` : "",
      body.priceUsd ? `Current Price: $${body.priceUsd}` : "",
      body.colors?.length ? `Colors: ${body.colors.join(", ")}` : "",
      body.format ? `Format: ${body.format}` : "",
      body.budget ? `Budget preference: ${body.budget}` : "",
    ].filter(Boolean).join("\n");

    const result = await deepseek.chat.completions.create({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Find alternatives for:\n${cardContext}` },
      ],
      temperature: 0.5,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const text = result.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to find alternatives";
    console.error("Card alternatives error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
