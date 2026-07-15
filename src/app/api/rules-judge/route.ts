import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getSupabase } from "@/lib/supabase/server";
import { buildDeckSummary, type DeckCardInput } from "@/lib/decks/summary";
import { analyzeQuestion } from "@/lib/rules/analyze";
import { generateRulingStream } from "@/lib/rules/answer";
import { getCachedRuling, setCachedRuling } from "@/lib/rules/cache";
import {
  vectorSearch,
  directRuleLookup,
  cardRulingsLookup,
  oracleCardLookup,
  buildInteractionQueries,
  deduplicateAndCap,
} from "@/lib/rules/retrieval";

interface RulesJudgeRequest {
  question: string;
  cards?: string[];
  deckId?: string;
  gameContext?: {
    format?: string;
    playerCount?: number;
    counters?: Record<string, number>;
  };
}

type Emit = (ev: Record<string, unknown>) => void;

/** Wrap an async producer into an NDJSON streaming Response. */
function ndjsonResponse(run: (emit: Emit) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = (ev) => controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      try {
        await run(emit);
      } catch (e) {
        emit({ type: "error", message: e instanceof Error ? e.message : "Stream error" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}

interface DeckCardRow {
  name: string;
  quantity: number | null;
  category: string | null;
  mana_cost: string | null;
  cmc: number | null;
  type_line: string | null;
  rarity: string | null;
  price_usd: string | null;
}

async function loadDeckSummary(userId: string, deckId: string): Promise<string | undefined> {
  const sb = getSupabase();
  const { data: deck } = await sb
    .from("decks")
    .select("name, format")
    .eq("id", deckId)
    .eq("user_id", userId)
    .single();
  if (!deck) return undefined;
  const { data: rows } = await sb
    .from("deck_cards")
    .select("name, quantity, category, mana_cost, cmc, type_line, rarity, price_usd")
    .eq("deck_id", deckId)
    .eq("user_id", userId);
  const cards: DeckCardInput[] = ((rows ?? []) as DeckCardRow[]).map((c) => ({
    name: c.name,
    quantity: c.quantity ?? 1,
    category: c.category ?? "main",
    manaCost: c.mana_cost ?? undefined,
    cmc: c.cmc ?? undefined,
    typeLine: c.type_line ?? undefined,
    rarity: c.rarity ?? undefined,
    priceUsd: c.price_usd ?? null,
  }));
  if (cards.length === 0) return undefined;
  return buildDeckSummary({ deckName: (deck as { name: string }).name, format: ((deck as { format: string | null }).format ?? "commander").toLowerCase(), cards });
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
    // Check cache first (deck context is part of the key)
    const requestedCards = body.cards ?? [];
    const cached = getCachedRuling(body.question, requestedCards, body.gameContext?.format, body.deckId);
    if (cached) {
      return ndjsonResponse(async (emit) => {
        emit({ type: "meta", citedRules: cached.citedRules, cardsAnalyzed: cached.cardsAnalyzed, model: cached.model });
        emit({ type: "confidence", value: cached.confidence });
        emit({ type: "token", text: cached.ruling });
        emit({ type: "done" });
      });
    }

    // Deck context (optional) — inject the chosen deck's decklist.
    const deckSummary = body.deckId ? await loadDeckSummary(userId, body.deckId) : undefined;

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

    // Step 2: Two-hop retrieval
    // Hop 1: question + rule areas
    const searchQueries = [
      body.question,
      ...analysis.ruleAreas.slice(0, 3),
    ];

    // Hop 2: cross-card mechanic interaction queries
    const localCardMeta = localResults.map((r) => r.metadata);
    const interactionQueries = buildInteractionQueries(cardOracleTexts, localCardMeta);
    const allSearchQueries = [...searchQueries, ...interactionQueries];

    const [vectorResults, directResults, cardRulings] = await Promise.all([
      vectorSearch(allSearchQueries, 25),
      directRuleLookup(analysis.specificRules),
      cardRulingsLookup(oracleIds),
    ]);

    const allChunks = deduplicateAndCap([
      ...directResults,
      ...vectorResults,
      ...cardRulings,
    ], 50);

    // Step 3: Stream the ruling. Sources + cards + model come from server-side
    // data we already have; the prose (and its leading Confidence line) stream.
    const sourceChunks = allChunks
      .filter((c) =>
        ["comprehensive_rules", "glossary", "scryfall_ruling", "tournament_rules", "infraction_procedure", "regular_rel"].includes(c.source)
      )
      .slice(0, 8)
      .map((c) => ({ number: c.sourceId, text: c.content.slice(0, 400) }));
    const model: "flash" | "pro" = analysis.complexity === "complex" ? "pro" : "flash";
    const questionText = body.question;
    const format = body.gameContext?.format;

    return ndjsonResponse(async (emit) => {
      emit({ type: "meta", citedRules: sourceChunks, cardsAnalyzed: cardOracleTexts, model });
      let full = "";
      let confidence: "high" | "medium" | "low" | null = null;
      for await (const part of generateRulingStream(questionText, allChunks, cardOracleTexts, analysis.complexity, format, deckSummary)) {
        if ("confidence" in part) {
          confidence = part.confidence;
          emit({ type: "confidence", value: confidence });
        } else {
          full += part.token;
          emit({ type: "token", text: part.token });
        }
      }
      setCachedRuling(
        questionText,
        requestedCards,
        format,
        { ruling: full, confidence: confidence ?? "low", citedRules: sourceChunks, cardsAnalyzed: cardOracleTexts, model },
        body.deckId
      );
      emit({ type: "done" });
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Rules judge analysis failed";
    console.error("Rules judge error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
