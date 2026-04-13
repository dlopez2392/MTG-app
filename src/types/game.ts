export type GameResult = "win" | "loss" | "draw";

export interface GameEntry {
  id: string;
  date: string;          // ISO date string
  deckId?: string;
  deckName: string;
  result: GameResult;
  format?: string;
  playerCount: number;   // 2–8
  notes?: string;
  opponentNames?: string; // comma-separated, optional
}
