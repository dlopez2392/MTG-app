"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { MTG_PLAYER_COLORS } from "@/lib/constants";
import type { Player } from "@/types/life";

function hexToMtgQuery(hex: string): string {
  return MTG_PLAYER_COLORS.find((c) => c.color === hex)?.mtgQuery ?? "r";
}

const CMDR_KEY = "__cmdr__";

interface PlayerPanelProps {
  player: Player;
  onLifeChange: (delta: number) => void;
  onCommanderDamage: (delta: number) => void;
  isRotated?: boolean;
  className?: string;
}

export default function PlayerPanel({
  player,
  onLifeChange,
  onCommanderDamage,
  isRotated = false,
  className,
}: PlayerPanelProps) {
  const [artUrl, setArtUrl] = useState<string | null>(null);

  useEffect(() => {
    const mtgColor = hexToMtgQuery(player.color);
    fetch(
      `https://api.scryfall.com/cards/random?q=type%3Alegendary+color%3A${mtgColor}`
    )
      .then((r) => r.json())
      .then((card) => {
        const url =
          card?.image_uris?.art_crop ??
          card?.card_faces?.[0]?.image_uris?.art_crop ??
          null;
        setArtUrl(url);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id]);

  const cmdrDmg = player.commanderDamage[CMDR_KEY] ?? 0;
  const cmdrDangerous = cmdrDmg >= 21;

  return (
    <div
      className={cn(
        "relative flex flex-col select-none overflow-hidden rounded-xl",
        isRotated && "rotate-180",
        className
      )}
      style={{ backgroundColor: `${player.color}18` }}
    >
      {/* Card art background */}
      {artUrl && (
        <img
          src={artUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ opacity: 0.50, filter: "saturate(1.4) brightness(0.75)" }}
        />
      )}

      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 20%, ${player.color}28 100%)`,
        }}
      />

      {/* ── Top: player name ── */}
      <div className="relative z-10 flex items-center justify-center gap-2 pt-2 pb-0.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.color }} />
        <span className="text-xs font-medium text-text-secondary">{player.name}</span>
      </div>

      {/* ── Middle: life total ── */}
      <div className="relative z-10 flex items-center justify-between flex-1 px-1 min-h-0">
        <button
          onClick={() => onLifeChange(-1)}
          className="flex items-center justify-center w-14 h-full text-3xl font-bold text-text-muted hover:text-text-primary active:text-banned transition-colors"
          aria-label="Decrease life"
        >
          −
        </button>
        <span
          className="text-6xl font-black tabular-nums drop-shadow-lg leading-none"
          style={{ color: player.color }}
        >
          {player.life}
        </span>
        <button
          onClick={() => onLifeChange(1)}
          className="flex items-center justify-center w-14 h-full text-3xl font-bold text-text-muted hover:text-text-primary active:text-legal transition-colors"
          aria-label="Increase life"
        >
          +
        </button>
      </div>

      {/* ── Bottom: commander damage ── */}
      <div className="relative z-10 flex items-center justify-center gap-1.5 pb-2">
        <button
          onClick={() => onCommanderDamage(-1)}
          disabled={cmdrDmg <= 0}
          className="w-6 h-6 flex items-center justify-center rounded bg-black/40 text-sm text-white/60 hover:text-white disabled:opacity-30 leading-none"
        >−</button>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4 text-white/70 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 17h18v2H3v-2zM4 7l3.5 7 4.5-5 4.5 5L20 7v8H4V7z" />
          </svg>
          <span className={cn("text-base font-bold tabular-nums leading-none", cmdrDangerous ? "text-banned" : "text-white/90")}>
            {cmdrDmg}
          </span>
        </div>
        <button
          onClick={() => onCommanderDamage(1)}
          className="w-6 h-6 flex items-center justify-center rounded bg-black/40 text-sm text-white/60 hover:text-white leading-none"
        >+</button>
      </div>
    </div>
  );
}
