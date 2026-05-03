import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDeepSeek } from "@/lib/deepseek/client";
import { rateLimit } from "@/lib/rateLimit";

interface DeckSummary {
  name: string;
  format?: string;
  cards: { name: string; quantity: number; category: string; typeLine?: string; manaCost?: string; cmc?: number }[];
}

interface MatchupRequest {
  deckA: DeckSummary;
  deckB: DeckSummary;
}

function formatDeck(deck: DeckSummary): string {
  const commander = deck.cards.filter((c) => c.category === "commander");
  const main = deck.cards.filter((c) => c.category === "main" || c.category === "commander");
  const lines = main.map((c) => `${c.quantity}x ${c.name}${c.typeLine ? ` [${c.typeLine}]` : ""}`);
  const header = commander.length > 0
    ? `${deck.name} (Commander: ${commander.map((c) => c.name).join(", ")})`
    : deck.name;
  return `${header}${deck.format ? ` [${deck.format}]` : ""}\n${lines.join("\n")}`;
}

const SYSTEM_PROMPT = `You are a Magic: The Gathering matchup analyst built into the MTG Houdini app. Analyze how two decks match up against each other in a head-to-head game.

INSTRUCTIONS:
- Analyze both decklists and determine which deck is favored and why
- Identify the key interactions between the two decks
- Consider: speed, interaction, threats, answers, mana efficiency, card advantage engines
- Provide practical piloting advice for each side
- Be specific — reference actual cards from both lists
- For Commander: assume a 1v1 scenario for clarity, but note if multiplayer dynamics would shift things

RESPONSE FORMAT (JSON):
{
  "favored": "A" | "B" | "even",
  "confidence": "high" | "medium" | "low",
  "favoredReason": "1-2 sentence summary of why the favored deck has the edge",
  "estimatedWinRate": "e.g. 60-40, 55-45, 50-50",
  "keyInteractions": [
    {
      "description": "Specific interaction between cards from both decks",
      "advantage": "A" | "B"
    }
  ],
  "deckAStrengths": ["Strength 1", "Strength 2"],
  "deckAWeaknesses": ["Weakness 1"],
  "deckBStrengths": ["Strength 1", "Strength 2"],
  "deckBWeaknesses": ["Weakness 1"],
  "pilotingAdviceA": "2-3 sentences on how Deck A should play this matchup",
  "pilotingAdviceB": "2-3 sentences on how Deck B should play this matchup",
  "swingCards": [
    { "card": "Card Name", "deck": "A" | "B", "impact": "Why this card matters in this matchup" }
  ]
}

Keep each field concise. Include 3-5 key interactions and 2-4 swing cards.`;

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
    return NextResponse.json({ error: "AI matchup analysis not configured." }, { status: 503 });
  }

  const body: MatchupRequest = await req.json();

  if (!body.deckA?.cards?.length || !body.deckB?.cards?.length) {
    return NextResponse.json({ error: "Both decks must have cards" }, { status: 400 });
  }

  if (body.deckA.cards.length > 200 || body.deckB.cards.length > 200) {
    return NextResponse.json({ error: "Too many cards per deck (max 200)" }, { status: 400 });
  }

  try {
    const deepseek = getDeepSeek();

    const userPrompt = `=== DECK A ===
${formatDeck(body.deckA)}

=== DECK B ===
${formatDeck(body.deckB)}

Analyze this matchup.`;

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
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Matchup analysis failed";
    console.error("Matchup analysis error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
