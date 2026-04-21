import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

function toTrade(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    offering: row.offering ?? [],
    receiving: row.receiving ?? [],
    offeringTotal: Number(row.offering_total ?? 0),
    receivingTotal: Number(row.receiving_total ?? 0),
    notes: row.notes ?? undefined,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(toTrade));
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const sb = getSupabase();

  const { data, error } = await sb
    .from("trades")
    .insert({
      user_id: userId,
      name: body.name ?? "Untitled Trade",
      date: body.date ?? new Date().toISOString(),
      offering: body.offering ?? [],
      receiving: body.receiving ?? [],
      offering_total: body.offeringTotal ?? 0,
      receiving_total: body.receivingTotal ?? 0,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toTrade(data));
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const sb = getSupabase();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.date !== undefined) updates.date = body.date;
  if (body.offering !== undefined) updates.offering = body.offering;
  if (body.receiving !== undefined) updates.receiving = body.receiving;
  if (body.offeringTotal !== undefined) updates.offering_total = body.offeringTotal;
  if (body.receivingTotal !== undefined) updates.receiving_total = body.receivingTotal;
  if (body.notes !== undefined) updates.notes = body.notes;

  const { data, error } = await sb
    .from("trades")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toTrade(data));
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const sb = getSupabase();
  const { error } = await sb
    .from("trades")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
