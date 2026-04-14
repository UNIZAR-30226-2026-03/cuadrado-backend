export const MAX_PLAYERS = 8;
export const DEFAULT_DECK_COUNT = 2;
export const AVAILABLE_POWERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export interface RulesConfig {
  maxPlayers: number;
  turnTimeSeconds: number;
  isPrivate: boolean;
  fillWithBots: boolean;
  deckCount: 1 | 2;
  enabledPowers: number[];
}
