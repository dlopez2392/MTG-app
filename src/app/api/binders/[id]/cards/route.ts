import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sb = getSupabase();

  const { data, error } = await sb
    .from("collection_cards")
    .select("*")
    .eq("binder_id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data.map(toCollectionCard));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: binderId } = await params;
  const body = await req.json();
  const sb = getSupabase();

  // Check for existing card (same scryfall_id + foil status)
  const { data: existing } = await sb
    .from("collection_cards")
    .select("id, quantity")
    .eq("binder_id", binderId)
    .eq("scryfall_id", body.scryfallId)
    .eq("foil", body.isFoil ?? false)
    .eq("user_id", userId)
    .single();

  if (existing) {
    await sb
      .from("collection_cards")
      .update({ quantity: existing.quantity + (body.quantity ?? 1) })
      .eq("id", existing.id);
    await sb.from("binders").update({ updated_at: new Date().toISOString() }).eq("id", binderId);
    return NextResponse.json({ id: existing.id });
  }

  const { data, error } = await sb
    .from("collection_cards")
    .insert({
      binder_id: binderId,
      user_id: userId,
      scryfall_id: body.scryfallId,
      name: body.name,
      quantity: body.quantity ?? 1,
      foil: body.isFoil ?? false,
      condition: body.condition ?? "near_mint",
      set_code: body.setCode ?? null,
      set_name: body.setName ?? null,
      image_uri: body.imageUri ?? null,
      price_usd: body.priceUsd ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from("binders").update({ updated_at: new Date().toISOString() }).eq("id", binderId);

  return NextResponse.json(toCollectionCard(data));
}

function toCollectionCard(row: Record<string, unknown>) {
  return {
    id: row.id,
    binderId: row.binder_id,
    scryfallId: row.scryfall_id,
    name: row.name,
    quantity: row.quantity,
    isFoil: row.foil,
    condition: row.condition,
    setCode: row.set_code,
    setName: row.set_name,
    imageUri: row.image_uri,
    priceUsd: row.price_usd,
  };
}
