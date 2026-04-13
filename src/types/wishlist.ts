export interface WishlistItem {
  id: string;
  scryfallId: string;
  name: string;
  imageUri?: string;
  typeLine?: string;
  manaCost?: string;
  rarity?: string;
  priceUsd?: string;      // cached at time of add
  targetPrice?: number;   // user-set alert threshold
  addedAt: string;        // ISO date
}
