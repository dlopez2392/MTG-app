export interface TradeCard {
  scryfallId: string;
  name: string;
  setCode: string;
  setName: string;
  imageUri: string;
  priceUsd: number | null;
  quantity: number;
  foil: boolean;
}

export interface Trade {
  id: string;
  name: string;
  date: string;
  offering: TradeCard[];
  receiving: TradeCard[];
  offeringTotal: number;
  receivingTotal: number;
  notes?: string;
}
