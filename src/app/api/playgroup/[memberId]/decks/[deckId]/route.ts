import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ memberId: string; deckId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId, deckId } = await params;
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

  const { data: deck, error: deckErr } = await sb
    .from("decks")
    .select("id, name, format")
    .eq("id", deckId)
    .eq("user_id", friendUserId)
    .eq("public", true)
    .single();

  if (deckErr || !deck) {
    return NextResponse.json({ error: "Deck not found or not public" }, { status: 404 });
  }

  const { data: cards, error: cardsErr } = await sb
    .from("deck_cards")
    .select("name, quantity, category, type_line, mana_cost, cmc")
    .eq("deck_id", deckId);

  if (cardsErr) return NextResponse.json({ error: cardsErr.message }, { status: 500 });

  return NextResponse.json({
    id: deck.id,
    name: deck.name,
    format: deck.format,
    cards: (cards ?? []).map((c) => ({
      name: c.name as string,
      quantity: c.quantity as number,
      category: c.category as string,
      typeLine: c.type_line as string | null,
      manaCost: c.mana_cost as string | null,
      cmc: c.cmc as number | null,
    })),
  });
}
