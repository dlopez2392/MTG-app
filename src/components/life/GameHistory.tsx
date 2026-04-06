"use client";

import { cn } from "@/lib/utils/cn";
import type { Player, LifeEvent } from "@/types/life";

interface GameHistoryProps {
  events: LifeEvent[];
  players: Player[];
  className?: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getEventDescription(event: LifeEvent, players: Player[]): string {
  const sign = event.delta > 0 ? "+" : "";

  switch (event.type) {
    case "life":
      return `Life ${sign}${event.delta} (now ${event.resultingValue})`;
    case "poison":
      return `Poison ${sign}${event.delta} (now ${event.resultingValue})`;
    case "commander_damage": {
      const source = players.find((p) => p.id === event.sourcePlayerId);
      return `Cmdr dmg from ${source?.name ?? "?"}: ${sign}${event.delta} life (now ${event.resultingValue})`;
    }
    default:
      return `${sign}${event.delta}`;
  }
}

export default function GameHistory({
  events,
  players,
  className,
}: GameHistoryProps) {
  const reversed = [...events].reverse();

  return (
    <div className={cn("space-y-1 max-h-80 overflow-y-auto", className)}>
      {reversed.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-4">
          No events yet
        </p>
      ) : (
        reversed.map((event, i) => {
          const player = players.find((p) => p.id === event.playerId);
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-card/50 text-xs"
            >
              <span className="text-text-muted w-16 flex-shrink-0 tabular-nums">
                {formatTime(event.timestamp)}
              </span>
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: player?.color ?? "#888" }}
              />
              <span
                className="font-medium flex-shrink-0"
                style={{ color: player?.color ?? "#888" }}
              >
                {player?.name ?? "?"}
              </span>
              <span className="text-text-secondary truncate">
                {getEventDescription(event, players)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
