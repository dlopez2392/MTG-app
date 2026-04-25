import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

interface DeckCardInput {
  name: string;
  quantity: number;
  category: string;
  manaCost?: string;
  cmc?: number;
  typeLine?: string;
  rarity?: string;
  priceUsd?: string | null;
}

interface CoachingRequest {
  deckName: string;
  format: string;
  cards: DeckCardInput[];
}

function buildDeckSummary(req: CoachingRequest): string {
  const mainCards = req.cards.filter((c) => c.category === "main" || c.category === "commander");
  const sideboardCards = req.cards.filter((c) => c.category === "sideboard");
  const commanderCards = req.cards.filter((c) => c.category === "commander");

  const totalCards = mainCards.reduce((s, c) => s + c.quantity, 0);
  const lands = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Land"));
  const landCount = lands.reduce((s, c) => s + c.quantity, 0);
  const nonLands = mainCards.filter((c) => !c.typeLine?.split("—")[0].includes("Land"));
  const avgCmc = nonLands.length > 0
    ? nonLands.reduce((s, c) => s + (c.cmc ?? 0) * c.quantity, 0) / nonLands.reduce((s, c) => s + c.quantity, 0)
    : 0;

  const creatures = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Creature"));
  const instants = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Instant"));
  const sorceries = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Sorcery"));
  const enchantments = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Enchantment"));
  const artifacts = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Artifact"));
  const planeswalkers = mainCards.filter((c) => c.typeLine?.split("—")[0].includes("Planeswalker"));

  let summary = `Deck: "${req.deckName}"\nFormat: ${req.format}\nTotal cards: ${totalCards}\nLands: ${landCount}\nAverage CMC (non-lands): ${avgCmc.toFixed(2)}\n`;

  if (commanderCards.length > 0) {
    summary += `\nCommander(s):\n`;
    for (const c of commanderCards) {
      summary += `  ${c.quantity}x ${c.name} (${c.manaCost ?? "?"}, CMC ${c.cmc ?? "?"}) — ${c.typeLine ?? "?"}\n`;
    }
  }

  summary += `\nType breakdown:\n`;
  summary += `  Creatures: ${creatures.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Instants: ${instants.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Sorceries: ${sorceries.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Enchantments: ${enchantments.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Artifacts: ${artifacts.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Planeswalkers: ${planeswalkers.reduce((s, c) => s + c.quantity, 0)}\n`;
  summary += `  Lands: ${landCount}\n`;

  summary += `\nFull decklist:\n`;
  for (const c of mainCards) {
    summary += `${c.quantity}x ${c.name} (${c.manaCost ?? "N/A"}, CMC ${c.cmc ?? 0}, ${c.typeLine ?? "Unknown"}${c.priceUsd ? `, $${c.priceUsd}` : ""})\n`;
  }

  if (sideboardCards.length > 0) {
    summary += `\nSideboard:\n`;
    for (const c of sideboardCards) {
      summary += `${c.quantity}x ${c.name} (${c.manaCost ?? "N/A"}, CMC ${c.cmc ?? 0}, ${c.typeLine ?? "Unknown"})\n`;
    }
  }

  return summary;
}

const SYSTEM_PROMPT = `You are an expert Magic: The Gathering deck coach and analyst. You analyze decklists and provide actionable, specific coaching advice.

Your analysis should cover these areas:

1. **Mana Base Analysis** — Is the land count appropriate for the deck's average CMC and strategy? Are there color fixing issues? Are there strictly better land options?

2. **Curve Analysis** — Is the mana curve appropriate for the deck's strategy? Is it too top-heavy for an aggro deck? Too low for a control deck?

3. **Card Quality** — Identify any cards that are strictly worse than available alternatives in the same colors and format. Suggest specific replacements with reasoning.

4. **Synergy & Strategy** — Does the deck have a coherent game plan? Are there cards that don't fit the strategy? Missing key synergy pieces?

5. **Interaction** — Does the deck have enough removal, counterspells, or board wipes for the format? What's missing?

6. **Win Conditions** — Are the win conditions clear and sufficient? Any backup plans?

Respond ONLY with valid JSON matching this exact structure:
{
  "overallGrade": "A" | "B" | "C" | "D" | "F",
  "summary": "1-2 sentence overall assessment",
  "manaBase": {
    "grade": "A" | "B" | "C" | "D" | "F",
    "analysis": "2-3 sentences",
    "suggestions": ["specific suggestion 1", "specific suggestion 2"]
  },
  "curve": {
    "grade": "A" | "B" | "C" | "D" | "F",
    "analysis": "2-3 sentences",
    "suggestions": ["specific suggestion 1"]
  },
  "cardQuality": {
    "upgrades": [
      { "cut": "card name to remove", "add": "better card name", "reason": "why" }
    ]
  },
  "synergy": {
    "analysis": "2-3 sentences about deck coherence",
    "missingPieces": ["card name 1", "card name 2"]
  },
  "interaction": {
    "grade": "A" | "B" | "C" | "D" | "F",
    "analysis": "1-2 sentences",
    "suggestions": ["specific card to add"]
  },
  "topPriority": ["most important change 1", "most important change 2", "most important change 3"]
}

Be specific with card names. Reference actual MTG cards that exist and are legal in the given format. Keep suggestions practical and actionable. Do NOT wrap the JSON in markdown code fences.`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI coaching is not configured. Add GEMINI_API_KEY to environment variables." }, { status: 503 });
  }

  const body: CoachingRequest = await req.json();

  if (!body.cards || body.cards.length === 0) {
    return NextResponse.json({ error: "Deck has no cards to analyze" }, { status: 400 });
  }

  try {
    const deckSummary = buildDeckSummary(body);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nAnalyze this decklist:\n\n${deckSummary}` }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();

    // Parse JSON — strip markdown fences if present
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const coaching = JSON.parse(cleaned);

    return NextResponse.json(coaching);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI analysis failed";
    console.error("Deck coach error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
