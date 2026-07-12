import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

// Mark one (or all) of a user's ban-list notifications as seen.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { eventId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body = mark all seen
  }

  const sb = getSupabase();
  let q = sb.from("banlist_notifications").update({ seen: true }).eq("user_id", userId);
  if (body.eventId) q = q.eq("event_id", body.eventId);

  const { error } = await q;
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
