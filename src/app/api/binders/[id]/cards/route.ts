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

  if (!body.scryfallId || !body.name) {
    return NextResponse.json({ error: "scryfallId and name are required" }, { status: 400 });
  }

  const sb = getSupabase();

  // Check if card already exists in this binder
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

  // Try full insert first (with optional columns that may not exist yet)
  const fullRow = {
    binder_id: binderId,
    user_id: userId,
    scryfall_id: body.scryfallId,
    name: body.name,
    quantity: body.quantity ?? 1,
    foil: body.isFoil ?? false,
    condition: body.condition ?? "near_mint",
    set_code: body.setCode ?? null,
    set_name: body.setName ?? null,
    collector_number: body.collectorNumber ?? null,
    image_uri: body.imageUri ?? null,
    price_usd: body.priceUsd ?? null,
    type_line: body.typeLine ?? null,
    rarity: body.rarity ?? null,
  };

  let { data, error } = await sb
    .from("collection_cards")
    .insert(fullRow)
    .select()
    .single();

  // If optional columns don't exist in the schema yet, retry without them
  if (error && (error.message.includes("collector_number") || error.message.includes("type_line") || error.message.includes("rarity"))) {
    const { collector_number, type_line, rarity, ...coreRow } = fullRow;
    void collector_number; void type_line; void rarity;
    const retry = await sb.from("collection_cards").insert(coreRow).select().single();
    data = retry.data;
    error = retry.error;
  }

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
    collectorNumber: row.collector_number,
    imageUri: row.image_uri,
    priceUsd: row.price_usd,
    typeLine: row.type_line,
    rarity: row.rarity,
  };
}
