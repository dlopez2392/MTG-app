"use client";

import { getDb } from "@/lib/db/index";
import { useLiveQuery } from "dexie-react-hooks";
import type { Deck, DeckCard, DeckCategory } from "@/types/deck";
import type { ScryfallCard } from "@/types/card";

export function useDecks() {
  const db = getDb();
  const allDecks = useLiveQuery(() => db.decks.orderBy("updatedAt").reverse().toArray());
  const allFolders = useLiveQuery(() => db.deckFolders.toArray());

  async function createDeck(name: string, format?: string, folderId?: number): Promise<number> {
    const now = new Date().toISOString();
    const id = await db.decks.add({
      name,
      format,
      folderId,
      createdAt: now,
      updatedAt: now,
    });
    return id as number;
  }

  async function updateDeck(id: number, updates: Partial<Deck>) {
    await db.decks.update(id, { ...updates, updatedAt: new Date().toISOString() });
  }

  async function deleteDeck(id: number) {
    await db.transaction("rw", db.decks, db.deckCards, async () => {
      await db.deckCards.where("deckId").equals(id).delete();
      await db.decks.delete(id);
    });
  }

  async function getDeck(id: number): Promise<Deck | undefined> {
    return db.decks.get(id);
  }

  async function addCardToDeck(
    deckId: number,
    card: Partial<ScryfallCard>,
    category: DeckCategory = "main",
    quantity: number = 1
  ): Promise<number> {
    const existing = await db.deckCards
      .where("deckId")
      .equals(deckId)
      .filter((dc) => dc.scryfallId === card.id && dc.category === category)
      .first();

    if (existing && existing.id !== undefined) {
      await db.deckCards.update(existing.id, { quantity: existing.quantity + quantity });
      await db.decks.update(deckId, { updatedAt: new Date().toISOString() });
      return existing.id;
    }

    const imageUri =
      card.image_uris?.normal ??
      card.card_faces?.[0]?.image_uris?.normal ??
      undefined;

    const id = await db.deckCards.add({
      deckId,
      scryfallId: card.id!,
      name: card.name!,
      quantity,
      category,
      manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost,
      cmc: card.cmc,
      typeLine: card.type_line,
      colors: card.colors ?? card.card_faces?.[0]?.colors,
      rarity: card.rarity,
      imageUri,
      priceUsd: card.prices?.usd,
    });

    const deck = await db.decks.get(deckId);
    if (deck && !deck.coverImageUri) {
      const artCrop =
        card.image_uris?.art_crop ??
        card.card_faces?.[0]?.image_uris?.art_crop ??
        imageUri;
      await db.decks.update(deckId, {
        coverCardId: card.id,
        coverImageUri: artCrop,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await db.decks.update(deckId, { updatedAt: new Date().toISOString() });
    }

    return id as number;
  }

  async function removeCardFromDeck(deckCardId: number) {
    const card = await db.deckCards.get(deckCardId);
    await db.deckCards.delete(deckCardId);
    if (card) {
      await db.decks.update(card.deckId, { updatedAt: new Date().toISOString() });
    }
  }

  async function updateCardQuantity(deckCardId: number, quantity: number) {
    if (quantity <= 0) {
      await removeCardFromDeck(deckCardId);
      return;
    }
    const card = await db.deckCards.get(deckCardId);
    await db.deckCards.update(deckCardId, { quantity });
    if (card) {
      await db.decks.update(card.deckId, { updatedAt: new Date().toISOString() });
    }
  }

  return {
    allDecks,
    allFolders,
    createDeck,
    updateDeck,
    deleteDeck,
    getDeck,
    addCardToDeck,
    removeCardFromDeck,
    updateCardQuantity,
  };
}

// Separate hook for deck cards — must be called at top level of a component
export function useDeckCards(deckId: number | undefined) {
  const db = getDb();
  return useLiveQuery(
    () => (deckId ? db.deckCards.where("deckId").equals(deckId).toArray() : []),
    [deckId]
  );
}
