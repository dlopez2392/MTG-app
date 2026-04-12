export interface UserSettings {
  defaultSearchView: "grid" | "list";
  preferredCurrency: "usd" | "eur" | "tix";
  cardImageQuality: "small" | "normal" | "large";
  defaultStartingLife: number;
  defaultPlayerCount: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultSearchView: "grid",
  preferredCurrency: "usd",
  cardImageQuality: "normal",
  defaultStartingLife: 20,
  defaultPlayerCount: 2,
};
