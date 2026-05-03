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
    if (contexto?.tipo === 'decidir-intercambio-j') {
      return { accion: 'resolver-j', intercambiar: true };
    }

    const phase = partida.estadoGlobal.phase;

    switch (phase) {
      case 'WAIT_DRAW': {
        const estadoBot = this.obtenerEstadoBot(partida, botId);
        if (estadoBot.habilidadesActivadas.includes(7)) {
          return { accion: 'jugador-menos-puntuacion' };
        }
        return { accion: 'robar' };
      }

      case 'WAIT_DECISION':
        return this.decidirConPendiente(partida, botId);

      case 'WAIT_SKILL':
        return this.ejecutarHabilidad(partida, botId, contexto);

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
   * Ejecuta habilidades con decisiones aleatorias simples.
   */
  private ejecutarHabilidad(
    partida: Game,
    botId: string,
    permiso: PermisoHabilidad | null,
  ): BotAction {
    if (!permiso) {
      return { accion: 'esperar' };
    }

    const idEnPartida = this.obtenerIndiceJugador(partida, botId);
    const numCartasPropia =
      partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;

    switch (permiso.tipo) {
      case 'ver-carta-rival': {
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) return { accion: 'esperar' };
        const numCartasRival =
          partida.estadoGlobal.jugadores[rivalNum].cartasMano.length;
        if (numCartasRival === 0) return { accion: 'esperar' };
        return {
          accion: 'ver-carta-rival',
          targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
          cartaIndexTarget: Math.floor(Math.random() * numCartasRival),
        };
      }

      case 'ver-carta-propia':
        return {
          accion: 'ver-carta',
          cartaIndex: Math.floor(Math.random() * numCartasPropia),
        };

      case 'ver-carta-propia-y-rival': {
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) return { accion: 'esperar' };
        const numCartasRival =
          partida.estadoGlobal.jugadores[rivalNum].cartasMano.length;
        return {
          accion: 'ver-carta-propia-y-rival',
          cartaIndex: Math.floor(Math.random() * numCartasPropia),
          targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
          cartaIndexTarget: Math.floor(Math.random() * numCartasRival),
        };
      }

      case 'intercambiar-carta': {
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) return { accion: 'esperar' };
        const numCartasRival =
          partida.estadoGlobal.jugadores[rivalNum].cartasMano.length;
        return {
          accion: 'intercambiar-carta',
          cartaIndex: Math.floor(Math.random() * numCartasPropia),
          targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
          cartaIndexTarget: Math.floor(Math.random() * numCartasRival),
        };
      }

      case 'intercambiar-todas': {
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) return { accion: 'esperar' };
        return {
          accion: 'intercambiar-todas-cartas',
          targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
        };
      }

      case 'hacer-robar-carta': {
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) return { accion: 'esperar' };
        return {
          accion: 'hacer-robar-carta',
          targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
        };
      }

      case 'proteger-carta':
        return {
          accion: 'proteger-carta',
          cartaIndex: Math.floor(Math.random() * numCartasPropia),
        };

      case 'saltar-turno-jugador': {
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) return { accion: 'esperar' };
        return {
          accion: 'saltar-turno-jugador',
          targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
        };
      }

      case 'decidir-intercambio-j':
        return { accion: 'resolver-j', intercambiar: true };

      default:
        return { accion: 'esperar' };
    }
  }

  private obtenerIndiceRivalAleatorio(
    partida: Game,
    idEnPartida: number,
  ): number | null {
    const indicesRivales = partida.estadoGlobal.turnoJugadores
      .map((_, index) => index)
      .filter((index) => index !== idEnPartida);

    if (indicesRivales.length === 0) return null;

    return indicesRivales[Math.floor(Math.random() * indicesRivales.length)];
  }
}
