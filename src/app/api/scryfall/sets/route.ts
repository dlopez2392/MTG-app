import { getSets } from "@/lib/scryfall/client";

export async function GET() {
  try {
    const sets = await getSets();
    return Response.json({ data: sets });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sets fetch failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
