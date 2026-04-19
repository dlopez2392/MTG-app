import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.scryfall.com";

export async function GET(request: NextRequest) {
  const fuzzy = request.nextUrl.searchParams.get("fuzzy");
  const exact = request.nextUrl.searchParams.get("exact");

  if (!fuzzy && !exact) {
    return NextResponse.json({ error: "Missing fuzzy or exact parameter" }, { status: 400 });
  }

  const params = new URLSearchParams();
  if (fuzzy) params.set("fuzzy", fuzzy);
  if (exact) params.set("exact", exact);

  try {
    const res = await fetch(`${BASE_URL}/cards/named?${params}`, {
      headers: {
        "User-Agent": "MTGHoudini/1.0",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(body, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch card" }, { status: 500 });
  }
}
