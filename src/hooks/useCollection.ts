"use client";

import { db } from "@/lib/db/index";
import { useLiveQuery } from "dexie-react-hooks";
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

export function useCollection(binderId?: number) {
  const allBinders = useLiveQuery(() => db.binders.toArray(), []);

  const binderCards = useLiveQuery(
    () =>
      binderId !== undefined
        ? db.collectionCards.where("binderId").equals(binderId).toArray()
        : [],
    [binderId]
  );

  async function createBinder(name: string): Promise<number> {
    const now = new Date().toISOString();
    const id = await db.binders.add({
      name,
      createdAt: now,
      updatedAt: now,
    });
    return id as number;
  }

  async function deleteBinder(id: number) {
    await db.transaction("rw", db.binders, db.collectionCards, async () => {
      await db.collectionCards.where("binderId").equals(id).delete();
      await db.binders.delete(id);
    });
  }

  async function addCardToBinder(
    targetBinderId: number,
    card: AddCardParams
  ): Promise<number> {
    const existing = await db.collectionCards
      .where("binderId")
      .equals(targetBinderId)
      .and(
        (c) =>
          c.scryfallId === card.scryfallId &&
          c.isFoil === (card.isFoil ?? false)
      )
      .first();

    if (existing && existing.id !== undefined) {
      await db.collectionCards.update(existing.id, {
        quantity: existing.quantity + (card.quantity ?? 1),
      });
      return existing.id;
    }

    const newId = await db.collectionCards.add({
      binderId: targetBinderId,
      scryfallId: card.scryfallId,
      name: card.name,
      quantity: card.quantity ?? 1,
      condition: card.condition ?? "near_mint",
      isFoil: card.isFoil ?? false,
      setCode: card.setCode,
      setName: card.setName,
      collectorNumber: card.collectorNumber,
      imageUri: card.imageUri,
      priceUsd: card.priceUsd,
      typeLine: card.typeLine,
      rarity: card.rarity,
    });

    await db.binders.update(targetBinderId, {
      updatedAt: new Date().toISOString(),
    });

    return newId as number;
  }

  async function removeFromCollection(id: number) {
    await db.collectionCards.delete(id);
  }

  async function updateQuantity(id: number, qty: number) {
    if (qty <= 0) {
      await db.collectionCards.delete(id);
    } else {
      await db.collectionCards.update(id, { quantity: qty });
    }
  }

  async function getBinderCards(
    targetBinderId: number
  ): Promise<CollectionCard[]> {
    return db.collectionCards
      .where("binderId")
      .equals(targetBinderId)
      .toArray();
  }

  return {
    allBinders: allBinders ?? [],
    binderCards: binderCards ?? [],
    createBinder,
    deleteBinder,
    addCardToBinder,
    removeFromCollection,
    updateQuantity,
    getBinderCards,
  };
}
