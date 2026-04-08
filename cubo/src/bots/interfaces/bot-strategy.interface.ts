import { Game } from '../../game/interfaces/game.interface';
import { BotAction } from './bot-action.interface';
import { PermisoHabilidad } from '../../game/game.manager';

export interface BotStrategy {
  decidir(
    partida: Game,
    botId: string,
    contexto: PermisoHabilidad | null,
  ): BotAction;
}
