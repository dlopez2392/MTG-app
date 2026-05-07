"use client";

import { cn } from "@/lib/utils/cn";
import type { MultiplayerPlayerState } from "@/hooks/useMultiplayerRoom";

interface OpponentBarProps {
  players: MultiplayerPlayerState[];
  className?: string;
}

export default function OpponentBar({ players, className }: OpponentBarProps) {
  if (players.length === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-0 inset-x-0 z-30 flex items-center gap-2 px-3 py-2 bg-black/90 backdrop-blur-sm border-t border-white/10 overflow-x-auto",
      className
    )}>
      {players.map((p) => (
        <div
          key={p.playerId}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex-shrink-0"
        >
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
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
    </div>
  );
}
