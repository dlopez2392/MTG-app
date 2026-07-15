import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { getDeepSeek } from "@/lib/deepseek/client";
import { rateLimit } from "@/lib/rateLimit";
import { formatBanListForPrompt } from "@/lib/data/bannedCards";
import { buildDeckSummary, type DeckCardInput } from "@/lib/decks/summary";

const SYSTEM_PROMPT = `You are an expert Magic: The Gathering writer creating a concise, high-signal DECK PRIMER for a deck's shareable page. Be specific and practical; reference real cards in the decklist.
Respond ONLY with valid JSON matching exactly:
{
  "tagline": "one punchy line describing the deck's archetype/hook",
  "gamePlan": "1-2 short paragraphs: the archetype, how it develops, and its primary win condition(s)",
  "keyCards": [{ "name": "exact card name from the decklist", "note": "one line on why it matters" }],
  "mulligan": "what makes a keepable opening hand; what to look for and what to ship",
  "keyLines": ["an important sequence, combo, or interaction tip", "..."]
}
Rules: 3-6 keyCards, 2-5 keyLines. Only reference cards present in the decklist. Never present a banned card as a staple. No markdown fences.`;

interface Body {
  deckId?: string;
}
interface DeckRow {
  name: string;
  format: string | null;
}
interface CardRow {
  name: string;
  quantity: number | null;
  category: string | null;
  mana_cost: string | null;
  cmc: number | null;
  type_line: string | null;
  rarity: string | null;
  price_usd: string | null;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { success } = rateLimit("ai:" + userId, 10, 60_000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "AI is not configured." }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.deckId) return NextResponse.json({ error: "Missing deckId" }, { status: 400 });

  const sb = getSupabase();
  const { data: deck, error: deckErr } = await sb
    .from("decks")
    .select("name, format")
    .eq("id", body.deckId)
    .eq("user_id", userId)
    .single();
  if (deckErr || !deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

  const { data: cardRows } = await sb
    .from("deck_cards")
    .select("name, quantity, category, mana_cost, cmc, type_line, rarity, price_usd")
    .eq("deck_id", body.deckId)
    .eq("user_id", userId);

  const cards: DeckCardInput[] = ((cardRows ?? []) as CardRow[]).map((c) => ({
    name: c.name,
    quantity: c.quantity ?? 1,
    category: c.category ?? "main",
    manaCost: c.mana_cost ?? undefined,
    cmc: c.cmc ?? undefined,
    typeLine: c.type_line ?? undefined,
    rarity: c.rarity ?? undefined,
    priceUsd: c.price_usd ?? null,
  }));
  if (cards.length === 0) return NextResponse.json({ error: "Deck has no cards" }, { status: 400 });

  const d = deck as DeckRow;
  const format = (d.format ?? "commander").toLowerCase();

  try {
    const summary = buildDeckSummary({ deckName: d.name, format, cards });
    const banList = formatBanListForPrompt(format);
    const result = await getDeepSeek().chat.completions.create({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${banList}\n\nWrite a primer for this deck:\n\n${summary}` },
      ],
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    });

    const text = result.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const primer = JSON.parse(cleaned);

    const generatedAt = new Date().toISOString();
    await sb
      .from("decks")
      .update({ primer, primer_generated_at: generatedAt })
      .eq("id", body.deckId)
      .eq("user_id", userId);

    return NextResponse.json({ primer, primerGeneratedAt: generatedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI primer failed";
    console.error("Deck primer error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
