import webpush from "web-push";
import { getSupabase } from "@/lib/supabase/server";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a push notification to every subscription a user has. Best-effort:
 * never throws. Expired subscriptions (404/410) are pruned. Returns the number
 * of successful sends.
 */
export async function sendPush(userId: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0;

  const sb = getSupabase();
  const { data, error } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !data || data.length === 0) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(
    (data as SubRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Subscription is dead — remove it.
          await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        // Other errors: swallow (best-effort).
      }
    })
  );

  return sent;
}
