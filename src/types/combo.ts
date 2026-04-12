import type { ScryfallCard } from "./card";

export interface ComboCard {
  name: string;
  zoneLocations: string[]; // "H"=Hand, "B"=Battlefield, "G"=Graveyard, "E"=Exile, "L"=Library, "C"=Command
  mustBeCommander: boolean;
  scryfall?: ScryfallCard;
}

export interface EnrichedCombo {
  id: string;
  cards: ComboCard[];
  produces: string[];   // feature names e.g. "Infinite Mana", "Win the Game"
  description: string;  // step-by-step instructions
  notes: string;
  popularity: number | null;
}

export interface CombosResponse {
  combos: EnrichedCombo[];
  count: number;
}
