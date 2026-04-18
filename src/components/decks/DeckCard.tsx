"use client";

import { useState } from "react";
import type { Deck, MTGColor } from "@/types/deck";
import ManaSymbol from "@/components/cards/ManaSymbol";

interface DeckCardProps {
  deck: Deck;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const COLOR_GLOW: Record<MTGColor, string> = {
  W: "rgba(248, 240, 195, 0.75)",
  U: "rgba(30, 111, 168, 0.75)",
  B: "rgba(130, 80, 200, 0.75)",
  R: "rgba(200, 50, 50, 0.75)",
  G: "rgba(30, 130, 70, 0.75)",
  multi: "rgba(210, 165, 40, 0.75)",
  colorless: "rgba(140, 140, 160, 0.5)",
};

function toArtCrop(uri: string): string {
  return uri
    .replace("/normal/", "/art_crop/")
    .replace("/small/", "/art_crop/")
    .replace("/large/", "/art_crop/")
    .replace("/png/", "/art_crop/");
}

const COLOR_ORDER = ["W", "U", "B", "R", "G"] as const;

export default function DeckCard({ deck, onClick, onDelete }: DeckCardProps) {
  const [active, setActive] = useState(false);
  const color = (deck.dominantColor ?? "colorless") as MTGColor;
  const glow = COLOR_GLOW[color];

  const artSrc = deck.coverImageUri ? toArtCrop(deck.coverImageUri) : null;
  const deckColors = (deck.colors ?? []).filter((c) =>
    COLOR_ORDER.includes(c as (typeof COLOR_ORDER)[number])
  );

  return (
    <div
      className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-bg-card group"
      style={{
        boxShadow: active
          ? `0 0 20px 2px ${glow}, 0 4px 16px rgba(0,0,0,0.4)`
          : "0 2px 8px rgba(0,0,0,0.3)",
        transform: active ? "scale(1.03)" : "scale(1)",
        transition: "box-shadow 0.2s ease, transform 0.15s ease",
      }}
    >
      <button
        onClick={onClick}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onTouchStart={() => setActive(true)}
        onTouchEnd={() => setActive(false)}
        className="absolute inset-0 w-full h-full focus:outline-none"
      >
        {artSrc ? (
          <img
            src={artSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-bg-hover to-bg-card flex items-center justify-center">
            <svg className="w-12 h-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </div>
        )}

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-white font-bold text-sm uppercase tracking-wide truncate leading-tight">
              {deck.name}
            </p>
            {deck.format && (
              <p className="text-[10px] text-white/60 capitalize mt-0.5">{deck.format}</p>
            )}
          </div>

          {/* Mana symbols */}
          {deckColors.length > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              {deckColors.map((c) => (
                <ManaSymbol key={c} symbol={c} size={18} className="drop-shadow-sm" />
              ))}
            </div>
          )}
        </div>
      </button>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white/60 hover:text-red-400 hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
        title="Delete deck"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
