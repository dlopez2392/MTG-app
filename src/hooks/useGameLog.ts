"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
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
  winRate: number;
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
  const { isSignedIn } = useUser();
  const [entries, setEntries] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch from API if signed in, otherwise localStorage
  useEffect(() => {
    if (isSignedIn === undefined) return; // still loading auth
    if (isSignedIn) {
      setLoading(true);
      fetch("/api/game-logs")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setEntries(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setEntries(lsGet<GameEntry[]>(LS_KEY, []));
      setLoading(false);
    }
  }, [isSignedIn]);

  const addEntry = useCallback(async (entry: Omit<GameEntry, "id">) => {
    if (isSignedIn) {
      try {
        const res = await fetch("/api/game-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        const created = await res.json();
        if (created.id) {
          setEntries((prev) => [created, ...prev]);
        }
      } catch { /* silent */ }
    } else {
      const newEntry: GameEntry = { ...entry, id: uuid() };
      setEntries((prev) => {
        const updated = [newEntry, ...prev];
        lsSet(LS_KEY, updated);
        return updated;
      });
    }
  }, [isSignedIn]);

  const deleteEntry = useCallback(async (id: string) => {
    if (isSignedIn) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      try {
        await fetch("/api/game-logs", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } catch {
        // Re-fetch on error to restore
        fetch("/api/game-logs").then((r) => r.json()).then((data) => {
          if (Array.isArray(data)) setEntries(data);
        }).catch(() => {});
      }
    } else {
      setEntries((prev) => {
        const updated = prev.filter((e) => e.id !== id);
        lsSet(LS_KEY, updated);
        return updated;
      });
    }
  }, [isSignedIn]);

  const updateEntry = useCallback(async (id: string, changes: Partial<Omit<GameEntry, "id">>) => {
    if (isSignedIn) {
      // Optimistic update
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, ...changes } : e));
      try {
        const res = await fetch("/api/game-logs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...changes }),
        });
        const updated = await res.json();
        if (updated.id) {
          setEntries((prev) => prev.map((e) => e.id === id ? updated : e));
        }
      } catch {
        // Re-fetch on error
        fetch("/api/game-logs").then((r) => r.json()).then((data) => {
          if (Array.isArray(data)) setEntries(data);
        }).catch(() => {});
      }
    } else {
      setEntries((prev) => {
        const updated = prev.map((e) => e.id === id ? { ...e, ...changes } : e);
        lsSet(LS_KEY, updated);
        return updated;
      });
    }
  }, [isSignedIn]);

  return { entries, loading, addEntry, deleteEntry, updateEntry };
}
