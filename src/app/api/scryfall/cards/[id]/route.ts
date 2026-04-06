import { NextRequest } from "next/server";
import { getCard } from "@/lib/scryfall/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const card = await getCard(id);
    return Response.json(card);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Card fetch failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
