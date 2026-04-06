export interface Player {
  id: string;
  name: string;
  color: string;
  life: number;
  poisonCounters: number;
  commanderDamage: Record<string, number>;
}

export type LifeEventType = "life" | "poison" | "commander_damage";

export interface LifeEvent {
  timestamp: number;
  playerId: string;
  type: LifeEventType;
  delta: number;
  sourcePlayerId?: string;
  resultingValue: number;
}

export interface LifeGame {
  id?: number;
  players: Player[];
  events: LifeEvent[];
  startingLife: number;
  playerCount: number;
  createdAt: string;
  endedAt?: string;
}
