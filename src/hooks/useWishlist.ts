"use client";

import { useState, useEffect, useCallback } from "react";
import type { WishlistItem } from "@/types/wishlist";

const LS_KEY = "mtg_wishlist";

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

export function useWishlist() {
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => {
    setItems(lsGet<WishlistItem[]>(LS_KEY, []));
  }, []);

  const refresh = useCallback(() => {
    setItems(lsGet<WishlistItem[]>(LS_KEY, []));
  }, []);

  function isOnWishlist(scryfallId: string): boolean {
    return items.some((i) => i.scryfallId === scryfallId);
  }

  function addItem(item: Omit<WishlistItem, "id" | "addedAt">): string {
    const existing = items.find((i) => i.scryfallId === item.scryfallId);
    if (existing) return existing.id;
    const newItem: WishlistItem = { ...item, id: uuid(), addedAt: new Date().toISOString() };
    const updated = [newItem, ...items];
    lsSet(LS_KEY, updated);
    setItems(updated);
    return newItem.id;
  }

  function removeItem(id: string) {
    const updated = items.filter((i) => i.id !== id);
    lsSet(LS_KEY, updated);
    setItems(updated);
  }

  function updateTargetPrice(id: string, targetPrice: number | undefined) {
    const updated = items.map((i) =>
      i.id === id ? { ...i, targetPrice } : i
    );
    lsSet(LS_KEY, updated);
    setItems(updated);
  }

  return { items, isOnWishlist, addItem, removeItem, updateTargetPrice, refresh };
}
