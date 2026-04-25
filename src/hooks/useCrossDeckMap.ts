"use client";

import { useMemo } from "react";
import { useDecks } from "./useDecks";
import { useCollection } from "./useCollection";

export interface CardAllocation {
  scryfallId: string;
  name: string;
  imageUri?: string;
  ownedQty: number;
  totalNeeded: number;
  decks: { deckId: string; deckName: string; quantity: number }[];
  binders: { binderId: string; binderName: string; quantity: number }[];
  conflict: boolean;
}

export function useCrossDeckMap() {
  const { allDecks } = useDecks();
  const { allCards, allBinders } = useCollection();

  return useMemo(() => {
    const cardMap = new Map<string, CardAllocation>();

    const binderNameMap = new Map<string, string>();
    for (const b of allBinders) {
      if (b.id) binderNameMap.set(b.id, b.name);
    }

    for (const card of allCards) {
      const existing = cardMap.get(card.scryfallId);
      if (existing) {
        existing.ownedQty += card.quantity;
        const bEntry = existing.binders.find((b) => b.binderId === card.binderId);
        if (bEntry) bEntry.quantity += card.quantity;
        else existing.binders.push({
          binderId: card.binderId,
          binderName: binderNameMap.get(card.binderId) ?? "Unknown",
          quantity: card.quantity,
        });
      } else {
        cardMap.set(card.scryfallId, {
          scryfallId: card.scryfallId,
          name: card.name,
          imageUri: card.imageUri,
          ownedQty: card.quantity,
          totalNeeded: 0,
          decks: [],
          binders: [{
            binderId: card.binderId,
            binderName: binderNameMap.get(card.binderId) ?? "Unknown",
            quantity: card.quantity,
          }],
          conflict: false,
        });
      }
    }

    return { cardMap, allDecks, allBinders };
  }, [allCards, allBinders, allDecks]);
}
