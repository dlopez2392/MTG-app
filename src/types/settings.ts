export interface UserSettings {
  defaultSearchView: "grid" | "list";
  preferredCurrency: "usd" | "eur" | "tix";
  showPricesInDecks: boolean;
  cardImageQuality: "small" | "normal" | "large";
  defaultStartingLife: number;
  defaultPlayerCount: number;
  defaultFormat: string;
  lastOpenedTab: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultSearchView: "grid",
  preferredCurrency: "usd",
  showPricesInDecks: true,
  cardImageQuality: "normal",
  defaultStartingLife: 20,
  defaultPlayerCount: 2,
  defaultFormat: "",
  lastOpenedTab: "/search",
};
