import { NextRequest } from "next/server";
import { getRulings } from "@/lib/scryfall/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rulings = await getRulings(id);
    return Response.json({ data: rulings });
  } catch {
    return Response.json({ data: [] });
  }
}
