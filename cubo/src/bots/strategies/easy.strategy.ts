import { Injectable } from '@nestjs/common';
import { BotManager } from '../bot.manager';
import { Game } from '../../game/interfaces/game.interface';
import { BotAction } from '../interfaces/bot-action.interface';
import { PermisoHabilidad } from '../../game/game.manager';

/**
 * Estrategia EASY: IA predecible, toma decisiones simples y aleatorias
 * OBJETIVO: Minimizar puntos (quien MENOS puntos tenga gana)
 */
@Injectable()
export class EasyBotStrategy extends BotManager {
  decidir(
    partida: Game,
    botId: string,
    contexto: PermisoHabilidad | null,
  ): BotAction {
    const phase = partida.estadoGlobal.phase;

    switch (phase) {
      case 'WAIT_DRAW':
        return { accion: 'robar' };

      case 'WAIT_DECISION':
        return this.decidirConPendiente(partida, botId);

      case 'WAIT_SKILL':
        return this.ejecutarHabilidad(partida, botId);

      default:
        return { accion: 'esperar' };
    }
  }

  /**
   * Decide si descartar o intercambiar la carta robada.
   * Objetivo: MINIMIZAR puntos en mano
   * Lógica: 70% descarta, 30% intercambia por carta baja (información solo propia)
   */
  private decidirConPendiente(partida: Game, botId: string): BotAction {
    const estado = this.obtenerEstadoBot(partida, botId);
    const pendiente = estado.cartaPendiente;
    const mano = estado.cartasMano;

    if (!pendiente || !mano) {
      this.logger.warn(`Bot ${botId} no tiene carta pendiente o mano válida`);
      return { accion: 'descartar-pendiente' };
    }

    // Estrategia EASY: 70% descartar, 30% intercambiar (es simple y predecible)
    // No ve cartas de otros, solo juega con información propia
    if (this.decisonAleatoria(0.7)) {
      return { accion: 'descartar-pendiente' };
    }

    // 30% de veces: intercambia por la carta más baja de mano
    // (intenta agregar una carta baja)
    const cartaMasBaja = this.cartaMasBaja(mano);
    if (!cartaMasBaja) {
      return { accion: 'descartar-pendiente' };
    }

    const indexBaja = this.obtenerIndiceCarta(estado, cartaMasBaja);
    return { accion: 'carta-por-pendiente', cartaIndex: indexBaja };
  }

  /**
   * Ejecuta habilidades
   */
  private ejecutarHabilidad(partida: Game, botId: string): BotAction {
    return { accion: 'esperar' };
  }
}
