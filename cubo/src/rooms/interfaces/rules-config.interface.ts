export const MAX_PLAYERS = 8;

export interface RulesConfig {
  maxPlayers: number;
  turnTimeSeconds: number;
  isPrivate: boolean;
  fillWithBots: boolean;
}
