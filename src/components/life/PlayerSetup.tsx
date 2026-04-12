"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { MTG_PLAYER_COLORS, DEFAULT_PLAYER_COLOR_KEYS, type MtgPlayerColorKey } from "@/lib/constants";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface PlayerSetupProps {
  defaultPlayerCount?: number;
  defaultStartingLife?: number;
  onStart: (
    playerCount: number,
    startingLife: number,
    playerNames: string[],
    playerColors: string[]
  ) => void;
}

const PLAYER_COUNT_OPTIONS = [1, 2, 3, 4];
const LIFE_OPTIONS = [
  { value: 20, label: "20" },
  { value: 25, label: "25" },
  { value: 30, label: "30" },
  { value: 40, label: "40" },
];

// MTG mana symbol SVGs (simplified)
function ManaSymbol({ colorKey }: { colorKey: string }) {
  switch (colorKey) {
    case "W":
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
          <circle cx="10" cy="10" r="8" fill="#D4C26A" />
          <path d="M10 3l1.5 4.5H16l-3.7 2.7 1.4 4.3L10 12l-3.7 2.5 1.4-4.3L4 7.5h4.5L10 3z" fill="#7a6a20" />
        </svg>
      );
    case "U":
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
          <circle cx="10" cy="10" r="8" fill="#3B82F6" />
          <path d="M10 4c-1.5 2-3 4-3 6s1.5 4 3 6c1.5-2 3-4 3-6s-1.5-4-3-6z" fill="#1d4ed8" />
          <ellipse cx="10" cy="10" rx="5" ry="2" fill="#1d4ed8" />
        </svg>
      );
    case "B":
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
          <circle cx="10" cy="10" r="8" fill="#4c1d95" />
          <path d="M10 5c-1 1-2 2.5-2 4 0 1 .5 2 1 2.5L7.5 15h5l-1.5-3.5c.5-.5 1-1.5 1-2.5 0-1.5-1-3-2-4z" fill="#7c3aed" />
        </svg>
      );
    case "R":
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
          <circle cx="10" cy="10" r="8" fill="#EF4444" />
          <path d="M10 3c0 4-4 5-4 8 0 2 1.5 3.5 4 4 2.5-.5 4-2 4-4 0-3-4-4-4-8z" fill="#991b1b" />
        </svg>
      );
    case "G":
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
          <circle cx="10" cy="10" r="8" fill="#22C55E" />
          <path d="M10 4C7 6 5 8 5 11c0 2 1 3.5 2.5 4.5C9 14 10 12 10 12s1 2 2.5 3.5C14 14.5 15 13 15 11c0-3-2-5-5-7z" fill="#166534" />
        </svg>
      );
    default:
      return null;
  }
}

export default function PlayerSetup({
  defaultPlayerCount = 2,
  defaultStartingLife = 20,
  onStart,
}: PlayerSetupProps) {
  const [playerCount, setPlayerCount] = useState(defaultPlayerCount);
  const [startingLife, setStartingLife] = useState(defaultStartingLife);
  const [playerNames, setPlayerNames] = useState<string[]>(
    Array.from({ length: 4 }, (_, i) => `Player ${i + 1}`)
  );
  const [selectedColorKeys, setSelectedColorKeys] = useState<MtgPlayerColorKey[]>(
    [...DEFAULT_PLAYER_COLOR_KEYS]
  );

  function handleNameChange(index: number, name: string) {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  }

  function handleColorChange(playerIndex: number, key: MtgPlayerColorKey) {
    setSelectedColorKeys((prev) => {
      const next = [...prev] as MtgPlayerColorKey[];
      next[playerIndex] = key;
      return next;
    });
  }

  function handleStart() {
    const names = playerNames.slice(0, playerCount);
    const colors = selectedColorKeys
      .slice(0, playerCount)
      .map((k) => MTG_PLAYER_COLORS.find((c) => c.key === k)!.color);
    onStart(playerCount, startingLife, names, colors);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-8 pb-24">
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-text-primary mb-8">
        Life Counter
      </h1>

      {/* Player Count */}
      <div className="w-full max-w-sm mb-6">
        <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
          Players
        </label>
        <div className="flex gap-2">
          {PLAYER_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              onClick={() => setPlayerCount(count)}
              className={cn(
                "flex-1 py-3 rounded-lg text-lg font-bold transition-colors border",
                playerCount === count
                  ? "bg-accent text-black border-accent"
                  : "bg-bg-card text-text-secondary border-border hover:border-text-muted"
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Starting Life */}
      <div className="w-full max-w-sm mb-6">
        <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
          Starting Life
        </label>
        <div className="flex gap-2">
          {LIFE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStartingLife(value)}
              className={cn(
                "flex-1 py-3 rounded-lg text-lg font-bold transition-colors border",
                startingLife === value
                  ? "bg-accent text-black border-accent"
                  : "bg-bg-card text-text-secondary border-border hover:border-text-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Player Names + Colors */}
      <div className="w-full max-w-sm mb-8">
        <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
          Players
        </label>
        <div className="space-y-3">
          {Array.from({ length: playerCount }, (_, i) => {
            const selectedKey = selectedColorKeys[i] ?? "R";
            const selectedMtgColor = MTG_PLAYER_COLORS.find((c) => c.key === selectedKey)!;
            return (
              <div key={i} className="bg-bg-card border border-border rounded-xl p-3 space-y-2">
                {/* Name row */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedMtgColor.color }}
                  />
                  <Input
                    value={playerNames[i]}
                    onChange={(e) => handleNameChange(i, e.target.value)}
                    placeholder={`Player ${i + 1}`}
                    className="flex-1"
                  />
                </div>

                {/* MTG Color picker */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-text-muted uppercase tracking-wide mr-1">Color</span>
                  {MTG_PLAYER_COLORS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => handleColorChange(i, c.key as MtgPlayerColorKey)}
                      title={c.label}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150",
                        selectedKey === c.key
                          ? "ring-2 ring-white ring-offset-1 ring-offset-bg-card scale-110"
                          : "opacity-60 hover:opacity-90"
                      )}
                    >
                      <ManaSymbol colorKey={c.key} />
                    </button>
                  ))}
                  <span
                    className="ml-auto text-[10px] font-medium"
                    style={{ color: selectedMtgColor.color }}
                  >
                    {selectedMtgColor.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button size="lg" className="w-full max-w-sm text-lg" onClick={handleStart}>
        Start Game
      </Button>
    </div>
  );
}
