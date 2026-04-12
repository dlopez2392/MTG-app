import type { CardCondition } from "./collection";

export interface UserSettings {
  // Display
  defaultSearchView: "grid" | "list";
  cardImageQuality: "small" | "normal" | "large";
  defaultDeckSort: "name" | "mana_value" | "type" | "color";
  // Pricing
  preferredCurrency: "usd" | "eur" | "tix";
  // Life Counter
  defaultStartingLife: number;
  defaultPlayerCount: number;
  showPoisonCounters: boolean;
  perCommanderTracking: boolean;
  // Collection
  defaultCondition: CardCondition;
  defaultFoil: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultSearchView: "grid",
  cardImageQuality: "normal",
  defaultDeckSort: "mana_value",
  preferredCurrency: "usd",
  defaultStartingLife: 20,
  defaultPlayerCount: 2,
  showPoisonCounters: true,
  perCommanderTracking: false,
  defaultCondition: "near_mint",
  defaultFoil: false,
};
