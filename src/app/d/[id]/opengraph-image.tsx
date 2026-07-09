import { ImageResponse } from "next/og";
import { getPublicDeck } from "@/lib/publicDeck";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Shared MTG deck";

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await getPublicDeck(id);

  const name = deck?.name ?? "Deck not found";
  const count = deck ? deck.cards.reduce((s, c) => s + c.quantity, 0) : 0;
  const format = deck?.format ? deck.format.charAt(0).toUpperCase() + deck.format.slice(1) : null;
  const cover = deck?.coverImageUri ?? null;

  let coverSrc: string | null = null;
  if (cover) {
    try {
      const res = await fetch(cover, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const type = res.headers.get("content-type") ?? "image/jpeg";
        coverSrc = `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
      }
    } catch {
      // Dead/slow cover — render the text-only card.
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#0B0E14",
          position: "relative",
        }}
      >
        {coverSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverSrc}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.35,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "linear-gradient(to top, #0B0E14 10%, rgba(11,14,20,0.6) 50%, rgba(11,14,20,0.3) 100%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 64,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", color: "#ED9A57", fontSize: 28, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            MTG Houdini
          </div>
          <div
            style={{
              display: "flex",
              color: "#E8EAF0",
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.1,
              marginTop: 8,
              maxWidth: 1000,
            }}
          >
            {name.length > 40 ? name.slice(0, 40) + "…" : name}
          </div>
          {deck && (
            <div style={{ display: "flex", color: "#8B90A0", fontSize: 32, marginTop: 12 }}>
              {format ? `${format} · ` : ""}{count} cards
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=300",
      },
    }
  );
}
