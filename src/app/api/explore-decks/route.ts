import { NextResponse } from "next/server";

interface ExploreDeck {
  id: string;
  name: string;
  format: string;
  colors: string[];
  viewCount: number;
  cardCount: number;
  owner: string;
  featuredArt: string | null;
  source: string;
  sourceUrl: string;
  updatedAt: string;
}

interface ExploreResult {
  decks: ExploreDeck[];
  totalCount: number;
  hasMore: boolean;
  page: number;
}

// ── Archidekt ──

const ARCHIDEKT_API = "https://archidekt.com/api/decks/v3/";

interface ArchidektDeck {
  id: number;
  name: string;
  viewCount: number;
  colors: { W: number; U: number; B: number; R: number; G: number };
  featured?: string;
  customFeatured?: string;
  size: number;
  owner: { username: string };
  updatedAt: string;
}

const ARCHIDEKT_FORMAT_MAP: Record<string, number> = {
  commander: 3,
  standard: 1,
  modern: 4,
  pioneer: 14,
  pauper: 12,
  legacy: 5,
  vintage: 6,
};

async function fetchArchidekt(format: string, page: number, query: string): Promise<ExploreResult> {
  const formatId = ARCHIDEKT_FORMAT_MAP[format] ?? 3;
  const params = new URLSearchParams({
    pageSize: "20",
    page: String(page),
    orderBy: "-viewCount",
    formats: String(formatId),
  });
  if (query) params.set("name", query);

  const res = await fetch(`${ARCHIDEKT_API}?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "MTGHoudini/1.0" },
    next: { revalidate: 600 },
  });

  if (!res.ok) throw new Error(`Archidekt ${res.status}`);
  const data = await res.json();

  const decks: ExploreDeck[] = (data.results ?? []).map((d: ArchidektDeck) => {
    const colors: string[] = [];
    if (d.colors?.W > 0) colors.push("W");
    if (d.colors?.U > 0) colors.push("U");
    if (d.colors?.B > 0) colors.push("B");
    if (d.colors?.R > 0) colors.push("R");
    if (d.colors?.G > 0) colors.push("G");
    return {
      id: `archidekt-${d.id}`,
      name: d.name,
      format,
      colors,
      viewCount: d.viewCount,
      cardCount: d.size ?? 0,
      owner: d.owner?.username ?? "Unknown",
      featuredArt: d.customFeatured || d.featured || null,
      source: "archidekt",
      sourceUrl: `https://archidekt.com/decks/${d.id}`,
      updatedAt: d.updatedAt,
    };
  });

  return { decks, totalCount: data.count ?? decks.length, hasMore: !!data.next, page };
}

// ── EDHREC ──

interface EdhrecCommander {
  name: string;
  sanitized: string;
  num_decks: number;
  color_identity: string[];
  image?: string;
}

async function fetchEdhrec(page: number, query: string): Promise<ExploreResult> {
  const res = await fetch("https://json.edhrec.com/pages/commanders/year.json", {
    headers: {
      "User-Agent": "MTGHoudini/1.0",
      "Referer": "https://edhrec.com/",
    },
    next: { revalidate: 600 },
  });

  if (!res.ok) throw new Error(`EDHREC ${res.status}`);
  const data = await res.json();

  let commanders: EdhrecCommander[] = data.container?.json_dict?.cardlists?.[0]?.cardviews ?? [];

  if (query) {
    const q = query.toLowerCase();
    commanders = commanders.filter((c: EdhrecCommander) => c.name.toLowerCase().includes(q));
  }

  const pageSize = 20;
  const start = (page - 1) * pageSize;
  const sliced = commanders.slice(start, start + pageSize);

  const decks: ExploreDeck[] = sliced.map((c: EdhrecCommander) => {
    const colorMap: Record<string, string> = { W: "W", U: "U", B: "B", R: "R", G: "G" };
    const colors = (c.color_identity ?? []).map((ci: string) => colorMap[ci]).filter(Boolean);

    const scryfallImg = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(c.name)}&format=image&version=art_crop`;

    return {
      id: `edhrec-${c.sanitized}`,
      name: c.name,
      format: "commander",
      colors,
      viewCount: c.num_decks ?? 0,
      cardCount: 100,
      owner: "EDHREC Average",
      featuredArt: scryfallImg,
      source: "edhrec",
      sourceUrl: `https://edhrec.com/commanders/${c.sanitized}`,
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    decks,
    totalCount: commanders.length,
    hasMore: start + pageSize < commanders.length,
    page,
  };
}

// ── MTGTop8 ──

const MTGTOP8_FORMAT_MAP: Record<string, string> = {
  standard: "ST",
  modern: "MO",
  pioneer: "PI",
  legacy: "LE",
  vintage: "VI",
  pauper: "PAU",
  commander: "EDH",
};

interface Top8Deck {
  name: string;
  player: string;
  result: string;
  colors: string[];
  deckUrl: string;
  eventName: string;
}

async function fetchMtgTop8(format: string, page: number, query: string): Promise<ExploreResult> {
  const fmt = MTGTOP8_FORMAT_MAP[format] ?? "MO";
  const pageParam = page > 1 ? `&cp=${page}` : "";

  const url = `https://mtgtop8.com/format?f=${fmt}${pageParam}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "MTGHoudini/1.0" },
    next: { revalidate: 600 },
  });

  if (!res.ok) throw new Error(`MTGTop8 ${res.status}`);
  const html = await res.text();

  const decks: ExploreDeck[] = [];
  const archPattern = /href=archetype\?a=(\d+)&meta=(\d+)&f=([A-Z]+)>([^<]+)/g;
  let match;

  while ((match = archPattern.exec(html)) !== null && decks.length < 30) {
    const archetypeId = match[1];
    const deckName = match[4].trim();

    if (!deckName || deckName.length < 2) continue;
    if (deckName.startsWith("Other")) continue;
    if (query && !deckName.toLowerCase().includes(query.toLowerCase())) continue;

    const colorFlags: string[] = [];
    const nameLC = deckName.toLowerCase();
    if (nameLC.includes("boros") || nameLC.includes("selesnya") || nameLC.includes("naya") || nameLC.includes("white") || nameLC.includes("uw") || nameLC.includes("jeskai") || nameLC.includes("esper") || nameLC.includes("mardu") || nameLC.includes("abzan")) colorFlags.push("W");
    if (nameLC.includes("dimir") || nameLC.includes("uw") || nameLC.includes("jeskai") || nameLC.includes("esper") || nameLC.includes("grixis") || nameLC.includes("ur ") || nameLC.includes("blue") || nameLC.includes("simic") || nameLC.includes("merfolk")) colorFlags.push("U");
    if (nameLC.includes("dimir") || nameLC.includes("esper") || nameLC.includes("grixis") || nameLC.includes("rakdos") || nameLC.includes("abzan") || nameLC.includes("mardu") || nameLC.includes("black") || nameLC.includes("hollow")) colorFlags.push("B");
    if (nameLC.includes("boros") || nameLC.includes("ur ") || nameLC.includes("jeskai") || nameLC.includes("grixis") || nameLC.includes("rakdos") || nameLC.includes("naya") || nameLC.includes("mardu") || nameLC.includes("red") || nameLC.includes("burn")) colorFlags.push("R");
    if (nameLC.includes("selesnya") || nameLC.includes("simic") || nameLC.includes("naya") || nameLC.includes("abzan") || nameLC.includes("gruul") || nameLC.includes("green") || nameLC.includes("tron")) colorFlags.push("G");

    const afterMatch = match.index + match[0].length;
    const percentMatch = html.slice(afterMatch, afterMatch + 300).match(/class=S14>([\d.]+)\s*%</);
    const metaPercent = percentMatch ? parseFloat(percentMatch[1]) : 0;

    decks.push({
      id: `mtgtop8-${archetypeId}`,
      name: deckName,
      format,
      colors: [...new Set(colorFlags)],
      viewCount: metaPercent,
      cardCount: format === "commander" ? 100 : 60,
      owner: `${metaPercent}% meta`,
      featuredArt: null,
      source: "mtgtop8",
      sourceUrl: `https://mtgtop8.com/archetype?a=${archetypeId}&meta=${match[2]}&f=${match[3]}`,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    decks,
    totalCount: decks.length,
    hasMore: false,
    page,
  };
}

// ── Moxfield ──

const MOXFIELD_FORMAT_MAP: Record<string, string> = {
  commander: "commander",
  standard: "standard",
  modern: "modern",
  pioneer: "pioneer",
  pauper: "pauper",
  legacy: "legacy",
  vintage: "vintage",
};

interface MoxfieldDeckSummary {
  publicId: string;
  name: string;
  format: string;
  colors: string[];
  viewCount: number;
  mainboardCount: number;
  createdByUser: { userName: string };
  mainCardId?: string;
  publicUrl: string;
  lastUpdatedAtUtc: string;
}

async function fetchMoxfield(format: string, page: number, query: string): Promise<ExploreResult> {
  const fmt = MOXFIELD_FORMAT_MAP[format] ?? "commander";
  const pageSize = 20;

  const params = new URLSearchParams({
    pageNumber: String(page),
    pageSize: String(pageSize),
    sortType: "views",
    sortDirection: "descending",
    fmt,
  });
  if (query) params.set("q", query);

  const res = await fetch(`https://api2.moxfield.com/v2/decks/search?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "MTGHoudini/1.0" },
    next: { revalidate: 600 },
  });

  if (!res.ok) throw new Error(`Moxfield ${res.status}`);
  const data = await res.json();

  const decks: ExploreDeck[] = (data.data ?? []).map((d: MoxfieldDeckSummary) => {
    const colors = (d.colors ?? []).map((c: string) => c.toUpperCase());

    let featuredArt: string | null = null;
    if (d.mainCardId) {
      featuredArt = `https://api.scryfall.com/cards/${d.mainCardId}?format=image&version=art_crop`;
    }

    return {
      id: `moxfield-${d.publicId}`,
      name: d.name,
      format,
      colors,
      viewCount: d.viewCount ?? 0,
      cardCount: d.mainboardCount ?? 0,
      owner: d.createdByUser?.userName ?? "Unknown",
      featuredArt,
      source: "moxfield",
      sourceUrl: `https://www.moxfield.com/decks/${d.publicId}`,
      updatedAt: d.lastUpdatedAtUtc ?? new Date().toISOString(),
    };
  });

  const totalPages = data.totalPages ?? 1;

  return {
    decks,
    totalCount: data.totalResults ?? decks.length,
    hasMore: page < totalPages,
    page,
  };
}

// ── Cache ──

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000;

// ── Route ──

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "commander";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const query = searchParams.get("q") || "";
  const source = searchParams.get("source") || "archidekt";

  const cacheKey = `explore:${source}:${format}:${page}:${query}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return NextResponse.json(cached.data);
  }

  try {
    let result: ExploreResult;

    if (source === "edhrec") {
      result = await fetchEdhrec(page, query);
    } else if (source === "mtgtop8") {
      result = await fetchMtgTop8(format, page, query);
    } else if (source === "moxfield") {
      result = await fetchMoxfield(format, page, query);
    } else {
      result = await fetchArchidekt(format, page, query);
    }

    cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch explore decks" },
      { status: 502 }
    );
  }
}
