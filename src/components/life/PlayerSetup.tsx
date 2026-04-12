"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { PLAYER_COLORS } from "@/lib/constants";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface PlayerSetupProps {
  defaultPlayerCount?: number;
  defaultStartingLife?: number;
  onStart: (
    playerCount: number,
    startingLife: number,
    playerNames: string[]
  ) => void;
}

const PLAYER_COUNT_OPTIONS = [1, 2, 3, 4];
const LIFE_OPTIONS = [20, 40];

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

  function handleNameChange(index: number, name: string) {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-8 pb-24">
      <h1 className="text-2xl font-bold text-text-primary mb-8">
        Life Counter
      </h1>

      {/* Player Count */}
      <div className="w-full max-w-sm mb-6">
        <label className="block text-sm font-medium text-text-secondary mb-2">
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
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Starting Life
        </label>
        <div className="flex gap-2">
          {LIFE_OPTIONS.map((life) => (
            <button
              key={life}
              onClick={() => setStartingLife(life)}
              className={cn(
                "flex-1 py-3 rounded-lg text-lg font-bold transition-colors border",
                startingLife === life
                  ? "bg-accent text-black border-accent"
                  : "bg-bg-card text-text-secondary border-border hover:border-text-muted"
              )}
            >
              {life}
            </button>
          ))}
        </div>
      </div>

      {/* Player Names */}
      <div className="w-full max-w-sm mb-8">
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Player Names
        </label>
        <div className="space-y-2">
          {Array.from({ length: playerCount }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    PLAYER_COLORS[i % PLAYER_COLORS.length],
                }}
              />
              <Input
                value={playerNames[i]}
                onChange={(e) => handleNameChange(i, e.target.value)}
                placeholder={`Player ${i + 1}`}
                className="flex-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <Button
        size="lg"
        className="w-full max-w-sm text-lg"
        onClick={() =>
          onStart(playerCount, startingLife, playerNames.slice(0, playerCount))
        }
      >
        Start Game
      </Button>
    </div>
  );
}
