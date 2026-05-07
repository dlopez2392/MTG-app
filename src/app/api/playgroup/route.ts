import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

function toMember(row: Record<string, unknown>, profile?: Record<string, unknown> | null) {
  return {
    id: row.id,
    name: row.name,
    avatarColor: row.avatar_color,
    notes: row.notes ?? undefined,
    friendUserId: row.friend_user_id ?? undefined,
    friendAvatarUrl: profile?.avatar_url ?? undefined,
    isFriend: row.is_friend ?? false,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("playgroup_members")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const friendUserIds = (data ?? []).map((m) => m.friend_user_id).filter(Boolean);
  let profileMap = new Map<string, Record<string, unknown>>();

  if (friendUserIds.length > 0) {
    const { data: profiles } = await sb
      .from("user_profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", friendUserIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.user_id as string, p);
    }
  }

  return NextResponse.json(
    (data ?? []).map((row) => toMember(row, profileMap.get(row.friend_user_id) ?? null))
  );
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("playgroup_members")
    .insert({
      user_id: userId,
      name: body.name.trim(),
      avatar_color: body.avatarColor ?? "#607D8B",
      notes: body.notes?.trim() || null,
      friend_user_id: body.friendUserId || null,
      is_friend: body.isFriend ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let profile = null;
  if (data.friend_user_id) {
    const { data: p } = await sb
      .from("user_profiles")
      .select("user_id, display_name, avatar_url")
      .eq("user_id", data.friend_user_id)
      .maybeSingle();
    profile = p;
  }

  return NextResponse.json(toMember(data, profile));
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.avatarColor !== undefined) updates.avatar_color = body.avatarColor;
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
  if (body.friendUserId !== undefined) updates.friend_user_id = body.friendUserId || null;
  if (body.isFriend !== undefined) updates.is_friend = body.isFriend;

  const sb = getSupabase();
  const { data, error } = await sb
    .from("playgroup_members")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toMember(data));
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const sb = getSupabase();
  const { error } = await sb
    .from("playgroup_members")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
