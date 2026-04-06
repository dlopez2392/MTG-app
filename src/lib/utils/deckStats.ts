import type { DeckCard, DeckStats } from "@/types/deck";
import { parseManaCost } from "./mana";
import { getPriceValue } from "./prices";

export function calculateDeckStats(cards: DeckCard[]): DeckStats {
  const mainCards = cards.filter((c) => c.category === "main" || c.category === "commander");

  let totalCards = 0;
  let totalCmc = 0;
  let totalValue = 0;
  const manaCurve: DeckStats["manaCurve"] = {};
  const colorDistribution: Record<string, number> = {};
  const typeBreakdown: Record<string, number> = {};

  for (const card of mainCards) {
    const qty = card.quantity;
    totalCards += qty;
    totalCmc += (card.cmc || 0) * qty;
    totalValue += getPriceValue(card.priceUsd) * qty;

    // Mana curve
    const cmcBucket = Math.min(Math.floor(card.cmc || 0), 7);
    if (!manaCurve[cmcBucket]) {
      manaCurve[cmcBucket] = { total: 0, byColor: {} };
    }
    manaCurve[cmcBucket].total += qty;

    // Color distribution from mana cost
    if (card.manaCost) {
      const symbols = parseManaCost(card.manaCost);
      for (const s of symbols) {
        if (["W", "U", "B", "R", "G"].includes(s)) {
          colorDistribution[s] = (colorDistribution[s] || 0) + qty;
          manaCurve[cmcBucket].byColor[s] = (manaCurve[cmcBucket].byColor[s] || 0) + qty;
        }
      }
    }

    // Also track by card colors
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

  return {
    totalCards,
    manaCurve,
    colorDistribution,
    typeBreakdown,
    totalValue,
    averageCmc: totalCards > 0 ? totalCmc / totalCards : 0,
  };
}
