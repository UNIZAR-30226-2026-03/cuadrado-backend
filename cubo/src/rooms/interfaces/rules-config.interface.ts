export const MAX_PLAYERS = 8;
export const DEFAULT_DECK_COUNT = 2;
export const AVAILABLE_POWERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const ROOM_BOT_DIFFICULTIES = ['media', 'dificil'] as const;
export const DEFAULT_ROOM_BOT_DIFFICULTY = 'media';

export type RoomBotDifficulty = (typeof ROOM_BOT_DIFFICULTIES)[number];

export interface RulesConfig {
  maxPlayers: number;
  turnTimeSeconds: number;
  isPrivate: boolean;
  fillWithBots: boolean;
  dificultadBots?: RoomBotDifficulty;
  deckCount: 1 | 2;
  enabledPowers: number[];
}
