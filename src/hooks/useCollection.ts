"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import type { Binder, CollectionCard, CardCondition } from "@/types/collection";
import { loadSettings } from "./useSettings";

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
  const { isSignedIn } = useUser();
  const [allBinders, setAllBinders] = useState<Binder[]>([]);
  const [allCards, setAllCards] = useState<CollectionCard[]>([]);
  const [binderCards, setBinderCards] = useState<CollectionCard[]>([]);

  const refreshBinders = useCallback(async () => {
    if (isSignedIn) {
      const res = await fetch("/api/binders");
      if (res.ok) setAllBinders(await res.json());
    } else {
      setAllBinders(lsGet<Binder[]>("mtg_guest_binders", []));
    }
  }, [isSignedIn]);

  const refreshAllCards = useCallback(async () => {
    if (isSignedIn) {
      const res = await fetch("/api/binders/cards");
      if (res.ok) setAllCards(await res.json());
    } else {
      // Aggregate from all guest binders
      const binders = lsGet<Binder[]>("mtg_guest_binders", []);
      const cards = binders.flatMap((b) =>
        lsGet<CollectionCard[]>(`mtg_guest_binder_cards_${b.id}`, [])
      );
      setAllCards(cards);
    }
  }, [isSignedIn]);

  const refreshCards = useCallback(async () => {
    if (!binderId) { setBinderCards([]); return; }
    if (isSignedIn) {
      const res = await fetch(`/api/binders/${binderId}/cards`);
      if (res.ok) setBinderCards(await res.json());
    } else {
      setBinderCards(lsGet<CollectionCard[]>(`mtg_guest_binder_cards_${binderId}`, []));
    }
  }, [binderId, isSignedIn]);

  useEffect(() => { refreshBinders(); }, [refreshBinders]);
  useEffect(() => { refreshAllCards(); }, [refreshAllCards]);
  useEffect(() => { refreshCards(); }, [refreshCards]);

  async function createBinder(name: string): Promise<string> {
    if (isSignedIn) {
      const res = await fetch("/api/binders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const binder = await res.json();
      setAllBinders((prev) => [binder, ...prev]);
      return binder.id;
    } else {
      const binder: Binder = {
        id: uuid(), name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const binders = lsGet<Binder[]>("mtg_guest_binders", []);
      lsSet("mtg_guest_binders", [binder, ...binders]);
      setAllBinders([binder, ...binders]);
      return binder.id!;
    }
  }

  async function deleteBinder(id: string) {
    setAllBinders((prev) => prev.filter((b) => b.id !== id));
    if (isSignedIn) {
      await fetch(`/api/binders/${id}`, { method: "DELETE" });
    } else {
      lsSet("mtg_guest_binders", lsGet<Binder[]>("mtg_guest_binders", []).filter((b) => b.id !== id));
      lsSet(`mtg_guest_binder_cards_${id}`, []);
    }
  }

  async function addCardToBinder(targetBinderId: string, card: AddCardParams): Promise<string> {
    const defaults = loadSettings();
    const cardWithDefaults: AddCardParams = {
      condition: defaults.defaultCondition,
      isFoil: defaults.defaultFoil,
      ...card,
    };
    card = cardWithDefaults;
    if (isSignedIn) {
      const res = await fetch(`/api/binders/${targetBinderId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to add card (${res.status})`);
      }
      const result = await res.json();
      await refreshCards();
      return result.id;
    } else {
      const key = `mtg_guest_binder_cards_${targetBinderId}`;
      const cards = lsGet<CollectionCard[]>(key, []);
      const existing = cards.find((c) => c.scryfallId === card.scryfallId);
      if (existing) {
        const qty = (card.quantity ?? 1);
        const updated = cards.map((c) => c === existing ? { ...c, quantity: c.quantity + qty } : c);
        lsSet(key, updated);
        setBinderCards(updated);
        return existing.id!;
      }
      const newCard: CollectionCard = {
        id: uuid(), binderId: targetBinderId,
        scryfallId: card.scryfallId, name: card.name,
        quantity: card.quantity ?? 1,
        isFoil: card.isFoil ?? false,
        condition: card.condition ?? "near_mint",
        setCode: card.setCode, setName: card.setName,
        imageUri: card.imageUri, priceUsd: card.priceUsd,
      };
      const updated = [newCard, ...cards];
      lsSet(key, updated);
      setBinderCards(updated);
      return newCard.id!;
    }
  }

  async function removeFromCollection(id: string) {
    setBinderCards((prev) => prev.filter((c) => c.id !== id));
    if (isSignedIn) {
      await fetch(`/api/collection-cards/${id}`, { method: "DELETE" });
    } else if (binderId) {
      const key = `mtg_guest_binder_cards_${binderId}`;
      lsSet(key, lsGet<CollectionCard[]>(key, []).filter((c) => c.id !== id));
    }
  }

  async function updateQuantity(id: string, qty: number) {
    if (qty <= 0) {
      setBinderCards((prev) => prev.filter((c) => c.id !== id));
    } else {
      setBinderCards((prev) => prev.map((c) => c.id === id ? { ...c, quantity: qty } : c));
    }
    if (isSignedIn) {
      if (qty <= 0) {
        await fetch(`/api/collection-cards/${id}`, { method: "DELETE" });
      } else {
        await fetch(`/api/collection-cards/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: qty }),
        });
      }
    } else if (binderId) {
      const key = `mtg_guest_binder_cards_${binderId}`;
      if (qty <= 0) {
        lsSet(key, lsGet<CollectionCard[]>(key, []).filter((c) => c.id !== id));
      } else {
        lsSet(key, lsGet<CollectionCard[]>(key, []).map((c) => c.id === id ? { ...c, quantity: qty } : c));
      }
    }
  }

  async function getBinderCards(targetBinderId: string): Promise<CollectionCard[]> {
    if (isSignedIn) {
      const res = await fetch(`/api/binders/${targetBinderId}/cards`);
      if (res.ok) return res.json();
      return [];
    }
    return lsGet<CollectionCard[]>(`mtg_guest_binder_cards_${targetBinderId}`, []);
  }

  return {
    allBinders, allCards, binderCards, createBinder, deleteBinder,
    addCardToBinder, removeFromCollection, updateQuantity, getBinderCards,
  };
}
