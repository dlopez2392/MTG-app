"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { MTG_PLAYER_COLORS, DEFAULT_PLAYER_COLOR_KEYS, type MtgPlayerColorKey } from "@/lib/constants";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ManaSymbol from "@/components/cards/ManaSymbol";

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

const PLAYER_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6];
const LIFE_OPTIONS = [
  { value: 20, label: "20" },
  { value: 25, label: "25" },
  { value: 30, label: "30" },
  { value: 40, label: "40" },
];

export default function PlayerSetup({
  defaultPlayerCount = 2,
  defaultStartingLife = 20,
  onStart,
}: PlayerSetupProps) {
  const [playerCount, setPlayerCount] = useState(defaultPlayerCount);
  const [startingLife, setStartingLife] = useState(defaultStartingLife);
  const [playerNames, setPlayerNames] = useState<string[]>(
    Array.from({ length: 6 }, (_, i) => `Player ${i + 1}`)
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
              type="button"
              onClick={() => setPlayerCount(count)}
              className={cn(
                "flex-1 py-3 rounded-xl text-lg font-bold transition-colors border cursor-pointer",
                playerCount === count
                  ? "bg-accent text-black border-accent shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]"
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
              type="button"
              onClick={() => setStartingLife(value)}
              className={cn(
                "flex-1 py-3 rounded-xl text-lg font-bold transition-colors border cursor-pointer",
                startingLife === value
                  ? "bg-accent text-black border-accent shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]"
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
                      <ManaSymbol symbol={c.key} size={20} />
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
