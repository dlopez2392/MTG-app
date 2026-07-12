import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { FEEDS } from "@/lib/news/feeds";
import { parseRSS } from "@/lib/news/rss";
import {
  isBanlistAnnouncement,
  extractBanlistEvents,
  type BanlistEvent,
} from "@/lib/banlist/detect";

// Per-user, dynamic. The WotC feed itself is cached upstream (30 min).
export const dynamic = "force-dynamic";

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
  status: BanlistEvent["status"];
  sourceUrl: string;
  sourceTitle: string;
  announcedAt: string;
  seen: boolean;
  decks: { id: string; name: string }[];
}

function normalizeFormat(f: string | null | undefined): string {
  return (f ?? "").trim().toLowerCase();
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

  // Known card names (lowercased) the user runs, and name -> deckIds.
  const knownCards = new Set<string>();
  const cardNameToDecks = new Map<string, Set<string>>();
  for (const c of deckCards) {
    const key = c.name.toLowerCase();
    knownCards.add(key);
    let set = cardNameToDecks.get(key);
    if (!set) {
      set = new Set<string>();
      cardNameToDecks.set(key, set);
    }
    set.add(c.deck_id);
  }

  // 2. Fetch the WotC feed and detect B&R events (reuse the existing RSS layer).
  const wotc = FEEDS.find((f) => f.key === "wizards");
  if (!wotc) return NextResponse.json({ notifications: [] });

  let events: BanlistEvent[] = [];
  try {
    const res = await fetch(wotc.url, {
      headers: { "User-Agent": "MTGHoudini/1.0 RSS Reader" },
      next: { revalidate: 1800 },
    });
    if (res.ok) {
      const xml = await res.text();
      const items = parseRSS(xml, wotc.key, wotc.name);
      events = items
        .filter(isBanlistAnnouncement)
        .flatMap((item) => extractBanlistEvents(item, knownCards));
    }
  } catch {
    // Feed unreachable — return whatever notifications already exist (below).
  }

  // 3. Persist events, and build per-user notifications for events that hit a deck.
  if (events.length > 0) {
    const eventRows = events.map((e) => ({
      id: e.id,
      card_name: e.cardName,
      format: e.format,
      status: e.status,
      announced_at: e.announcedAt,
      source_url: e.sourceUrl,
      source_title: e.sourceTitle,
    }));
    await sb.from("banlist_events").upsert(eventRows, { onConflict: "id" });

    const notifRows: { user_id: string; event_id: string; deck_ids: string[] }[] = [];
    for (const e of events) {
      let affectedDeckIds: string[];
      if (e.status === "review") {
        // Review nudge: match decks whose format matches (skip if no format parsed).
        const fmt = normalizeFormat(e.format);
        affectedDeckIds =
          fmt && fmt !== "your"
            ? decks.filter((d) => normalizeFormat(d.format) === fmt).map((d) => d.id)
            : [];
      } else {
        // Concrete card event: decks that run the card. If the event names a
        // concrete format, prefer decks of that format; else all decks with the card.
        const runningDecks = cardNameToDecks.get(e.cardName.toLowerCase()) ?? new Set<string>();
        const fmt = normalizeFormat(e.format);
        affectedDeckIds = [...runningDecks].filter((id) => {
          if (!fmt || fmt === "unknown") return true;
          const d = deckById.get(id);
          const df = normalizeFormat(d?.format);
          return df === "" || df === fmt; // untagged decks still match on card
        });
      }
      if (affectedDeckIds.length > 0) {
        notifRows.push({ user_id: userId, event_id: e.id, deck_ids: affectedDeckIds });
      }
    }
    if (notifRows.length > 0) {
      await sb
        .from("banlist_notifications")
        .upsert(notifRows, { onConflict: "user_id,event_id", ignoreDuplicates: true });
    }
  }

  // 4. Return this user's notifications (joined to event details), newest first.
  const { data: notifs, error: notifErr } = await sb
    .from("banlist_notifications")
    .select("event_id, deck_ids, seen, banlist_events(card_name, format, status, source_url, source_title, announced_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (notifErr) {
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }

  const out: NotificationOut[] = [];
  for (const n of notifs ?? []) {
    // supabase types the embedded row as an object (or array); normalize.
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
