"use client";

import { useState } from "react";
import type { Deck, MTGColor } from "@/types/deck";
import Badge from "@/components/ui/Badge";

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

const COLOR_BORDER: Record<MTGColor, string> = {
  W: "#F0E8B0",
  U: "#2B7FC4",
  B: "#9B64D4",
  R: "#CC3030",
  G: "#28A050",
  multi: "#D4A820",
  colorless: "#6B6B80",
};

const COLOR_SHIMMER: Record<MTGColor, string> = {
  W: "linear-gradient(135deg, rgba(255,250,210,0.25) 0%, transparent 60%)",
  U: "linear-gradient(135deg, rgba(50,140,220,0.25) 0%, transparent 60%)",
  B: "linear-gradient(135deg, rgba(150,80,240,0.25) 0%, transparent 60%)",
  R: "linear-gradient(135deg, rgba(220,60,60,0.25) 0%, transparent 60%)",
  G: "linear-gradient(135deg, rgba(40,160,80,0.25) 0%, transparent 60%)",
  multi: "linear-gradient(135deg, rgba(220,175,40,0.25) 0%, transparent 60%)",
  colorless: "linear-gradient(135deg, rgba(160,160,180,0.15) 0%, transparent 60%)",
};

export default function DeckCard({ deck, onClick, onDelete }: DeckCardProps) {
  const [active, setActive] = useState(false);
  const color = (deck.dominantColor ?? "colorless") as MTGColor;
  const glow = COLOR_GLOW[color];
  const border = COLOR_BORDER[color];
  const shimmer = COLOR_SHIMMER[color];

  return (
    <div
      className="relative aspect-[3/4] rounded-xl overflow-hidden bg-bg-card group"
      style={{
        border: `1px solid ${active ? border : "rgba(255,255,255,0.08)"}`,
        boxShadow: active
          ? `0 0 24px 4px ${glow}, 0 0 8px 2px ${glow}`
          : `0 0 0px 0px transparent`,
        transform: active ? "scale(1.04)" : "scale(1)",
        transition: "box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease",
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
        {deck.coverImageUri ? (
          <img
            src={deck.coverImageUri}
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

        {/* Base dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Color shimmer overlay — appears on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: shimmer }}
        />

        {/* Colored bottom glow strip */}
        <div
          className="absolute bottom-0 left-0 right-0 h-16 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: `linear-gradient(to top, ${glow.replace("0.75", "0.35")}, transparent)` }}
        />

        <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
          <p className="font-display text-white font-bold text-sm uppercase tracking-wide truncate">{deck.name}</p>
          {deck.format && (
            <Badge className="mt-1 capitalize text-[10px]">{deck.format}</Badge>
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
