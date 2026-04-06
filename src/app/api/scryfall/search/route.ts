import { NextRequest } from "next/server";
import { searchCards } from "@/lib/scryfall/client";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q");
  if (!q) return Response.json({ object: "list", has_more: false, data: [] });

  try {
    const page = parseInt(sp.get("page") || "1", 10);
    const order = sp.get("order") || "name";
    const dir = sp.get("dir") || "auto";
    const unique = sp.get("unique") || "cards";
    const result = await searchCards(q, page, order, dir, unique);
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
