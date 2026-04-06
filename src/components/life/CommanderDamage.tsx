"use client";

import { cn } from "@/lib/utils/cn";
import type { Player } from "@/types/life";

interface CommanderDamageProps {
  player: Player;
  allPlayers: Player[];
  onAddDamage: (targetId: string, sourceId: string, amount: number) => void;
  className?: string;
}

export default function CommanderDamage({
  player,
  allPlayers,
  onAddDamage,
  className,
}: CommanderDamageProps) {
  const opponents = allPlayers.filter((p) => p.id !== player.id);

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide">
        Commander Damage — {player.name}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {opponents.map((opp) => {
          const dmg = player.commanderDamage[opp.id] ?? 0;
          return (
            <div
              key={opp.id}
              className="flex items-center gap-2 bg-bg-card rounded-lg p-2 border border-border"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: opp.color }}
              />
              <span className="text-xs text-text-secondary flex-1 truncate">
                {opp.name}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onAddDamage(player.id, opp.id, -1)}
                  disabled={dmg <= 0}
                  className="w-5 h-5 rounded text-xs text-text-muted hover:text-text-primary bg-bg-hover flex items-center justify-center disabled:opacity-30"
                >
                  -
                </button>
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums w-5 text-center",
                    dmg >= 21 ? "text-banned" : "text-text-primary"
                  )}
                >
                  {dmg}
                </span>
                <button
                  onClick={() => onAddDamage(player.id, opp.id, 1)}
                  className="w-5 h-5 rounded text-xs text-text-muted hover:text-text-primary bg-bg-hover flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
