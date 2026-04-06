export type Color = "W" | "U" | "B" | "R" | "G";
export type Rarity = "common" | "uncommon" | "rare" | "mythic" | "special" | "bonus";
export type Legality = "legal" | "not_legal" | "restricted" | "banned";

export type Format =
  | "standard" | "pioneer" | "modern" | "legacy" | "vintage"
  | "commander" | "oathbreaker" | "brawl" | "historic"
  | "explorer" | "pauper" | "penny" | "alchemy" | "timeless";

export type CardLayout =
  | "normal" | "split" | "flip" | "transform" | "modal_dfc"
  | "meld" | "leveler" | "class" | "saga" | "adventure"
  | "mutate" | "prototype" | "battle" | "planar" | "scheme"
  | "vanguard" | "token" | "emblem" | "augment" | "host"
  | "art_series" | "reversible_card" | "case";

export interface ImageUris {
  small: string;
  normal: string;
  large: string;
  png: string;
  art_crop: string;
  border_crop: string;
}

export interface CardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  image_uris?: ImageUris;
  colors?: Color[];
}

export interface CardPrices {
  usd: string | null;
  usd_foil: string | null;
  usd_etched: string | null;
  eur: string | null;
  eur_foil: string | null;
  tix: string | null;
}

export interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  lang: string;
  layout: CardLayout;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors?: Color[];
  color_identity: Color[];
  keywords: string[];
  set: string;
  set_name: string;
  collector_number: string;
  rarity: Rarity;
  image_uris?: ImageUris;
  card_faces?: CardFace[];
  legalities: Record<string, Legality>;
  prices: CardPrices;
  prints_search_uri?: string;
  rulings_uri?: string;
  scryfall_uri: string;
  released_at?: string;
}

export interface ScryfallRuling {
  oracle_id: string;
  source: string;
  published_at: string;
  comment: string;
}

export interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  card_count: number;
  icon_svg_uri: string;
}

export interface ScryfallList<T> {
  object: "list";
  total_cards?: number;
  has_more: boolean;
  next_page?: string;
  data: T[];
}

export interface SearchFilters {
  query: string;
  colors: Color[];
  colorMode: "include" | "exact" | "at_most";
  type: string;
  rarity: Rarity | "";
  format: Format | "";
  set: string;
  cmc: string;
  cmcComparison: "=" | "<=" | ">=" | "<" | ">";
}

export const DEFAULT_FILTERS: SearchFilters = {
  query: "",
  colors: [],
  colorMode: "include",
  type: "",
  rarity: "",
  format: "",
  set: "",
  cmc: "",
  cmcComparison: "<=",
};
