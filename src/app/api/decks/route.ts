import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("decks")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data.map(toDecK));
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
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

function toDecK(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    format: row.format,
    coverCardId: row.cover_card_id,
    coverImageUri: row.cover_image_uri,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
