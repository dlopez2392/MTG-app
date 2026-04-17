import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.JUSTTCG_API_KEY;

export async function GET(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ configured: false });
  }

  const sp = request.nextUrl.searchParams;
  const name = sp.get("name");

  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.justtcg.com/v1/products?name=${encodeURIComponent(name)}&game=mtg&limit=10`,
      {
        headers: { "X-API-Key": API_KEY },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ configured: true, error: "JustTCG error" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ configured: true, data });
  } catch {
    return NextResponse.json({ error: "Failed to fetch JustTCG data" }, { status: 500 });
  }
}
