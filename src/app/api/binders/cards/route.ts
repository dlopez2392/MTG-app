import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

// GET all collection cards across all binders for the current user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("collection_cards")
    .select("*")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    data.map((row) => ({
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
    }))
  );
}
