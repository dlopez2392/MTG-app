"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { MTG_PLAYER_COLORS, DEFAULT_PLAYER_COLOR_KEYS, type MtgPlayerColorKey } from "@/lib/constants";
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

const FORMATS = [
  { label: "Commander", life: 40 },
  { label: "Standard", life: 20 },
  { label: "Modern", life: 20 },
  { label: "Brawl", life: 25 },
];

const PLAYER_COLORS = ["#7B8794", "#4CAF81", "#5BA8A0", "#6B7DB8", "#8B6BAD", "#A06BA0"];

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
  const [showPlayers, setShowPlayers] = useState(false);

  function handleNameChange(index: number, name: string) {
    setPlayerNames((prev) => { const next = [...prev]; next[index] = name; return next; });
  }

  function handleColorChange(playerIndex: number, key: MtgPlayerColorKey) {
    setSelectedColorKeys((prev) => { const next = [...prev] as MtgPlayerColorKey[]; next[playerIndex] = key; return next; });
  }

  function handleStart() {
    const names = playerNames.slice(0, playerCount);
    const colors = selectedColorKeys
      .slice(0, playerCount)
      .map((k) => MTG_PLAYER_COLORS.find((c) => c.key === k)!.color);
    onStart(playerCount, startingLife, names, colors);
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg-primary overflow-y-auto pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <h1 className="font-display text-3xl font-black uppercase tracking-wide text-text-primary">
          Life Counter
        </h1>
      </div>

      <div className="px-6 space-y-5">
        {/* ── Players ── */}
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
            Players
          </label>
          <div className="grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((count, i) => (
              <button
                key={count}
                type="button"
                onClick={() => setPlayerCount(count)}
                className={cn(
                  "aspect-square rounded-2xl flex items-center justify-center text-2xl font-black text-white cursor-pointer transition-all",
                  playerCount === count
                    ? "scale-105 shadow-lg ring-2 ring-white ring-offset-2 ring-offset-bg-primary"
                    : "opacity-60 hover:opacity-90 active:scale-95"
                )}
                style={{ backgroundColor: PLAYER_COLORS[i] }}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* ── Format / Starting Life ── */}
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-2">
            Format
          </label>
          <div className="grid grid-cols-4 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setStartingLife(f.life)}
                className={cn(
                  "py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                  startingLife === f.life
                    ? "bg-accent text-black border-accent shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]"
                    : "bg-bg-card text-text-secondary border-border hover:border-accent/40"
                )}
              >
                <span className="block">{f.label}</span>
                <span className="block text-[10px] font-normal opacity-70">{f.life} life</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Player Names (collapsible) ── */}
        <div>
          <button
            type="button"
            onClick={() => setShowPlayers(!showPlayers)}
            className="flex items-center justify-between w-full mb-2"
          >
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
              Customize Players
            </span>
            <svg
              className={cn("w-4 h-4 text-text-muted transition-transform", showPlayers && "rotate-180")}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {showPlayers && (
            <div className="space-y-2">
              {Array.from({ length: playerCount }, (_, i) => {
                const selectedKey = selectedColorKeys[i] ?? "R";
                const selectedMtgColor = MTG_PLAYER_COLORS.find((c) => c.key === selectedKey)!;
                return (
                  <div key={i} className="bg-bg-card border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedMtgColor.color }} />
                      <Input
                        value={playerNames[i]}
                        onChange={(e) => handleNameChange(i, e.target.value)}
                        placeholder={`Player ${i + 1}`}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-text-muted uppercase tracking-wide mr-1">Color</span>
                      {MTG_PLAYER_COLORS.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => handleColorChange(i, c.key as MtgPlayerColorKey)}
                          title={c.label}
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150",
                            selectedKey === c.key
                              ? "ring-2 ring-white ring-offset-1 ring-offset-bg-card scale-110"
                              : "opacity-60 hover:opacity-90"
                          )}
                        >
                          <ManaSymbol symbol={c.key} size={18} />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Start Button ── */}
        <button
          type="button"
          onClick={handleStart}
          className="w-full py-4 rounded-2xl bg-accent text-black text-lg font-bold hover:bg-accent-dark active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
        >
          START GAME
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
