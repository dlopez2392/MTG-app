"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import type { MultiplayerPlayerState } from "@/hooks/useMultiplayerRoom";

interface OpponentBarProps {
  players: MultiplayerPlayerState[];
  className?: string;
}

export default function OpponentBar({ players, className }: OpponentBarProps) {
  const [expanded, setExpanded] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 50) setExpanded(false);
    touchStartY.current = null;
  }, []);

  if (players.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-30 bg-black/90 backdrop-blur-sm border-t border-white/10 transition-all duration-200 ease-out",
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 overflow-x-auto"
      >
        {players.map((p) => (
          <div
            key={p.playerId}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex-shrink-0"
          >
            <div className="relative w-3 h-3 flex-shrink-0">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-black/80" />
            </div>
            <span className="text-xs font-semibold text-white/70 max-w-[60px] truncate">
              {p.name}
            </span>
            <span className="text-sm font-bold text-white tabular-nums">
              {p.life}
            </span>
            {p.poisonCounters > 0 && (
              <span className="text-xs font-bold text-green-400 tabular-nums">
                {p.poisonCounters}☠
              </span>
            )}
          </div>
        ))}
        <div className="ml-auto pl-2 flex-shrink-0">
          <svg
            className={cn("w-4 h-4 text-white/40 transition-transform duration-200", expanded && "rotate-180")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </button>

      <div
        className={cn(
          "grid gap-2 px-3 overflow-hidden transition-all duration-200 ease-out",
          expanded ? "max-h-[60vh] py-3 opacity-100" : "max-h-0 py-0 opacity-0",
          players.length === 1 ? "grid-cols-1 max-w-[200px] mx-auto" : "grid-cols-2"
        )}
      >
        {players.map((p) => (
          <PlayerCard key={p.playerId} player={p} />
        ))}
      </div>
    </div>
  );
}

function PlayerCard({ player: p }: { player: MultiplayerPlayerState }) {
  const commanderDamageEntries = Object.entries(p.commanderDamage).filter(
    ([, dmg]) => dmg > 0
  );

  return (
    <div
      className="rounded-xl p-3 border"
      style={{
        backgroundColor: `${p.color}15`,
        borderColor: `${p.color}40`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="relative w-3 h-3 flex-shrink-0">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-black/80" />
        </div>
        <span className="text-sm font-bold text-white truncate">{p.name}</span>
        <span className="ml-auto text-lg font-bold text-white tabular-nums">{p.life}</span>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60">
        {p.poisonCounters > 0 && (
          <span className="text-green-400">☠ {p.poisonCounters}</span>
        )}
        {p.energyCounters > 0 && (
          <span className="text-yellow-400">⚡ {p.energyCounters}</span>
        )}
        {p.experienceCounters > 0 && (
          <span className="text-blue-400">✨ {p.experienceCounters}</span>
        )}
        {p.isMonarch && <span className="text-amber-400">👑 Monarch</span>}
        {p.hasInitiative && <span className="text-cyan-400">🏰 Initiative</span>}
        {p.dungeonLevel > 0 && (
          <span className="text-purple-400">🚪 Lvl {p.dungeonLevel}</span>
        )}
        {commanderDamageEntries.map(([source, dmg]) => (
          <span key={source} className="text-red-400">⚔️ {dmg}</span>
        ))}
      </div>
    </div>
  );
}
