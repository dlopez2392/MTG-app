import { cache } from "react";
import { getSupabase } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PublicDeckCard {
  scryfallId: string;
  name: string;
  quantity: number;
  category: string;
  manaCost?: string;
  cmc?: number;
  typeLine?: string;
  rarity?: string;
  imageUri?: string;
  priceUsd?: string | null;
}

export interface PublicDeck {
  name: string;
  format: string | null;
  coverImageUri: string | null;
  updatedAt: string;
  cards: PublicDeckCard[];
}

/** Fetch a deck for public display. Returns null unless the deck exists AND is public. */
export const getPublicDeck = cache(async (id: string): Promise<PublicDeck | null> => {
  if (!UUID_RE.test(id)) return null;

  const sb = getSupabase();
  const { data: deck, error } = await sb
    .from("decks")
    .select("name, format, cover_image_uri, updated_at, public")
    .eq("id", id)
    .single();
  if (error || !deck || deck.public !== true) return null;

  const { data: cards } = await sb
    .from("deck_cards")
    .select("scryfall_id, name, quantity, category, mana_cost, cmc, type_line, rarity, image_uri, price_usd")
    .eq("deck_id", id);

  return {
    name: deck.name as string,
    format: (deck.format as string | null) ?? null,
    coverImageUri: (deck.cover_image_uri as string | null) ?? null,
    updatedAt: deck.updated_at as string,
    cards: (cards ?? []).map((c) => ({
      scryfallId: c.scryfall_id as string,
      name: c.name as string,
      quantity: (c.quantity as number) ?? 1,
      category: (c.category as string) ?? "main",
      manaCost: (c.mana_cost as string) ?? undefined,
      cmc: (c.cmc as number) ?? undefined,
      typeLine: (c.type_line as string) ?? undefined,
      rarity: (c.rarity as string) ?? undefined,
      imageUri: (c.image_uri as string) ?? undefined,
      priceUsd: (c.price_usd as string | null) ?? null,
    })),
  };
});
