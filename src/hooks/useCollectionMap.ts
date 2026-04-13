"use client";

import { useMemo } from "react";
import { useCollection } from "./useCollection";

/**
 * Returns a Map<scryfallId, totalOwnedQuantity> aggregated across all binders.
 * Lightweight — just derives from the existing allCards state.
 */
export function useCollectionMap(): Map<string, number> {
  const { allCards } = useCollection();

  return useMemo(() => {
    const map = new Map<string, number>();
    for (const card of allCards) {
      map.set(card.scryfallId, (map.get(card.scryfallId) ?? 0) + card.quantity);
    }
    return map;
  }, [allCards]);
}
