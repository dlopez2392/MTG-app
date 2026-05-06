import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { analyzeQuestion } from "@/lib/rules/analyze";
import { generateRuling } from "@/lib/rules/answer";
import { getCachedRuling, setCachedRuling } from "@/lib/rules/cache";
import {
  vectorSearch,
  directRuleLookup,
  cardRulingsLookup,
  oracleCardLookup,
  deduplicateAndCap,
} from "@/lib/rules/retrieval";

interface RulesJudgeRequest {
  question: string;
  cards?: string[];
  gameContext?: {
    format?: string;
    playerCount?: number;
    counters?: Record<string, number>;
  };
}

async function fetchCardOracle(
  cardName: string
): Promise<{ name: string; oracleText: string; oracleId?: string } | null> {
  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`
    );
    if (!res.ok) return null;
    const card = await res.json();
    return {
      name: card.name,
      oracleText: card.oracle_text ?? "",
      oracleId: card.oracle_id,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit(`ai:${userId}`, 10, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429 }
    );
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "AI rules judge not configured." },
      { status: 503 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI rules judge not configured." },
      { status: 503 }
    );
  }

  let body: RulesJudgeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.question || body.question.length < 3) {
    return NextResponse.json(
      { error: "Question must be at least 3 characters" },
      { status: 400 }
    );
  }

  if (body.question.length > 2000) {
    return NextResponse.json(
      { error: "Question must be under 2000 characters" },
      { status: 400 }
    );
  }

  if (body.cards && body.cards.length > 5) {
    return NextResponse.json(
      { error: "Maximum 5 cards allowed" },
      { status: 400 }
    );
  }

  try {
    // Check cache first
    const requestedCards = body.cards ?? [];
    const cached = getCachedRuling(body.question, requestedCards, body.gameContext?.format);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch oracle text — local DB first, Scryfall API fallback
    const localResults = await oracleCardLookup(requestedCards);
    const cardOracleTexts: { name: string; oracleText: string }[] = [];
    const oracleIds: string[] = [];

    // Use local data where available
    const resolvedNames = new Set<string>();
    for (const local of localResults) {
      cardOracleTexts.push({ name: local.name, oracleText: local.oracleText });
      if (local.oracleId) oracleIds.push(local.oracleId);
      resolvedNames.add(local.name.toLowerCase());
    }

    // Fall back to Scryfall for cards not in local DB
    const missingCards = requestedCards.filter(
      (name) => !resolvedNames.has(name.toLowerCase())
    );
    if (missingCards.length > 0) {
      const fallbackResults = await Promise.all(
        missingCards.map((name) => fetchCardOracle(name))
      );
      for (const c of fallbackResults) {
        if (c) {
          cardOracleTexts.push({ name: c.name, oracleText: c.oracleText });
          if (c.oracleId) oracleIds.push(c.oracleId);
          resolvedNames.add(c.name.toLowerCase());
        }
      }
    }

    // Step 1: Analyze question
    const analysis = await analyzeQuestion(body.question, cardOracleTexts);

    // Fetch oracle text for additional cards found in analysis
    const additionalCardNames = analysis.cardsReferenced.filter(
      (name) => !resolvedNames.has(name.toLowerCase())
    );
    if (additionalCardNames.length > 0) {
      const additionalLocal = await oracleCardLookup(additionalCardNames.slice(0, 5));
      for (const c of additionalLocal) {
        cardOracleTexts.push({ name: c.name, oracleText: c.oracleText });
        if (c.oracleId) oracleIds.push(c.oracleId);
        resolvedNames.add(c.name.toLowerCase());
      }

      // Scryfall fallback for any still missing
      const stillMissing = additionalCardNames.filter(
        (name) => !resolvedNames.has(name.toLowerCase())
      );
      if (stillMissing.length > 0) {
        const fallbackResults = await Promise.all(
          stillMissing.slice(0, 5).map((name) => fetchCardOracle(name))
        );
        for (const c of fallbackResults) {
          if (c) {
            cardOracleTexts.push({ name: c.name, oracleText: c.oracleText });
            if (c.oracleId) oracleIds.push(c.oracleId);
          }
        }
      }
    }

    // Step 2: Parallel retrieval — include tournament docs for procedure questions
    const searchQueries = [
      body.question,
      ...analysis.ruleAreas.slice(0, 3),
    ];

    const [vectorResults, directResults, cardRulings] = await Promise.all([
      vectorSearch(searchQueries, 25),
      directRuleLookup(analysis.specificRules),
      cardRulingsLookup(oracleIds),
    ]);

    const allChunks = deduplicateAndCap([
      ...directResults,
      ...vectorResults,
      ...cardRulings,
    ], 50);

    // Step 3: Generate ruling
    const ruling = await generateRuling(
      body.question,
      allChunks,
      cardOracleTexts,
      analysis.complexity,
      body.gameContext?.format
    );

    setCachedRuling(body.question, requestedCards, body.gameContext?.format, ruling);
    return NextResponse.json(ruling);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Rules judge analysis failed";
    console.error("Rules judge error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
