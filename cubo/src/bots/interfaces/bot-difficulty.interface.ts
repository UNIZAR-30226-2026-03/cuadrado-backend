export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface BotConfig {
  difficulty: BotDifficulty;
  botId: string;
}
