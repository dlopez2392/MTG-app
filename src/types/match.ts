export interface MatchPlayer {
  id?: number;
  playerName: string;
  color: string;
  startingLife: number;
  finalLife: number;
  poisonTotal: number;
  commanderDmg: number;
  isWinner: boolean;
  playerOrder: number;
}

export interface Match {
  id: number;
  startedAt: string;
  endedAt: string | null;
  durationSecs: number | null;
  startingLife: number;
  playerCount: number;
  format: string | null;
  notes: string | null;
  createdAt: string;
  players: MatchPlayer[];
}

export interface CreateMatchPayload {
  startedAt: string;
  endedAt: string;
  durationSecs: number;
  startingLife: number;
  playerCount: number;
  format?: string;
  notes?: string;
  players: Omit<MatchPlayer, "id">[];
}
