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
}

interface LocalSignals {
  gameChangers: string[];
  fastMana: string[];
  tutors: string[];
  mldCards: string[];
  extraTurns: string[];
  staxPieces: string[];
  comboPieces: string[];
  avgCmc: number;
  landCount: number;
  totalCards: number;
  interactionCount: number;
}

interface BracketRequest {
  deckName: string;
  cards: DeckCardInput[];
  localBracket: number;
  localSignals: LocalSignals;
}

const SYSTEM_PROMPT = `You are an expert on the Commander Bracket System for Magic: The Gathering. You evaluate decklists to determine their correct power bracket (1-4) and generate Rule 0 conversation summaries.

## Bracket Definitions:
- **Bracket 1 (Casual)**: Precon-level or below. No tutors, no fast mana, no combos, no stax. Wins through combat or value over many turns. Expected game length: 10+ turns.
- **Bracket 2 (Focused)**: Has a clear strategy and some synergy engines, but limited tutors (1-2 max), no fast mana beyond Sol Ring, no infinite combos, minimal stax. May have a few individually powerful cards. Expected game length: 8-12 turns.
- **Bracket 3 (Optimized)**: Efficient mana base, multiple tutors, some fast mana, may have 1-2 combo lines but not hyper-efficient ones. Runs efficient interaction. Stax elements possible but not dominant. Expected game length: 6-9 turns.
- **Bracket 4 (Competitive/cEDH)**: Game Changers present, dense tutor package, fast mana, efficient combo wins (often by turn 4-6), heavy stax/denial possible. Built to win as fast and consistently as possible.

## Your Task:
You receive a decklist with local analysis signals already computed. Your job is to:
1. Confirm or adjust the bracket based on semantic analysis of card interactions, combo lines, and overall strategy
2. Identify specific win conditions and how fast they can close
3. Flag any "spicy" inclusions worth mentioning in a Rule 0 conversation
4. Generate upgrade suggestions that show bracket-shift boundaries

Respond ONLY with valid JSON matching this structure:
{
  "bracket": 1 | 2 | 3 | 4,
  "bracketLabel": "Casual" | "Focused" | "Optimized" | "Competitive",
  "confidence": 0.0 to 1.0,
  "summary": "1-2 sentence power level summary",
  "expectedClosingTurn": "Turn X-Y range",
  "winConditions": ["specific win condition 1", "win condition 2"],
  "comboLines": [
    { "cards": ["Card A", "Card B"], "description": "what the combo does", "speed": "early|mid|late" }
  ],
  "spicyInclusions": ["card name worth flagging and why"],
  "mldPresent": true | false,
  "extraTurnsPresent": true | false,
  "infiniteCombos": true | false,
  "staxLevel": "none" | "light" | "moderate" | "heavy",
  "rule0Summary": "A 2-3 sentence summary a player can show their pod before a game starts. Include bracket, main strategy, expected closing turn, and any flags.",
  "upgradePaths": [
    {
      "tier": "Budget Upgrade" | "Power Upgrade" | "Competitive Upgrade",
      "currentBracket": 1 | 2 | 3 | 4,
      "targetBracket": 2 | 3 | 4,
      "swaps": [
        { "cut": "card to remove", "add": "card to add", "reason": "why", "bracketImpact": "explanation of bracket shift" }
      ],
      "warning": "Overall bracket shift warning message"
    }
  ]
}

Be specific with card names. Reference actual MTG cards. Keep the Rule 0 summary concise and useful for LGS table conversations. Do NOT wrap JSON in markdown fences.`;

function buildDeckSummary(req: BracketRequest): string {
  const mainCards = req.cards.filter((c) => c.category === "main" || c.category === "commander");
  const commanderCards = req.cards.filter((c) => c.category === "commander");

  let summary = `Deck: "${req.deckName}"\n`;

  if (commanderCards.length > 0) {
    summary += `Commander(s): ${commanderCards.map((c) => `${c.name} (${c.manaCost ?? "?"})`).join(", ")}\n`;
  }

  summary += `\nLocal Analysis (pre-computed):\n`;
  summary += `  Suggested Bracket: ${req.localBracket}\n`;
  summary += `  Game Changers: ${req.localSignals.gameChangers.length > 0 ? req.localSignals.gameChangers.join(", ") : "None"}\n`;
  summary += `  Fast Mana: ${req.localSignals.fastMana.length > 0 ? req.localSignals.fastMana.join(", ") : "None"}\n`;
  summary += `  Tutors (${req.localSignals.tutors.length}): ${req.localSignals.tutors.length > 0 ? req.localSignals.tutors.join(", ") : "None"}\n`;
  summary += `  MLD: ${req.localSignals.mldCards.length > 0 ? req.localSignals.mldCards.join(", ") : "None"}\n`;
  summary += `  Extra Turns: ${req.localSignals.extraTurns.length > 0 ? req.localSignals.extraTurns.join(", ") : "None"}\n`;
  summary += `  Stax Pieces (${req.localSignals.staxPieces.length}): ${req.localSignals.staxPieces.length > 0 ? req.localSignals.staxPieces.join(", ") : "None"}\n`;
  summary += `  Combo Pieces (${req.localSignals.comboPieces.length}): ${req.localSignals.comboPieces.length > 0 ? req.localSignals.comboPieces.join(", ") : "None"}\n`;
  summary += `  Avg CMC: ${req.localSignals.avgCmc.toFixed(2)}\n`;
  summary += `  Lands: ${req.localSignals.landCount}/${req.localSignals.totalCards}\n`;
  summary += `  Interaction Count: ${req.localSignals.interactionCount}\n`;

  summary += `\nFull Decklist:\n`;
  for (const c of mainCards) {
    summary += `${c.quantity}x ${c.name} (${c.manaCost ?? "N/A"}, CMC ${c.cmc ?? 0}, ${c.typeLine ?? "Unknown"})\n`;
  }

  return summary;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI analysis is not configured. Add GEMINI_API_KEY to environment variables." }, { status: 503 });
  }

  const body: BracketRequest = await req.json();

  if (!body.cards || body.cards.length === 0) {
    return NextResponse.json({ error: "Deck has no cards to analyze" }, { status: 400 });
  }

  try {
    const deckSummary = buildDeckSummary(body);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nAnalyze this Commander deck for bracket placement:\n\n${deckSummary}` }] },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const analysis = JSON.parse(cleaned);

    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bracket analysis failed";
    console.error("Bracket analysis error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
