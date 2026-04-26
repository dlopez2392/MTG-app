import type { DeckCard } from "@/types/deck";
import { getPriceValue } from "./prices";

export type GroupBy = "type" | "cmc" | "color" | "rarity" | "none";
export type SortBy = "name" | "cmc" | "price" | "color" | "type" | "rarity";
export type SortDir = "asc" | "desc";

export interface CardGroup {
  label: string;
  cards: DeckCard[];
  totalQty: number;
  totalPrice: number;
}

const TYPE_ORDER = [
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Battle",
  "Land",
  "Other",
];

const RARITY_ORDER = ["mythic", "rare", "uncommon", "common"];

const COLOR_ORDER: Record<string, number> = { W: 0, U: 1, B: 2, R: 3, G: 4, multi: 5, colorless: 6 };

function getCardType(typeLine?: string): string {
  if (!typeLine) return "Other";
  const t = typeLine.split("//")[0].trim().toLowerCase();
  if (t.includes("creature")) return "Creature";
  if (t.includes("planeswalker")) return "Planeswalker";
  if (t.includes("instant")) return "Instant";
  if (t.includes("sorcery")) return "Sorcery";
  if (t.includes("artifact")) return "Artifact";
  if (t.includes("enchantment")) return "Enchantment";
  if (t.includes("battle")) return "Battle";
  if (t.includes("land")) return "Land";
  return "Other";
}

function getColorLabel(colors?: string[]): string {
  if (!colors || colors.length === 0) return "Colorless";
  if (colors.length > 1) return "Multicolor";
  const map: Record<string, string> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
  return map[colors[0]] ?? "Colorless";
}

function getColorSortKey(colors?: string[]): number {
  if (!colors || colors.length === 0) return 6;
  if (colors.length > 1) return 5;
  return COLOR_ORDER[colors[0]] ?? 6;
}

function getRarityLabel(rarity?: string): string {
  if (!rarity) return "Common";
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function buildGroup(label: string, cards: DeckCard[]): CardGroup {
  return {
    label,
    cards,
    totalQty: cards.reduce((s, c) => s + c.quantity, 0),
    totalPrice: cards.reduce((s, c) => s + getPriceValue(c.priceUsd) * c.quantity, 0),
  };
}

export function groupCards(cards: DeckCard[], groupBy: GroupBy): CardGroup[] {
  if (groupBy === "none") {
    return [buildGroup("All Cards", cards)];
  }

  const map = new Map<string, DeckCard[]>();

  for (const card of cards) {
    let key: string;
    switch (groupBy) {
      case "type":
        key = getCardType(card.typeLine);
        break;
      case "cmc":
        key = String(card.cmc ?? 0);
        break;
      case "color":
        key = getColorLabel(card.colors as string[] | undefined);
        break;
      case "rarity":
        key = getRarityLabel(card.rarity);
        break;
    }
    const arr = map.get(key) ?? [];
    arr.push(card);
    map.set(key, arr);
  }

  const groups = Array.from(map.entries()).map(([label, cards]) => buildGroup(label, cards));

  switch (groupBy) {
    case "type":
      groups.sort((a, b) => TYPE_ORDER.indexOf(a.label) - TYPE_ORDER.indexOf(b.label));
      break;
    case "cmc":
      groups.sort((a, b) => Number(a.label) - Number(b.label));
      for (const g of groups) g.label = `CMC ${g.label}`;
      break;
    case "color":
      groups.sort((a, b) => {
        const colorKeys: Record<string, number> = { White: 0, Blue: 1, Black: 2, Red: 3, Green: 4, Multicolor: 5, Colorless: 6 };
        return (colorKeys[a.label] ?? 7) - (colorKeys[b.label] ?? 7);
      });
      break;
    case "rarity":
      groups.sort((a, b) => RARITY_ORDER.indexOf(a.label.toLowerCase()) - RARITY_ORDER.indexOf(b.label.toLowerCase()));
      break;
  }

  return groups;
}

export function sortCards(cards: DeckCard[], sortBy: SortBy, dir: SortDir): DeckCard[] {
  const sorted = [...cards];
  const m = dir === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sortBy) {
      case "name":
        return m * a.name.localeCompare(b.name);
      case "cmc":
        return m * ((a.cmc ?? 0) - (b.cmc ?? 0));
      case "price":
        return m * (getPriceValue(a.priceUsd) - getPriceValue(b.priceUsd));
      case "color":
        return m * (getColorSortKey(a.colors as string[] | undefined) - getColorSortKey(b.colors as string[] | undefined));
      case "type":
        return m * (TYPE_ORDER.indexOf(getCardType(a.typeLine)) - TYPE_ORDER.indexOf(getCardType(b.typeLine)));
      case "rarity": {
        const ai = RARITY_ORDER.indexOf(a.rarity ?? "common");
        const bi = RARITY_ORDER.indexOf(b.rarity ?? "common");
        return m * (ai - bi);
      }
      default:
        return 0;
    }
  });

  return sorted;
}
