import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const [{ data: decks, error }, { data: cardColors }] = await Promise.all([
    sb.from("decks").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    sb.from("deck_cards").select("deck_id, mana_cost, quantity").eq("user_id", userId),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const colorMap = computeDeckColors(cardColors ?? []);
  return NextResponse.json(decks!.map((row) => {
    const info = colorMap[row.id];
    return toDecK(row, info?.dominant, info?.colors);
  }));
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const sb = getSupabase();
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from("decks")
    .insert({
      user_id: userId,
      name: body.name,
      format: body.format ?? null,
      cover_card_id: body.coverCardId ?? null,
      cover_image_uri: body.coverImageUri ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toDecK(data));
}

type ColorKey = "W" | "U" | "B" | "R" | "G";
type ColorCounts = Record<ColorKey, number>;

const COLOR_REGEXES: Record<ColorKey, RegExp> = {
  W: /\{W\}/g, U: /\{U\}/g, B: /\{B\}/g, R: /\{R\}/g, G: /\{G\}/g,
};

function computeDeckColors(
  cards: { deck_id: string; mana_cost: string | null; quantity: number }[]
): Record<string, { dominant: string; colors: string[] }> {
  const counts: Record<string, ColorCounts> = {};
  const colors: ColorKey[] = ["W", "U", "B", "R", "G"];

  for (const card of cards) {
    if (!card.mana_cost) continue;
    if (!counts[card.deck_id]) counts[card.deck_id] = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    const qty = card.quantity ?? 1;
    for (const c of colors) {
      COLOR_REGEXES[c].lastIndex = 0;
      counts[card.deck_id][c] += (card.mana_cost.match(COLOR_REGEXES[c]) ?? []).length * qty;
    }
  }

  const result: Record<string, { dominant: string; colors: string[] }> = {};
  for (const [deckId, c] of Object.entries(counts)) {
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    const active = colors.filter((k) => c[k] > 0);
    if (total === 0) { result[deckId] = { dominant: "colorless", colors: [] }; continue; }
    const dominant = active.length >= 3 ? "multi" : (active.sort((a, b) => c[b] - c[a])[0] ?? "colorless");
    result[deckId] = { dominant, colors: active };
  }
  return result;
}

function toDecK(row: Record<string, unknown>, dominantColor?: string, colors?: string[]) {
  return {
    id: row.id,
    name: row.name,
    format: row.format,
    coverCardId: row.cover_card_id,
    coverImageUri: row.cover_image_uri,
    dominantColor: dominantColor ?? "colorless",
    colors: colors ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
