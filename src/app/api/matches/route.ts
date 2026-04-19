import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import type { CreateMatchPayload } from "@/types/match";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data: matches, error } = await sb
    .from("matches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const matchIds = (matches ?? []).map((m) => m.id);
  if (matchIds.length === 0) return NextResponse.json([]);

  const { data: players, error: pErr } = await sb
    .from("match_players")
    .select("*")
    .in("match_id", matchIds)
    .order("player_order", { ascending: true });

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const playersByMatch = new Map<number, typeof players>();
  for (const p of players ?? []) {
    const list = playersByMatch.get(p.match_id) ?? [];
    list.push(p);
    playersByMatch.set(p.match_id, list);
  }

  return NextResponse.json(
    (matches ?? []).map((m) => toMatch(m, playersByMatch.get(m.id) ?? []))
  );
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: CreateMatchPayload = await req.json();
  const sb = getSupabase();

  const { data: match, error } = await sb
    .from("matches")
    .insert({
      user_id: userId,
      started_at: body.startedAt,
      ended_at: body.endedAt,
      duration_secs: body.durationSecs,
      starting_life: body.startingLife,
      player_count: body.playerCount,
      format: body.format ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const playerRows = body.players.map((p, i) => ({
    match_id: match.id,
    player_name: p.playerName,
    color: p.color,
    starting_life: p.startingLife,
    final_life: p.finalLife,
    poison_total: p.poisonTotal,
    commander_dmg: p.commanderDmg,
    is_winner: p.isWinner,
    player_order: p.playerOrder ?? i,
  }));

  const { error: pErr } = await sb.from("match_players").insert(playerRows);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { data: insertedPlayers } = await sb
    .from("match_players")
    .select("*")
    .eq("match_id", match.id)
    .order("player_order", { ascending: true });

  return NextResponse.json(toMatch(match, insertedPlayers ?? []));
}

function toMatch(row: Record<string, unknown>, playerRows: Record<string, unknown>[]) {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSecs: row.duration_secs,
    startingLife: row.starting_life,
    playerCount: row.player_count,
    format: row.format,
    notes: row.notes,
    createdAt: row.created_at,
    players: playerRows.map((p) => ({
      id: p.id,
      playerName: p.player_name,
      color: p.color,
      startingLife: p.starting_life,
      finalLife: p.final_life,
      poisonTotal: p.poison_total,
      commanderDmg: p.commander_dmg,
      isWinner: p.is_winner,
      playerOrder: p.player_order,
    })),
  };
}
