import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await params;
  const { quantity } = await req.json();
  const sb = getSupabase();

  if (quantity <= 0) {
    await sb.from("collection_cards").delete().eq("id", cardId).eq("user_id", userId);
  } else {
    await sb.from("collection_cards").update({ quantity }).eq("id", cardId).eq("user_id", userId);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await params;
  const sb = getSupabase();

  await sb.from("collection_cards").delete().eq("id", cardId).eq("user_id", userId);
  return NextResponse.json({ success: true });
}
