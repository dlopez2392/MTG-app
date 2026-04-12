import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sb = getSupabase();

  const { data, error } = await sb
    .from("deck_cards")
    .select("*")
    .eq("deck_id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data.map(toCard));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: deckId } = await params;
  const body = await req.json();
  const sb = getSupabase();

  // Check for existing card in same category
  const { data: existing } = await sb
    .from("deck_cards")
    .select("id, quantity")
    .eq("deck_id", deckId)
    .eq("scryfall_id", body.scryfallId)
    .eq("category", body.category ?? "main")
    .eq("user_id", userId)
    .single();

  if (existing) {
    const { error } = await sb
      .from("deck_cards")
      .update({ quantity: existing.quantity + (body.quantity ?? 1) })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Update deck timestamp + cover if needed
    await sb.from("decks").update({ updated_at: new Date().toISOString() }).eq("id", deckId);
    return NextResponse.json({ id: existing.id });
  }

  const { data, error } = await sb
    .from("deck_cards")
    .insert({
      deck_id: deckId,
      user_id: userId,
      scryfall_id: body.scryfallId,
      name: body.name,
      quantity: body.quantity ?? 1,
      category: body.category ?? "main",
      mana_cost: body.manaCost ?? null,
      cmc: body.cmc ?? null,
      type_line: body.typeLine ?? null,
      rarity: body.rarity ?? null,
      image_uri: body.imageUri ?? null,
      price_usd: body.priceUsd ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update deck timestamp; set cover if first card
  const { data: deck } = await sb.from("decks").select("cover_image_uri").eq("id", deckId).single();
  const coverUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!deck?.cover_image_uri && body.imageUri) {
    coverUpdate.cover_image_uri = body.imageUri;
    coverUpdate.cover_card_id = body.scryfallId;
  }
  await sb.from("decks").update(coverUpdate).eq("id", deckId);

  return NextResponse.json(toCard(data));
}

function toCard(row: Record<string, unknown>) {
  return {
    id: row.id,
    deckId: row.deck_id,
    scryfallId: row.scryfall_id,
    name: row.name,
    quantity: row.quantity,
    category: row.category,
    manaCost: row.mana_cost,
    cmc: row.cmc,
    typeLine: row.type_line,
    rarity: row.rarity,
    imageUri: row.image_uri,
    priceUsd: row.price_usd,
  };
}
