import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return new Response("Missing url param", { status: 400 });
  }

  // Only allow Scryfall image domains
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (!parsed.hostname.endsWith("scryfall.io")) {
    return new Response("Only scryfall.io images are allowed", { status: 403 });
  }

  const upstream = await fetch(url, { cache: "force-cache" });

  if (!upstream.ok) {
    return new Response("Failed to fetch image", { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const buffer = await upstream.arrayBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
