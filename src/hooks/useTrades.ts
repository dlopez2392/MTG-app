"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import type { Trade } from "@/types/trade";

const LS_KEY = "mtg_trades";

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

export function useTrades() {
  const { isSignedIn } = useUser();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSignedIn === undefined) return;
    if (isSignedIn) {
      setLoading(true);
      fetch("/api/trades")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setTrades(data); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setTrades(lsGet<Trade[]>(LS_KEY, []));
      setLoading(false);
    }
  }, [isSignedIn]);

  const addTrade = useCallback(async (trade: Omit<Trade, "id">) => {
    if (isSignedIn) {
      try {
        const res = await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trade),
        });
        const created = await res.json();
        if (created.id) setTrades((prev) => [created, ...prev]);
        return created as Trade;
      } catch { return null; }
    } else {
      const newTrade: Trade = { ...trade, id: uuid() };
      setTrades((prev) => {
        const updated = [newTrade, ...prev];
        lsSet(LS_KEY, updated);
        return updated;
      });
      return newTrade;
    }
  }, [isSignedIn]);

  const updateTrade = useCallback(async (id: string, changes: Partial<Omit<Trade, "id">>) => {
    if (isSignedIn) {
      setTrades((prev) => prev.map((t) => t.id === id ? { ...t, ...changes } : t));
      try {
        const res = await fetch("/api/trades", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...changes }),
        });
        const updated = await res.json();
        if (updated.id) setTrades((prev) => prev.map((t) => t.id === id ? updated : t));
      } catch {
        fetch("/api/trades").then((r) => r.json()).then((data) => {
          if (Array.isArray(data)) setTrades(data);
        }).catch(() => {});
      }
    } else {
      setTrades((prev) => {
        const updated = prev.map((t) => t.id === id ? { ...t, ...changes } : t);
        lsSet(LS_KEY, updated);
        return updated;
      });
    }
  }, [isSignedIn]);

  const deleteTrade = useCallback(async (id: string) => {
    if (isSignedIn) {
      setTrades((prev) => prev.filter((t) => t.id !== id));
      try {
        await fetch("/api/trades", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } catch {
        fetch("/api/trades").then((r) => r.json()).then((data) => {
          if (Array.isArray(data)) setTrades(data);
        }).catch(() => {});
      }
    } else {
      setTrades((prev) => {
        const updated = prev.filter((t) => t.id !== id);
        lsSet(LS_KEY, updated);
        return updated;
      });
    }
  }, [isSignedIn]);

  return { trades, loading, addTrade, updateTrade, deleteTrade };
}
