"use client";

import { cn } from "@/lib/utils/cn";
import type { Player } from "@/types/life";

interface PlayerPanelProps {
  player: Player;
  onLifeChange: (delta: number) => void;
  onPoisonChange: (delta: number) => void;
  isRotated?: boolean;
  className?: string;
}

export default function PlayerPanel({
  player,
  onLifeChange,
  onPoisonChange,
  isRotated = false,
  className,
}: PlayerPanelProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center select-none overflow-hidden rounded-xl",
        isRotated && "rotate-180",
        className
      )}
      style={{
        backgroundColor: `${player.color}18`,
      }}
    >
      {/* Player name & color indicator */}
      <div className="absolute top-2 left-0 right-0 flex items-center justify-center gap-2 z-10">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: player.color }}
        />
        <span className="text-xs font-medium text-text-secondary">
          {player.name}
        </span>
      </div>

      {/* Main area: minus / life / plus */}
      <div className="flex items-center justify-between w-full h-full px-2">
        {/* Minus button */}
        <button
          onClick={() => onLifeChange(-1)}
          className="flex items-center justify-center w-16 h-full text-3xl font-bold text-text-muted hover:text-text-primary active:text-banned transition-colors"
          aria-label="Decrease life"
        >
          -
        </button>

        {/* Life total */}
        <span
          className="text-6xl font-black tabular-nums"
          style={{ color: player.color }}
        >
          {player.life}
        </span>

        {/* Plus button */}
        <button
          onClick={() => onLifeChange(1)}
          className="flex items-center justify-center w-16 h-full text-3xl font-bold text-text-muted hover:text-text-primary active:text-legal transition-colors"
          aria-label="Increase life"
        >
          +
        </button>
      </div>

      {/* Poison counter at bottom */}
      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-2 z-10">
        <button
          onClick={() => onPoisonChange(-1)}
          className="w-6 h-6 flex items-center justify-center rounded text-xs text-text-muted hover:text-text-primary bg-bg-card/60"
        >
          -
        </button>
        <div className="flex items-center gap-1">
          {/* Skull icon */}
          <svg
            className="w-4 h-4 text-legal"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 2a6 6 0 00-6 6c0 1.887.87 3.568 2.23 4.668A1.5 1.5 0 017 14.5V16a1 1 0 001 1h1v1a1 1 0 102 0v-1h1a1 1 0 001-1v-1.5a1.5 1.5 0 01.77-1.832A6 6 0 0010 2zM8 9a1 1 0 11-2 0 1 1 0 012 0zm5 1a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          <span className="text-sm font-bold text-legal tabular-nums">
            {player.poisonCounters}
          </span>
        </div>
        <button
          onClick={() => onPoisonChange(1)}
          className="w-6 h-6 flex items-center justify-center rounded text-xs text-text-muted hover:text-text-primary bg-bg-card/60"
        >
          +
        </button>
      </div>
    </div>
  );
}
