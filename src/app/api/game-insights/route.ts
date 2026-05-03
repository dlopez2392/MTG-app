import { NextResponse } from "next/server";
import { getDeepSeek } from "@/lib/deepseek/client";

interface GameInsightRequest {
  entries: {
    date: string;
    deckName: string;
    result: "win" | "loss" | "draw";
    format?: string;
    playerCount: number;
    notes?: string;
    opponentNames?: string;
  }[];
}

const SYSTEM_PROMPT = `You are a Magic: The Gathering performance coach. You analyze a player's game history to find patterns, weaknesses, and actionable advice.

INSTRUCTIONS:
- Look for patterns the player might not notice: matchup weaknesses, deck performance trends, table-size blind spots
- Be specific with numbers: "You're 1-5 against aggro" not "you struggle against aggro"
- Reference actual deck names and opponent names from the data
- Prioritize actionable advice over observations
- If there are few games (<5), acknowledge limited data but still provide what insights you can
- Consider time trends: is performance improving or declining?
- Look at format-specific patterns if multiple formats are played
- Consider player count: do they perform differently in 1v1 vs pods?

RESPONSE FORMAT (JSON):
{
  "overallAssessment": "1-2 sentence summary of the player's overall trajectory",
  "insights": [
    {
      "title": "Short insight title",
      "category": "matchup" | "deck" | "trend" | "strategy" | "meta",
      "severity": "strength" | "neutral" | "weakness",
      "finding": "The specific pattern found (1-2 sentences with numbers)",
      "advice": "What to do about it (1-2 sentences)"
    }
  ],
  "deckRecommendations": [
    {
      "deckName": "Name of a deck from the log",
      "verdict": "keep" | "tune" | "retire",
      "reason": "Why (1 sentence with stats)"
    }
  ],
  "focus": "The single most impactful thing the player should focus on to improve"
}

Return 3-6 insights ordered by impact. Be honest but encouraging — highlight strengths alongside weaknesses.`;

export async function POST(req: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI insights not configured." }, { status: 503 });
  }

  const body: GameInsightRequest = await req.json();

  if (!body.entries || body.entries.length === 0) {
    return NextResponse.json({ error: "No game history to analyze" }, { status: 400 });
  }

  try {
    const deepseek = getDeepSeek();

    const gameLog = body.entries
      .map((e) => {
        const parts = [`${e.date} | ${e.result.toUpperCase()} | ${e.deckName}`];
        if (e.format) parts.push(`[${e.format}]`);
        parts.push(`${e.playerCount}p`);
        if (e.opponentNames) parts.push(`vs ${e.opponentNames}`);
        if (e.notes) parts.push(`— ${e.notes}`);
        return parts.join(" ");
      })
      .join("\n");

    const result = await deepseek.chat.completions.create({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analyze this player's game history (${body.entries.length} games):\n\n${gameLog}` },
      ],
      temperature: 0.4,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

    const text = result.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Game insights analysis failed";
    console.error("Game insights error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
