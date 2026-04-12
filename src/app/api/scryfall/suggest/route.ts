import { NextRequest } from "next/server";
import { searchCards } from "@/lib/scryfall/client";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) return Response.json([]);

  try {
    // name:q does a prefix/contains match on card names
    const results = await searchCards(`name:${q}`, 1, "name", "auto", "cards");
    const suggestions = results.data.slice(0, 10).map((card) => ({
      id: card.id,
      name: card.name,
      imageUri:
        card.image_uris?.small ??
        card.card_faces?.[0]?.image_uris?.small ??
        null,
      manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
      typeLine: card.type_line ?? null,
    }));
    return Response.json(suggestions);
  } catch {
    return Response.json([]);
  }
}
