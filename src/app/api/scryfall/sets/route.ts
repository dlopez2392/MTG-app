import { getSets } from "@/lib/scryfall/client";

export async function GET() {
  try {
    const sets = await getSets();
    return Response.json(
      { data: sets },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sets fetch failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
