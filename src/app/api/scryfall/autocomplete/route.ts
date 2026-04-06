import { NextRequest } from "next/server";
import { autocomplete } from "@/lib/scryfall/client";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) return Response.json({ data: [] });

  try {
    const suggestions = await autocomplete(q);
    return Response.json({ data: suggestions });
  } catch {
    return Response.json({ data: [] });
  }
}
