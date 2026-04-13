"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameEntry, GameResult } from "@/types/game";

const LS_KEY = "mtg_game_log";

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export interface DeckStats {
  deckName: string;
  deckId?: string;
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number;  // 0–100
}

export function computeStats(entries: GameEntry[]): DeckStats[] {
  const map = new Map<string, DeckStats>();
  for (const e of entries) {
    const key = e.deckId ?? e.deckName;
    if (!map.has(key)) {
      map.set(key, { deckName: e.deckName, deckId: e.deckId, wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 });
    }
    const s = map.get(key)!;
    s.total++;
    if (e.result === "win")   s.wins++;
    if (e.result === "loss")  s.losses++;
    if (e.result === "draw")  s.draws++;
    s.winRate = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0;
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function useGameLog() {
  const [entries, setEntries] = useState<GameEntry[]>([]);

  useEffect(() => {
    setEntries(lsGet<GameEntry[]>(LS_KEY, []));
  }, []);

  const addEntry = useCallback((entry: Omit<GameEntry, "id">) => {
    const newEntry: GameEntry = { ...entry, id: uuid() };
    setEntries((prev) => {
      const updated = [newEntry, ...prev];
      lsSet(LS_KEY, updated);
      return updated;
    });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      lsSet(LS_KEY, updated);
      return updated;
    });
  }, []);

  const updateEntry = useCallback((id: string, changes: Partial<Omit<GameEntry, "id">>) => {
    setEntries((prev) => {
      const updated = prev.map((e) => e.id === id ? { ...e, ...changes } : e);
      lsSet(LS_KEY, updated);
      return updated;
    });
  }, []);

  return { entries, addEntry, deleteEntry, updateEntry };
}
