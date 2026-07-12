// Web Push subscription helpers (client-side).
// Full VAPID subscribe flow lands in Task 4; signatures are stable so the
// dashboard alert can call them now.

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

/** base64url VAPID public key → ArrayBuffer for applicationServerKey. */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

/**
 * Request notification permission, subscribe via PushManager, and persist the
 * subscription server-side. Returns true on success. Must be called from a user
 * gesture. On iOS only works inside an installed PWA.
 */
export async function askAndSubscribe(): Promise<boolean> {
  if (!pushSupported()) return false;

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(vapid),
      }));

    const json = sub.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
