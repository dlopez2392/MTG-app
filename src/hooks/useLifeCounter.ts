"use client";

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Player, LifeEvent, LifeEventType } from "@/types/life";
import { PLAYER_COLORS } from "@/lib/constants";

interface UseLifeCounterReturn {
  players: Player[];
  events: LifeEvent[];
  gameStarted: boolean;
  startingLife: number;
  playerCount: number;
  setupGame: (
    playerCount: number,
    startingLife: number,
    playerNames?: string[],
    playerColors?: string[]
  ) => void;
  adjustLife: (playerId: string, delta: number) => void;
  adjustPoison: (playerId: string, delta: number) => void;
  adjustCommanderDamage: (playerId: string, delta: number, sourcePlayerId?: string) => void;
  resetGame: () => void;
  newGame: () => void;
}

// Key used to store each player's single commander damage total
const CMDR_KEY = "__cmdr__";

export function useLifeCounter(): UseLifeCounterReturn {
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [startingLife, setStartingLife] = useState(20);
  const [playerCount, setPlayerCount] = useState(2);

  const pushEvent = useCallback(
    (
      playerId: string,
      type: LifeEventType,
      delta: number,
      resultingValue: number,
      sourcePlayerId?: string
    ) => {
      const event: LifeEvent = {
        timestamp: Date.now(),
        playerId,
        type,
        delta,
        resultingValue,
        sourcePlayerId,
      };
      setEvents((prev) => [...prev, event]);
    },
    []
  );

  const setupGame = useCallback(
    (count: number, life: number, playerNames?: string[], playerColors?: string[]) => {
      setPlayerCount(count);
      setStartingLife(life);

      const newPlayers: Player[] = Array.from({ length: count }, (_, i) => ({
        id: uuidv4(),
        name: playerNames?.[i] || `Player ${i + 1}`,
        color: playerColors?.[i] ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
        life,
        poisonCounters: 0,
        commanderDamage: { [CMDR_KEY]: 0 },
      }));

      setPlayers(newPlayers);
      setEvents([]);
      setGameStarted(true);
    },
    []
  );

  const adjustLife = useCallback(
    (playerId: string, delta: number) => {
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== playerId) return p;
          const newLife = p.life + delta;
          pushEvent(playerId, "life", delta, newLife);
          return { ...p, life: newLife };
        })
      );
    },
    [pushEvent]
  );

  const adjustPoison = useCallback(
    (playerId: string, delta: number) => {
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== playerId) return p;
          const newPoison = Math.max(0, p.poisonCounters + delta);
          pushEvent(playerId, "poison", delta, newPoison);
          return { ...p, poisonCounters: newPoison };
        })
      );
    },
    [pushEvent]
  );

  const adjustCommanderDamage = useCallback(
    (playerId: string, delta: number, sourcePlayerId?: string) => {
      const key = sourcePlayerId ?? CMDR_KEY;
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== playerId) return p;
          const current = p.commanderDamage[key] ?? 0;
          const clamped = delta < 0 ? Math.max(delta, -current) : delta;
          if (clamped === 0) return p;
          const newTotal = current + clamped;
          const newLife = p.life - clamped;
          pushEvent(playerId, "commander_damage", -clamped, newLife, sourcePlayerId);
          return {
            ...p,
            life: newLife,
            commanderDamage: { ...p.commanderDamage, [key]: newTotal },
          };
        })
      );
    },
    [pushEvent]
  );

  const resetGame = useCallback(() => {
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        life: startingLife,
        poisonCounters: 0,
        commanderDamage: Object.fromEntries(Object.keys(p.commanderDamage).map((k) => [k, 0])),
      }))
    );
    setEvents([]);
  }, [startingLife]);

  const newGame = useCallback(() => {
    setPlayers([]);
    setEvents([]);
    setGameStarted(false);
  }, []);

  return {
    players,
    events,
    gameStarted,
    startingLife,
    playerCount,
    setupGame,
    adjustLife,
    adjustPoison,
    adjustCommanderDamage,
    resetGame,
    newGame,
  };
}
