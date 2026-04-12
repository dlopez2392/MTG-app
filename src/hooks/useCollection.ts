"use client";

import { useState, useEffect, useCallback } from "react";
import type { Binder, CollectionCard, CardCondition } from "@/types/collection";

interface AddCardParams {
  scryfallId: string;
  name: string;
  quantity?: number;
  condition?: CardCondition;
  isFoil?: boolean;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  imageUri?: string;
  priceUsd?: string | null;
  typeLine?: string;
  rarity?: CollectionCard["rarity"];
}

export function useCollection(binderId?: string) {
  const [allBinders, setAllBinders] = useState<Binder[]>([]);
  const [binderCards, setBinderCards] = useState<CollectionCard[]>([]);

  const refreshBinders = useCallback(async () => {
    const res = await fetch("/api/binders");
    if (res.ok) setAllBinders(await res.json());
  }, []);

  const refreshCards = useCallback(async () => {
    if (!binderId) { setBinderCards([]); return; }
    const res = await fetch(`/api/binders/${binderId}/cards`);
    if (res.ok) setBinderCards(await res.json());
  }, [binderId]);

  useEffect(() => { refreshBinders(); }, [refreshBinders]);
  useEffect(() => { refreshCards(); }, [refreshCards]);

  async function createBinder(name: string): Promise<string> {
    const res = await fetch("/api/binders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const binder = await res.json();
    await refreshBinders();
    return binder.id;
  }

  async function deleteBinder(id: string) {
    await fetch(`/api/binders/${id}`, { method: "DELETE" });
    await refreshBinders();
  }

  async function addCardToBinder(targetBinderId: string, card: AddCardParams): Promise<string> {
    const res = await fetch(`/api/binders/${targetBinderId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    const result = await res.json();
    await refreshCards();
    return result.id;
  }

  async function removeFromCollection(id: string) {
    await fetch(`/api/collection-cards/${id}`, { method: "DELETE" });
    await refreshCards();
  }

  async function updateQuantity(id: string, qty: number) {
    await fetch(`/api/collection-cards/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: qty }),
    });
    await refreshCards();
  }

  async function getBinderCards(targetBinderId: string): Promise<CollectionCard[]> {
    const res = await fetch(`/api/binders/${targetBinderId}/cards`);
    if (res.ok) return res.json();
    return [];
  }

  return {
    allBinders,
    binderCards,
    createBinder,
    deleteBinder,
    addCardToBinder,
    removeFromCollection,
    updateQuantity,
    getBinderCards,
  };
}
