"use client";

import { useState, useEffect, useCallback } from "react";

const LS_KEY = "mtg_value_history";
const MAX_ENTRIES = 90;

export interface ValueSnapshot {
  date: string;   // YYYY-MM-DD
  value: number;  // total USD
  cards: number;  // total card count
}

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useValueHistory() {
  const [history, setHistory] = useState<ValueSnapshot[]>([]);

  useEffect(() => {
    setHistory(lsGet<ValueSnapshot[]>(LS_KEY, []));
  }, []);

  /** Call once when you have fresh collection totals — records at most one snapshot per day */
  const recordSnapshot = useCallback((value: number, cards: number) => {
    const today = todayStr();
    const existing = lsGet<ValueSnapshot[]>(LS_KEY, []);

    // Replace today's entry if it exists, otherwise append
    const withoutToday = existing.filter((s) => s.date !== today);
    const updated = [...withoutToday, { date: today, value, cards }]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-MAX_ENTRIES);

    lsSet(LS_KEY, updated);
    setHistory(updated);
  }, []);

  return { history, recordSnapshot };
}
