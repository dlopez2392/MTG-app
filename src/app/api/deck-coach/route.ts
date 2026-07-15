import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { formatBanListForPrompt } from "@/lib/data/bannedCards";
import { getDeepSeek } from "@/lib/deepseek/client";
import { rateLimit } from "@/lib/rateLimit";
import { buildDeckSummary, type DeckCardInput } from "@/lib/decks/summary";

interface CoachingRequest {
  deckName: string;
  format: string;
  cards: DeckCardInput[];
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

CRITICAL: You will be given the format's banned and restricted card list. NEVER suggest banned cards as upgrades or additions. Only suggest cards that are LEGAL in the specified format. If the deck already contains banned cards, mention this in your analysis.

Be specific with card names. Reference actual MTG cards that exist and are legal in the given format. Keep suggestions practical and actionable. Do NOT wrap the JSON in markdown code fences.`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { success } = rateLimit(`ai:${userId}`, 10, 60_000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI coaching is not configured. Add DEEPSEEK_API_KEY to environment variables." }, { status: 503 });
  }

  const body: CoachingRequest = await req.json();

  if (!body.cards || body.cards.length === 0) {
    return NextResponse.json({ error: "Deck has no cards to analyze" }, { status: 400 });
  }

  try {
    const deckSummary = buildDeckSummary(body);
    const banList = formatBanListForPrompt(body.format || "commander");
    const deepseek = getDeepSeek();

    const result = await deepseek.chat.completions.create({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${banList}\n\nAnalyze this decklist:\n\n${deckSummary}` },
      ],
      temperature: 0.7,
      max_tokens: 16384,
      response_format: { type: "json_object" },
    });

    const text = result.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const coaching = JSON.parse(cleaned);

    return NextResponse.json(coaching);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI analysis failed";
    console.error("Deck coach error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
