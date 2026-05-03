import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDeepSeek } from "@/lib/deepseek/client";
import { rateLimit } from "@/lib/rateLimit";

interface ComboRequest {
  deckName: string;
  cards: { name: string; quantity: number; typeLine?: string; oracleText?: string; manaCost?: string }[];
}

const SYSTEM_PROMPT = `You are a Magic: The Gathering combo expert. You analyze decklists to discover synergies and combo lines the player may not be aware of.

INSTRUCTIONS:
- Find ALL infinite combos, near-infinite loops, and powerful synergy chains in the decklist
- Only identify combos using cards that ARE in the decklist — do not suggest cards to add
- For each combo, explain the exact sequence of steps to execute it
- Rate each combo's practicality: how easy is it to assemble in a real game?
- Note if any combo requires specific board states or additional conditions
- Look for non-obvious 3+ card combos, not just well-known 2-card pairs
- Consider triggered abilities, replacement effects, and unusual interactions

RESPONSE FORMAT (JSON):
{
  "combos": [
    {
      "name": "Short combo name",
      "cards": ["Card A", "Card B", "Card C"],
      "type": "infinite" | "synergy" | "value",
      "description": "What the combo does (1-2 sentences)",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "result": "The end result (infinite damage, infinite mana, etc.)",
      "difficulty": "easy" | "medium" | "hard",
      "notes": "Optional: conditions, weaknesses, or tips"
    }
  ],
  "summary": "Brief overview of the deck's combo potential (1-2 sentences)",
  "missingPieces": [
    {
      "combo": "Name of a well-known combo that is 1 card away",
      "have": ["Cards already in the deck"],
      "need": "The missing card",
      "reason": "Why this would be strong in this deck"
    }
  ]
}

Return 0 combos if none exist — don't invent fake interactions. Include up to 3 missing pieces for combos that are 1 card away. Be specific with card names.`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit(`ai:${userId}`, 10, 60_000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI combo analysis not configured." }, { status: 503 });
  }

  const body: ComboRequest = await req.json();

  if (!body.cards || body.cards.length === 0) {
    return NextResponse.json({ error: "Deck has no cards to analyze" }, { status: 400 });
  }

  if (body.cards.length > 200) {
    return NextResponse.json({ error: "Too many cards (max 200)" }, { status: 400 });
  }

  try {
    const deepseek = getDeepSeek();

    const decklist = body.cards
      .map((c) => {
        const parts = [`${c.quantity}x ${c.name}`];
        if (c.typeLine) parts.push(`[${c.typeLine}]`);
        if (c.oracleText) parts.push(`— ${c.oracleText}`);
        return parts.join(" ");
      })
      .join("\n");

    const result = await deepseek.chat.completions.create({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analyze this decklist for combos and synergies:\n\nDeck: "${body.deckName}"\n\n${decklist}` },
      ],
      temperature: 0.4,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    });

    const text = result.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Combo analysis failed";
    console.error("Combo discovery error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
