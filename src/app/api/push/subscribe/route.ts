import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

interface SubBody {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: SubBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: "Incomplete subscription" }, { status: 400 });
  }

  const sb = getSupabase();
  const { error } = await sb
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth },
      { onConflict: "endpoint" }
    );
  if (error) return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: SubBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ error: "No endpoint" }, { status: 400 });

  const sb = getSupabase();
  await sb.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}
