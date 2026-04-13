import { NextRequest } from "next/server";
import { FEEDS } from "@/lib/news/feeds";
import { parseRSS, type NewsItem } from "@/lib/news/rss";

// Revalidate cache every 30 minutes
export const revalidate = 1800;

export async function GET(req: NextRequest) {
  const feedParam = req.nextUrl.searchParams.get("feeds");
  const enabledKeys = feedParam ? new Set(feedParam.split(",")) : new Set(FEEDS.map((f) => f.key));

  const activeFeed = FEEDS.filter((f) => enabledKeys.has(f.key));

  const results = await Promise.allSettled(
    activeFeed.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "MTGHoudini/1.0 RSS Reader" },
        next: { revalidate: 1800 },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      return parseRSS(xml, feed.key, feed.name);
    })
  );

  const items: NewsItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    }
  }

  // Sort newest first
  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return Response.json({ items: items.slice(0, 100) });
}
