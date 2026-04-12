import type { Rarity } from "./card";

export type CardCondition =
  | "mint"
  | "near_mint"
  | "lightly_played"
  | "moderately_played"
  | "heavily_played"
  | "damaged";

export interface Binder {
  id?: string;
  name: string;
  description?: string;
  coverImageUri?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionCard {
  id?: string;
  binderId: string;
  scryfallId: string;
  name: string;
  quantity: number;
  condition: CardCondition;
  isFoil: boolean;
  notes?: string;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  imageUri?: string;
  priceUsd?: string | null;
  typeLine?: string;
  rarity?: Rarity;
}

export interface CollectionSummary {
  totalCards: number;
  totalUniqueCards: number;
  totalValue: number;
  binderCount: number;
  colorBreakdown: Record<string, number>;
}
