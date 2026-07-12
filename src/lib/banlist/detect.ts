import type { NewsItem } from "@/lib/news/rss";

// ── Ban-list detection (pure, no network) ────────────────────────────────────
// Conservative by design: a card is only reported as banned/restricted when its
// name exact-matches (case-insensitive) a card the user actually runs (passed in
// as `knownCards`). When an item is clearly a B&R announcement but no known card
// matches, we degrade to a per-format "review" event rather than risk a false
// "X is banned" claim.

export type BanlistStatus = "banned" | "restricted" | "unbanned" | "review";

export interface BanlistEvent {
  id: string; // stable hash of (sourceUrl | cardName | format)
  cardName: string; // "" for a "review" event
  format: string;
  status: BanlistStatus;
  announcedAt: string; // ISO
  sourceUrl: string;
  sourceTitle: string;
}

// Formats we recognize in B&R prose.
const FORMATS = [
  "Standard",
  "Alchemy",
  "Pioneer",
  "Explorer",
  "Modern",
  "Legacy",
  "Vintage",
  "Pauper",
  "Commander",
  "Historic",
  "Timeless",
  "Brawl",
  "Penny Dreadful",
  "Oathbreaker",
] as const;

/** Deterministic djb2 string hash → base36. Stable across runs (no randomness). */
function hashId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * True only for authoritative WotC B&R announcements. Title must read like a
 * banned/restricted announcement AND come from the wizards feed.
 */
export function isBanlistAnnouncement(item: NewsItem): boolean {
  if (item.feedKey !== "wizards") return false;
  const t = item.title.toLowerCase();
  const mentionsBR = /\bbanned\b|\brestricted\b|\bb&r\b|\bb & r\b/.test(t);
  const mentionsAnnouncement = /announcement|update|list|changes/.test(t);
  return mentionsBR && mentionsAnnouncement;
}

/** Which recognized formats are named anywhere in the given text. */
function formatsIn(text: string): string[] {
  const found: string[] = [];
  for (const f of FORMATS) {
    if (new RegExp(`\\b${f.replace(/ /g, "\\s+")}\\b`, "i").test(text)) {
      found.push(f);
    }
  }
  return found;
}

/**
 * Extract ban-list events from a WotC announcement, cross-referenced against the
 * cards the user runs. Only emits concrete card events for known cards; otherwise
 * emits one "review" event per format mentioned.
 *
 * @param item      the news item (assumed to have passed isBanlistAnnouncement)
 * @param knownCards set of LOWERCASED card names the user actually runs
 */
export function extractBanlistEvents(item: NewsItem, knownCards: Set<string>): BanlistEvent[] {
  const events: BanlistEvent[] = [];
  const seen = new Set<string>();
  const haystack = `${item.title} ${item.description}`;
  const formats = formatsIn(haystack);
  // Status is classified from the DESCRIPTION body only — the title routinely
  // contains the words "Banned and Restricted" which would otherwise poison a
  // raw character window around a card mention (e.g. misreading a ban as a
  // restriction).
  const bodyLower = item.description.toLowerCase();

  const push = (cardName: string, format: string, status: BanlistStatus) => {
    const id = hashId(`${item.url}|${cardName.toLowerCase()}|${format.toLowerCase()}`);
    if (seen.has(id)) return;
    seen.add(id);
    events.push({
      id,
      cardName,
      format,
      status,
      announcedAt: item.publishedAt,
      sourceUrl: item.url,
      sourceTitle: item.title,
    });
  };

  // 1. Concrete card hits: a known card name appears in the announcement text.
  //    Determine status from the wording near the card if possible; default
  //    "banned" (the dominant B&R action) but detect "restricted"/"unbanned".
  let matchedAnyCard = false;
  for (const card of knownCards) {
    if (!card) continue;
    const idxInBody = bodyLower.indexOf(card);
    if (idxInBody === -1) continue;
    matchedAnyCard = true;

    // Classify status from a window within the DESCRIPTION body only.
    const window = bodyLower.slice(Math.max(0, idxInBody - 40), idxInBody + card.length + 60);
    let status: BanlistStatus = "banned";
    if (/no longer banned|unbanned|now legal|removed from the banned/.test(window)) {
      status = "unbanned";
    } else if (/restricted/.test(window)) {
      status = "restricted";
    }

    // Attribute to each format mentioned (multi-format announcements list cards
    // per section); fall back to "Unknown" if none parsed.
    const targetFormats = formats.length > 0 ? formats : ["Unknown"];
    const original = item.description.slice(idxInBody, idxInBody + card.length);
    for (const f of targetFormats) {
      push(original, f, status);
    }
  }

  // 2. Fallback: it's a B&R announcement but no card the user runs was named.
  //    Emit a "review" nudge per format (or one generic if no format parsed).
  if (!matchedAnyCard) {
    const targetFormats = formats.length > 0 ? formats : ["your"];
    for (const f of targetFormats) {
      push("", f, "review");
    }
  }

  return events;
}
