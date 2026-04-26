import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId } = await params;
  const sb = getSupabase();

  const { data: member, error: memberErr } = await sb
    .from("playgroup_members")
    .select("friend_user_id")
    .eq("id", memberId)
    .eq("user_id", userId)
    .single();

  if (memberErr || !member?.friend_user_id) {
    return NextResponse.json({ error: "Member not found or not linked" }, { status: 404 });
  }

  const friendUserId = member.friend_user_id as string;

  const { data: decks, error } = await sb
    .from("decks")
    .select("id, name, format, cover_image_uri, updated_at")
    .eq("user_id", friendUserId)
    .eq("public", true)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const deckIds = (decks ?? []).map((d) => d.id);
  let cardCounts = new Map<string, number>();

  if (deckIds.length > 0) {
    const { data: counts } = await sb
      .from("deck_cards")
      .select("deck_id, quantity")
      .in("deck_id", deckIds)
      .eq("category", "main");

    for (const row of counts ?? []) {
      cardCounts.set(
        row.deck_id as string,
        (cardCounts.get(row.deck_id as string) ?? 0) + (row.quantity as number)
      );
    }
  }

  return NextResponse.json(
    (decks ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      format: d.format,
      coverImageUri: d.cover_image_uri,
      cardCount: cardCounts.get(d.id as string) ?? 0,
      updatedAt: d.updated_at,
    }))
  );
}
