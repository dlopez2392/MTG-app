"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import type { Deck, DeckCard, DeckCategory } from "@/types/deck";
import type { ScryfallCard } from "@/types/card";

// ── localStorage helpers ──────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────────

export function useDecks() {
  const { isSignedIn } = useUser();
  const [allDecks, setAllDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (isSignedIn) {
      try {
        const res = await fetch("/api/decks");
        if (res.ok) setAllDecks(await res.json());
      } finally { setLoading(false); }
    } else {
      setAllDecks(lsGet<Deck[]>("mtg_guest_decks", []));
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => { refresh(); }, [refresh]);

  async function createDeck(name: string, format?: string): Promise<string> {
    if (isSignedIn) {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, format }),
      });
      const deck = await res.json();
      await refresh();
      return deck.id;
    } else {
      const deck: Deck = {
        id: uuid(), name, format,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const decks = lsGet<Deck[]>("mtg_guest_decks", []);
      lsSet("mtg_guest_decks", [deck, ...decks]);
      await refresh();
      return deck.id!;
    }
  }

  async function updateDeck(id: string, updates: Partial<Deck>) {
    if (isSignedIn) {
      await fetch(`/api/decks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      await refresh();
    } else {
      const decks = lsGet<Deck[]>("mtg_guest_decks", []);
      lsSet("mtg_guest_decks", decks.map((d) => d.id === id ? { ...d, ...updates } : d));
      await refresh();
    }
  }

  async function deleteDeck(id: string) {
    if (isSignedIn) {
      await fetch(`/api/decks/${id}`, { method: "DELETE" });
      await refresh();
    } else {
      lsSet("mtg_guest_decks", lsGet<Deck[]>("mtg_guest_decks", []).filter((d) => d.id !== id));
      lsSet(`mtg_guest_deck_cards_${id}`, []);
      await refresh();
    }
  }

  async function getDeck(id: string): Promise<Deck | undefined> {
    const cached = allDecks.find((d) => d.id === id);
    if (cached) return cached;
    if (isSignedIn) {
      const res = await fetch(`/api/decks/${id}`);
      if (res.ok) return await res.json();
    }
    return undefined;
  }

  async function addCardToDeck(
    deckId: string,
    card: Partial<ScryfallCard>,
    category: DeckCategory = "main",
    quantity = 1
  ): Promise<string> {
    const imageUri =
      card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? undefined;

    if (isSignedIn) {
      const res = await fetch(`/api/decks/${deckId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scryfallId: card.id, name: card.name, quantity, category,
          manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost,
          cmc: card.cmc, typeLine: card.type_line, rarity: card.rarity,
          imageUri, priceUsd: card.prices?.usd,
        }),
      });
      return (await res.json()).id;
    } else {
      const key = `mtg_guest_deck_cards_${deckId}`;
      const cards = lsGet<DeckCard[]>(key, []);
      const existing = cards.find((c) => c.scryfallId === card.id && c.category === category);
      if (existing) {
        lsSet(key, cards.map((c) => c === existing ? { ...c, quantity: c.quantity + quantity } : c));
        return existing.id!;
      }
      const newCard: DeckCard = {
        id: uuid(), deckId, scryfallId: card.id!, name: card.name!, quantity, category,
        manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost,
        cmc: card.cmc, typeLine: card.type_line, rarity: card.rarity,
        imageUri, priceUsd: card.prices?.usd,
      };
      lsSet(key, [newCard, ...cards]);
      return newCard.id!;
    }
  }

  async function removeCardFromDeck(cardId: string) {
    if (isSignedIn) {
      await fetch(`/api/deck-cards/${cardId}`, { method: "DELETE" });
    }
    // guest removal handled inside useDeckCards
  }

  async function updateCardQuantity(cardId: string, quantity: number) {
    if (isSignedIn) {
      await fetch(`/api/deck-cards/${cardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
    }
    // guest update handled inside useDeckCards
  }

  return {
    allDecks, allFolders: [] as never[], loading, refresh,
    createDeck, updateDeck, deleteDeck, getDeck,
    addCardToDeck, removeCardFromDeck, updateCardQuantity,
  };
}

export function useDeckCards(deckId: string | undefined) {
  const { isSignedIn } = useUser();
  const [cards, setCards] = useState<DeckCard[]>([]);

  const refresh = useCallback(async () => {
    if (!deckId) { setCards([]); return; }
    if (isSignedIn) {
      const res = await fetch(`/api/decks/${deckId}/cards`);
      if (res.ok) setCards(await res.json());
    } else {
      setCards(lsGet<DeckCard[]>(`mtg_guest_deck_cards_${deckId}`, []));
    }
  }, [deckId, isSignedIn]);

  useEffect(() => { refresh(); }, [refresh]);

  async function updateCardQuantity(cardId: string, quantity: number) {
    const key = `mtg_guest_deck_cards_${deckId}`;
    if (quantity <= 0) {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      if (isSignedIn) {
        await fetch(`/api/deck-cards/${cardId}`, { method: "DELETE" });
      } else {
        lsSet(key, lsGet<DeckCard[]>(key, []).filter((c) => c.id !== cardId));
      }
    } else {
      setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, quantity } : c));
      if (isSignedIn) {
        await fetch(`/api/deck-cards/${cardId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity }),
        });
      } else {
        lsSet(key, lsGet<DeckCard[]>(key, []).map((c) => c.id === cardId ? { ...c, quantity } : c));
      }
    }
  }

  async function removeCardFromDeck(cardId: string) {
    const key = `mtg_guest_deck_cards_${deckId}`;
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    if (isSignedIn) {
      await fetch(`/api/deck-cards/${cardId}`, { method: "DELETE" });
    } else {
      lsSet(key, lsGet<DeckCard[]>(key, []).filter((c) => c.id !== cardId));
    }
  }

  return { cards, refresh, updateCardQuantity, removeCardFromDeck };
}
