import { NextResponse } from "next/server";

const ARCHIDEKT_API = "https://archidekt.com/api/decks/v3/";

interface ArchidektDeck {
  id: number;
  name: string;
  game: number;
  viewCount: number;
  colors: { W: number; U: number; B: number; R: number; G: number };
  featured?: string;
  customFeatured?: string;
  size: number;
  owner: { username: string };
  createdAt: string;
  updatedAt: string;
}

interface ArchidektResponse {
  count: number;
  next: string | null;
  results: ArchidektDeck[];
}

const FORMAT_MAP: Record<string, number> = {
  commander: 3,
  standard: 1,
  modern: 4,
  pioneer: 14,
  pauper: 12,
  legacy: 5,
  vintage: 6,
};

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "commander";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const query = searchParams.get("q") || "";
  const pageSize = 20;

  const formatId = FORMAT_MAP[format] ?? 3;
  const cacheKey = `explore:${format}:${page}:${query}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return NextResponse.json(cached.data);
  }

  try {
    const params = new URLSearchParams({
      pageSize: String(pageSize),
      page: String(page),
      orderBy: "-viewCount",
      formats: String(formatId),
    });
    if (query) params.set("name", query);

    const res = await fetch(`${ARCHIDEKT_API}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MTGHoudini/1.0",
      },
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Archidekt API returned ${res.status}` },
        { status: 502 }
      );
    }

    const data: ArchidektResponse = await res.json();

    const decks = data.results.map((d) => {
      const colors: string[] = [];
      if (d.colors?.W > 0) colors.push("W");
      if (d.colors?.U > 0) colors.push("U");
      if (d.colors?.B > 0) colors.push("B");
      if (d.colors?.R > 0) colors.push("R");
      if (d.colors?.G > 0) colors.push("G");

      return {
        id: String(d.id),
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

    const result = {
      decks,
      totalCount: data.count,
      hasMore: !!data.next,
      page,
    };

    cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch explore decks" },
      { status: 502 }
    );
  }
}
