export const MTG_COLORS = [
  { code: "W", name: "White", hex: "#F9FAF4", bg: "#F8F6D8" },
  { code: "U", name: "Blue", hex: "#0E68AB", bg: "#0E68AB" },
  { code: "B", name: "Black", hex: "#150B00", bg: "#3D3229" },
  { code: "R", name: "Red", hex: "#D3202A", bg: "#D3202A" },
  { code: "G", name: "Green", hex: "#00733E", bg: "#00733E" },
] as const;

export type ColorCode = (typeof MTG_COLORS)[number]["code"];

export const RARITIES = [
  { value: "common", label: "Common", color: "#9CA3AF" },
  { value: "uncommon", label: "Uncommon", color: "#C0C0C0" },
  { value: "rare", label: "Rare", color: "#D4A843" },
  { value: "mythic", label: "Mythic", color: "#D3202A" },
] as const;

export const FORMATS = [
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "commander",
  "oathbreaker",
  "brawl",
  "historic",
  "explorer",
  "pauper",
  "penny",
  "alchemy",
  "timeless",
] as const;

export const CARD_TYPES = [
  "Creature",
  "Instant",
  "Sorcery",
  "Enchantment",
  "Artifact",
  "Planeswalker",
  "Land",
  "Battle",
] as const;

export const CONDITIONS = [
  { value: "mint", label: "Mint" },
  { value: "near_mint", label: "Near Mint" },
  { value: "lightly_played", label: "Lightly Played" },
  { value: "moderately_played", label: "Moderately Played" },
  { value: "heavily_played", label: "Heavily Played" },
  { value: "damaged", label: "Damaged" },
] as const;

export const PLAYER_COLORS = [
  "#EF4444", // Red
  "#3B82F6", // Blue
  "#22C55E", // Green
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
] as const;

// MTG color identity options for the life counter
export const MTG_PLAYER_COLORS = [
  { key: "W", label: "White", color: "#D4C26A", mtgQuery: "w" },
  { key: "U", label: "Blue",  color: "#3B82F6", mtgQuery: "u" },
  { key: "B", label: "Black", color: "#8B5CF6", mtgQuery: "b" },
  { key: "R", label: "Red",   color: "#EF4444", mtgQuery: "r" },
  { key: "G", label: "Green", color: "#22C55E", mtgQuery: "g" },
] as const;

export type MtgPlayerColorKey = (typeof MTG_PLAYER_COLORS)[number]["key"];

// Default color per player slot
export const DEFAULT_PLAYER_COLOR_KEYS: MtgPlayerColorKey[] = ["R", "U", "G", "W", "B", "R"];
