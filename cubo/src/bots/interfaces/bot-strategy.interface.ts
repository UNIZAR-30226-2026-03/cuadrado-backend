import { Game } from '../../game/interfaces/game.interface';
import { BotAction } from './bot-action.interface';

export interface BotStrategy {
  decidir(partida: Game, botId: string): BotAction;
}
