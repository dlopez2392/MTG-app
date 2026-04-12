"use client";

import { useState, useEffect, useCallback } from "react";
import type { Deck, DeckCard, DeckCategory } from "@/types/deck";
import type { ScryfallCard } from "@/types/card";

export function useDecks() {
  const [allDecks, setAllDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/decks");
      if (res.ok) setAllDecks(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function createDeck(name: string, format?: string): Promise<string> {
    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, format }),
    });
    const deck = await res.json();
    await refresh();
    return deck.id;
  }

  async function updateDeck(id: string, updates: Partial<Deck>) {
    await fetch(`/api/decks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    await refresh();
  }

  async function deleteDeck(id: string) {
    await fetch(`/api/decks/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function getDeck(id: string): Promise<Deck | undefined> {
    return allDecks.find((d) => d.id === id);
  }

  async function addCardToDeck(
    deckId: string,
    card: Partial<ScryfallCard>,
    category: DeckCategory = "main",
    quantity = 1
  ): Promise<string> {
    const imageUri =
      card.image_uris?.normal ??
      card.card_faces?.[0]?.image_uris?.normal ??
      undefined;

    const res = await fetch(`/api/decks/${deckId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scryfallId: card.id,
        name: card.name,
        quantity,
        category,
        manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost,
        cmc: card.cmc,
        typeLine: card.type_line,
        rarity: card.rarity,
        imageUri,
        priceUsd: card.prices?.usd,
      }),
    });
    const result = await res.json();
    return result.id;
  }

  async function removeCardFromDeck(cardId: string) {
    await fetch(`/api/deck-cards/${cardId}`, { method: "DELETE" });
  }

  async function updateCardQuantity(cardId: string, quantity: number) {
    await fetch(`/api/deck-cards/${cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
  }

  return {
    allDecks,
    allFolders: [] as never[],
    loading,
    refresh,
    createDeck,
    updateDeck,
    deleteDeck,
    getDeck,
    addCardToDeck,
    removeCardFromDeck,
    updateCardQuantity,
  };
}

export function useDeckCards(deckId: string | undefined) {
  const [cards, setCards] = useState<DeckCard[]>([]);

  const refresh = useCallback(async () => {
    if (!deckId) { setCards([]); return; }
    const res = await fetch(`/api/decks/${deckId}/cards`);
    if (res.ok) setCards(await res.json());
  }, [deckId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function updateCardQuantity(cardId: string, quantity: number) {
    if (quantity <= 0) {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      await fetch(`/api/deck-cards/${cardId}`, { method: "DELETE" });
    } else {
      setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, quantity } : c));
      await fetch(`/api/deck-cards/${cardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
    }
  }

  async function removeCardFromDeck(cardId: string) {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    await fetch(`/api/deck-cards/${cardId}`, { method: "DELETE" });
  }

  return { cards, refresh, updateCardQuantity, removeCardFromDeck };
}
