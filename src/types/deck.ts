import type { Color, Rarity } from "./card";

export type DeckCategory = "main" | "sideboard" | "commander" | "companion" | "maybeboard";

export type MTGColor = "W" | "U" | "B" | "R" | "G" | "multi" | "colorless";

export interface DeckPrimerCard {
  name: string;
  note: string;
}

export interface DeckPrimerData {
  tagline: string;
  gamePlan: string;
  keyCards: DeckPrimerCard[];
  mulligan: string;
  keyLines: string[];
}

export interface Deck {
  id?: string;
  name: string;
  description?: string;
  format?: string;
  folderId?: string;
  coverCardId?: string;
  coverImageUri?: string;
  dominantColor?: MTGColor;
  colors?: string[];
  public?: boolean;
  primer?: DeckPrimerData | null;
  primerGeneratedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeckCard {
  id?: string;
  deckId: string;
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
  id?: string;
  name: string;
  parentId?: string;
  createdAt: string;
}

export interface DeckStats {
  totalCards: number;
  manaCurve: Record<number, { total: number; byColor: Record<string, number> }>;
  colorDistribution: Record<string, number>;
  typeBreakdown: Record<string, number>;
  rarityBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  landCount: number;
  nonlandCount: number;
  totalValue: number;
  averageCmc: number;
  topCards: { name: string; price: number; imageUri?: string }[];
  uniqueCards: number;
}
