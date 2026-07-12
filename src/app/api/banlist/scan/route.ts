import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push/send";
import { legalityTransition, type TransitionStatus } from "@/lib/banlist/legalityDiff";
import { loadLegalities } from "@/lib/banlist/legalitySnapshot";

// Per-user, dynamic. Card legalities are cached in card_legality_snapshot (24h TTL).
export const dynamic = "force-dynamic";

const CROSSREF_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

interface DeckRow {
  id: string;
  name: string;
  format: string | null;
}
interface DeckCardRow {
  scryfall_id: string;
  name: string;
  deck_id: string;
}
interface NotificationOut {
  eventId: string;
  cardName: string;
  format: string;
  status: TransitionStatus | "review";
  sourceUrl: string;
  sourceTitle: string;
  announcedAt: string;
  seen: boolean;
  decks: { id: string; name: string }[];
}

function normFormat(f: string | null | undefined): string {
  return (f ?? "").trim().toLowerCase();
}

/** Deterministic djb2 → base36. Stable across runs (no randomness). */
function hashId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = getSupabase();

  // 1. Load the user's decks + deck cards.
  const [decksRes, cardsRes] = await Promise.all([
    sb.from("decks").select("id, name, format").eq("user_id", userId),
    sb.from("deck_cards").select("scryfall_id, name, deck_id").eq("user_id", userId),
  ]);
  if (decksRes.error || cardsRes.error) {
    return NextResponse.json({ error: "Failed to load decks" }, { status: 500 });
  }
  const decks = (decksRes.data ?? []) as DeckRow[];
  const deckCards = (cardsRes.data ?? []) as DeckCardRow[];
  const deckById = new Map<string, DeckRow>();
  for (const d of decks) deckById.set(d.id, d);

  // 2. Watch set = deck cards whose deck has a recognized (non-empty) format.
  //    Untagged decks have no legality key to check against, so they are skipped.
  const watch = deckCards.filter((c) => {
    const d = deckById.get(c.deck_id);
    return !!c.scryfall_id && !!normFormat(d?.format);
  });

  // 3. Load prior + current legalities (refetch missing/stale from Scryfall).
  const ids = watch.map((c) => c.scryfall_id);
  const { prev, curr, toUpsert } = await loadLegalities(ids);

  // 4. Per-format diff → global banlist_events on ban/restrict/unban transitions.
  const nowIso = new Date().toISOString();
  const seenEvent = new Set<string>();
  // eventId → deckIds this user runs the card in (captured by exact scryfall_id
  // at detection, so double-faced/split cards whose stored name differs from
  // Scryfall's canonical name still attribute to the right deck).
  const freshEventDecks = new Map<string, Set<string>>();
  const eventRows: {
    id: string;
    card_name: string;
    format: string;
    status: TransitionStatus;
    announced_at: string;
    source_url: string;
    source_title: string;
  }[] = [];
  for (const c of watch) {
    const d = deckById.get(c.deck_id);
    const fmt = normFormat(d?.format);
    const p = prev.get(c.scryfall_id)?.[fmt];
    const q = curr.get(c.scryfall_id)?.legalities?.[fmt];
    const t = legalityTransition(p, q);
    if (!t) continue;
    const name = curr.get(c.scryfall_id)?.name ?? c.name;
    const id = hashId(`${c.scryfall_id}|${fmt}|${t}`);
    let decks = freshEventDecks.get(id);
    if (!decks) {
      decks = new Set<string>();
      freshEventDecks.set(id, decks);
    }
    decks.add(c.deck_id);
    if (seenEvent.has(id)) continue;
    seenEvent.add(id);
    eventRows.push({
      id,
      card_name: name,
      format: fmt,
      status: t,
      announced_at: nowIso,
      source_url: `https://scryfall.com/card/${c.scryfall_id}`,
      source_title: `${name} — ${fmt} legality changed`,
    });
  }
  if (eventRows.length > 0) {
    // ignoreDuplicates: an event id is hash(scryfall_id|fmt|status) with no time
    // component, so re-detecting the same transition must NOT overwrite the
    // original announced_at (which would keep it "fresh" forever and never age
    // out of the 90-day window).
    await sb.from("banlist_events").upsert(eventRows, { onConflict: "id", ignoreDuplicates: true });
  }

  // 5. Upsert snapshot (this is also the silent baseline for first sightings).
  if (toUpsert.length > 0) {
    await sb
      .from("card_legality_snapshot")
      .upsert(
        toUpsert.map((r) => ({ ...r, updated_at: nowIso })),
        { onConflict: "scryfall_id" }
      );
  }

  // 6. Cross-ref recent global events (last 90d) against THIS user's decks, so a
  //    ban detected during any user's scan fans out to every affected user.
  const since = new Date(Date.now() - CROSSREF_WINDOW_MS).toISOString();
  const { data: recentEvents } = await sb
    .from("banlist_events")
    .select("id, card_name, format")
    .gte("announced_at", since);
  if (recentEvents && recentEvents.length > 0) {
    // (card name lower | format) → deckIds running it
    const runIndex = new Map<string, Set<string>>();
    for (const c of deckCards) {
      const d = deckById.get(c.deck_id);
      const fmt = normFormat(d?.format);
      if (!fmt) continue;
      const key = `${c.name.toLowerCase()}|${fmt}`;
      let set = runIndex.get(key);
      if (!set) {
        set = new Set<string>();
        runIndex.set(key, set);
      }
      set.add(c.deck_id);
    }
    const notifRows: { user_id: string; event_id: string; deck_ids: string[] }[] = [];
    for (const ev of recentEvents as { id: string; card_name: string; format: string }[]) {
      // Prefer exact deck ids captured at detection (handles DFC/split name
      // mismatches); fall back to name-based matching for events detected by
      // other users' scans that this user is also affected by.
      const exact = freshEventDecks.get(ev.id);
      const byName = runIndex.get(`${ev.card_name.toLowerCase()}|${normFormat(ev.format)}`);
      const deckIds = new Set<string>([...(exact ?? []), ...(byName ?? [])]);
      if (deckIds.size > 0) {
        notifRows.push({ user_id: userId, event_id: ev.id, deck_ids: [...deckIds] });
      }
    }
    if (notifRows.length > 0) {
      await sb
        .from("banlist_notifications")
        .upsert(notifRows, { onConflict: "user_id,event_id", ignoreDuplicates: true });
    }
  }

  // 7. Fire push for any not-yet-pushed notifications (best-effort), mark pushed.
  const { data: unpushed } = await sb
    .from("banlist_notifications")
    .select("event_id, deck_ids, banlist_events(card_name, format, status)")
    .eq("user_id", userId)
    .eq("pushed", false);
  if (unpushed && unpushed.length > 0) {
    const pushedIds: string[] = [];
    for (const n of unpushed) {
      const ev = Array.isArray(n.banlist_events) ? n.banlist_events[0] : n.banlist_events;
      if (!ev) continue;
      const deckCount = (n.deck_ids ?? []).length;
      const verb = ev.status === "unbanned" ? "unbanned" : ev.status;
      const title = `${ev.card_name} ${verb}${ev.format ? ` in ${ev.format}` : ""}`;
      const body = `${deckCount} deck${deckCount !== 1 ? "s" : ""} affected`;
      await sendPush(userId, { title, body, url: "/", tag: n.event_id });
      pushedIds.push(n.event_id);
    }
    if (pushedIds.length > 0) {
      await sb
        .from("banlist_notifications")
        .update({ pushed: true })
        .eq("user_id", userId)
        .in("event_id", pushedIds);
    }
  }

  // 8. Return this user's notifications (joined to event details), newest first.
  const { data: notifs, error: notifErr } = await sb
    .from("banlist_notifications")
    .select(
      "event_id, deck_ids, seen, banlist_events(card_name, format, status, source_url, source_title, announced_at)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (notifErr) {
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }

  const out: NotificationOut[] = [];
  for (const n of notifs ?? []) {
    const ev = Array.isArray(n.banlist_events) ? n.banlist_events[0] : n.banlist_events;
    if (!ev) continue;
    const deckIds: string[] = n.deck_ids ?? [];
    out.push({
      eventId: n.event_id,
      cardName: ev.card_name,
      format: ev.format,
      status: ev.status,
      sourceUrl: ev.source_url,
      sourceTitle: ev.source_title,
      announcedAt: ev.announced_at,
      seen: n.seen,
      decks: deckIds
        .map((id) => deckById.get(id))
        .filter((d): d is DeckRow => !!d)
        .map((d) => ({ id: d.id, name: d.name })),
    });
  }

  return NextResponse.json({ notifications: out });
}
