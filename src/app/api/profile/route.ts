import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

function toProfile(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    discoverable: row.discoverable,
    friendCode: row.friend_code ?? null,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data) return NextResponse.json(toProfile(data));

  const user = await currentUser();
  const displayName = user?.fullName || user?.username || "Player";
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const avatarUrl = user?.imageUrl ?? null;

  const { data: created, error: createErr } = await sb
    .from("user_profiles")
    .insert({
      user_id: userId,
      display_name: displayName,
      email,
      avatar_url: avatarUrl,
      discoverable: false,
    })
    .select()
    .single();

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
  return NextResponse.json(toProfile(created));
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.displayName !== undefined) updates.display_name = body.displayName;
  if (body.discoverable !== undefined) updates.discoverable = body.discoverable;

  const sb = getSupabase();
  const { data, error } = await sb
    .from("user_profiles")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toProfile(data));
}
