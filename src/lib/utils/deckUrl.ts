export interface ParsedDeckUrl {
  source: "moxfield" | "archidekt";
  id: string;
}

/**
 * Extract source + deck id from a Moxfield or Archidekt deck URL.
 * Accepts with/without protocol and www. Returns null for anything else.
 *
 *   https://moxfield.com/decks/AbC12xYz            → { source: "moxfield",  id: "AbC12xYz" }
 *   https://archidekt.com/decks/1234567/my-deck    → { source: "archidekt", id: "1234567" }
 */
export function parseDeckUrl(input: string): ParsedDeckUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "moxfield.com" || host === "api2.moxfield.com") {
    const m = url.pathname.match(/^\/(?:decks|v2\/decks\/all)\/([A-Za-z0-9_-]+)(?:\/|$)/);
    if (m) return { source: "moxfield", id: m[1] };
    return null;
  }

  if (host === "archidekt.com") {
    const m = url.pathname.match(/^\/(?:api\/)?decks\/(\d+)(?:\/|$)/);
    if (m) return { source: "archidekt", id: m[1] };
    return null;
  }

  return null;
}
