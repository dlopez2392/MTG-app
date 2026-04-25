import type { DeckCard, DeckStats } from "@/types/deck";
import { parseManaCost } from "./mana";
import { getPriceValue } from "./prices";

export function calculateDeckStats(cards: DeckCard[]): DeckStats {
  const mainCards = cards.filter((c) => c.category === "main" || c.category === "commander");

  let totalCards = 0;
  let totalCmc = 0;
  let totalValue = 0;
  let landCount = 0;
  let nonlandCount = 0;
  const manaCurve: DeckStats["manaCurve"] = {};
  const colorDistribution: Record<string, number> = {};
  const typeBreakdown: Record<string, number> = {};
  const rarityBreakdown: Record<string, number> = {};
  const categoryBreakdown: Record<string, number> = {};
  const cardPrices: { name: string; price: number; imageUri?: string }[] = [];

  for (const card of cards) {
    const qty = card.quantity;
    categoryBreakdown[card.category] = (categoryBreakdown[card.category] || 0) + qty;
  }

  for (const card of mainCards) {
    const qty = card.quantity;
    totalCards += qty;
    totalCmc += (card.cmc || 0) * qty;
    const price = getPriceValue(card.priceUsd);
    totalValue += price * qty;

    if (price > 0) {
      cardPrices.push({ name: card.name, price: price * qty, imageUri: card.imageUri });
    }

    // Rarity
    if (card.rarity) {
      rarityBreakdown[card.rarity] = (rarityBreakdown[card.rarity] || 0) + qty;
    }

    // Land vs nonland
    const isLand = card.typeLine?.split("—")[0].includes("Land");
    if (isLand) landCount += qty;
    else nonlandCount += qty;

    // Mana curve (skip lands)
    if (!isLand) {
      const cmcBucket = Math.min(Math.floor(card.cmc || 0), 7);
      if (!manaCurve[cmcBucket]) {
        manaCurve[cmcBucket] = { total: 0, byColor: {} };
      }
      manaCurve[cmcBucket].total += qty;

      if (card.manaCost) {
        const symbols = parseManaCost(card.manaCost);
        for (const s of symbols) {
          if (["W", "U", "B", "R", "G"].includes(s)) {
            colorDistribution[s] = (colorDistribution[s] || 0) + qty;
            manaCurve[cmcBucket].byColor[s] = (manaCurve[cmcBucket].byColor[s] || 0) + qty;
          }
        }
      }
    }

    if (card.colors) {
      for (const c of card.colors) {
        colorDistribution[c] = (colorDistribution[c] || 0) + qty;
      }
    }

    // Type breakdown
    if (card.typeLine) {
      const mainType = card.typeLine.split("—")[0].trim();
      const types = ["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker", "Land", "Battle"];
      for (const t of types) {
        if (mainType.includes(t)) {
          typeBreakdown[t] = (typeBreakdown[t] || 0) + qty;
        }
      }
    }
  }

  cardPrices.sort((a, b) => b.price - a.price);

  return {
    totalCards,
    manaCurve,
    colorDistribution,
    typeBreakdown,
    rarityBreakdown,
    categoryBreakdown,
    landCount,
    nonlandCount,
    totalValue,
    averageCmc: totalCards > 0 ? totalCmc / totalCards : 0,
    topCards: cardPrices.slice(0, 5),
    uniqueCards: mainCards.length,
  };
}
