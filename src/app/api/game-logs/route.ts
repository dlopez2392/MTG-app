import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

function toEntry(row: Record<string, unknown>) {
  return {
    id: row.id,
    date: row.date,
    deckId: row.deck_id ?? undefined,
    deckName: row.deck_name,
    result: row.result,
    format: row.format ?? undefined,
    playerCount: row.player_count,
    notes: row.notes ?? undefined,
    opponentNames: row.opponent_names ?? undefined,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("game_logs")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(toEntry));
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const sb = getSupabase();

  const { data, error } = await sb
    .from("game_logs")
    .insert({
      user_id: userId,
      date: body.date,
      deck_id: body.deckId ?? null,
      deck_name: body.deckName,
      result: body.result,
      format: body.format ?? null,
      player_count: body.playerCount,
      notes: body.notes ?? null,
      opponent_names: body.opponentNames ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toEntry(data));
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const sb = getSupabase();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.date !== undefined) updates.date = body.date;
  if (body.deckId !== undefined) updates.deck_id = body.deckId;
  if (body.deckName !== undefined) updates.deck_name = body.deckName;
  if (body.result !== undefined) updates.result = body.result;
  if (body.format !== undefined) updates.format = body.format;
  if (body.playerCount !== undefined) updates.player_count = body.playerCount;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.opponentNames !== undefined) updates.opponent_names = body.opponentNames;

  const { data, error } = await sb
    .from("game_logs")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toEntry(data));
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const sb = getSupabase();
  const { error } = await sb
    .from("game_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
