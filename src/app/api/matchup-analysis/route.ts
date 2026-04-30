import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

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
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI matchup analysis not configured." }, { status: 503 });
  }

  const body: MatchupRequest = await req.json();

  if (!body.deckA?.cards?.length || !body.deckB?.cards?.length) {
    return NextResponse.json({ error: "Both decks must have cards" }, { status: 400 });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `${SYSTEM_PROMPT}

=== DECK A ===
${formatDeck(body.deckA)}

=== DECK B ===
${formatDeck(body.deckB)}

Analyze this matchup.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Matchup analysis failed";
    console.error("Matchup analysis error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
