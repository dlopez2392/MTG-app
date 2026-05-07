import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const friendCode = req.nextUrl.searchParams.get("friendCode")?.trim().toUpperCase();

  if (!email && !friendCode) return NextResponse.json({ error: "Email or friend code required" }, { status: 400 });

  const sb = getSupabase();

  let query = sb
    .from("user_profiles")
    .select("user_id, display_name, avatar_url")
    .neq("user_id", userId);

  if (friendCode) {
    query = query.eq("friend_code", friendCode);
  } else {
    query = query.eq("discoverable", true).ilike("email", email!);
  }

  const { data, error } = await query.maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ found: false });

  return NextResponse.json({
    found: true,
    user: {
      userId: data.user_id,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
    },
  });
}
