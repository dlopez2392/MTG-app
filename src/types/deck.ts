import type { Color, Rarity } from "./card";

export type DeckCategory = "main" | "sideboard" | "commander" | "companion" | "maybeboard";

export interface Deck {
  id?: number;
  name: string;
  description?: string;
  format?: string;
  folderId?: number;
  coverCardId?: string;
  coverImageUri?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeckCard {
  id?: number;
  deckId: number;
  scryfallId: string;
  name: string;
  quantity: number;
  category: DeckCategory;
  manaCost?: string;
  cmc?: number;
  typeLine?: string;
  colors?: Color[];
  rarity?: Rarity;
  imageUri?: string;
  priceUsd?: string | null;
}

export interface DeckFolder {
  id?: number;
  name: string;
  parentId?: number;
  createdAt: string;
}

export interface DeckStats {
  totalCards: number;
  manaCurve: Record<number, { total: number; byColor: Record<string, number> }>;
  colorDistribution: Record<string, number>;
  typeBreakdown: Record<string, number>;
  totalValue: number;
  averageCmc: number;
}
