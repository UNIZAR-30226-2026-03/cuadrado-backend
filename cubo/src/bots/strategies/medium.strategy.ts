import { Injectable } from '@nestjs/common';
import { BotManager } from '../bot.manager';
import { Game } from '../../game/interfaces/game.interface';
import { BotAction } from '../interfaces/bot-action.interface';
import { PermisoHabilidad } from '../../game/game.manager';

/**
 * Estrategia MEDIUM: IA que analiza su situación con información imperfecta
 * OBJETIVO: Minimizar puntos (quien MENOS tenga gana)
 * NO PUEDE: Ver cartas de otros (información incompleta)
 */
@Injectable()
export class MediumBotStrategy extends BotManager {
  decidir(
    partida: Game,
    botId: string,
    contexto: PermisoHabilidad | null,
  ): BotAction {
    const phase = partida.estadoGlobal.phase;
    const estado = this.obtenerEstadoBot(partida, botId);

    switch (phase) {
      case 'WAIT_DRAW':
        if (estado.habilidadesActivadas.includes(7)) {
          return { accion: 'jugador-menos-puntuacion' };
        }
        return { accion: 'robar' };

      case 'WAIT_DECISION':
        return this.decidirConPendiente(partida, botId);

      case 'WAIT_SKILL':
        return this.ejecutarHabilidad(partida, botId, contexto);

      default:
        return { accion: 'esperar' };
    }
  }

  /**
   * Decide sin ver cartas de otros (información imperfecta)
   * Solo observa: composición propia y carta pendiente
   */
  private decidirConPendiente(partida: Game, botId: string): BotAction {
    const estado = this.obtenerEstadoBot(partida, botId);
    const pendiente = estado.cartaPendiente;
    const mano = estado.cartasMano;

    if (!pendiente || !mano.length) {
      return { accion: 'descartar-pendiente' };
    }

    const esPendienteAlta = pendiente.puntos > 7;

    if (esPendienteAlta) {
      return { accion: 'descartar-pendiente' };
    }

    const indice = Math.floor(Math.random() * mano.length);
    return { accion: 'carta-por-pendiente', cartaIndex: indice };
  }

  /**
   * Ejecuta habilidades con decisiones simples y aleatorias.
   */
  private ejecutarHabilidad(
    partida: Game,
    botId: string,
    permiso: PermisoHabilidad | null,
  ): BotAction {
    if (!permiso) {
      return { accion: 'esperar' };
    }

    switch (permiso.tipo) {
      case 'ver-carta-propia': {
        const idEnPartida = this.obtenerIndiceJugador(partida, botId);
        const numeroCartasMano =
          partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;
        const indice = Math.floor(Math.random() * numeroCartasMano);
        return { accion: 'ver-carta', cartaIndex: indice };
      }

      case 'ver-carta-propia-y-rival': {
        const idEnPartida = this.obtenerIndiceJugador(partida, botId);
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) {
          return { accion: 'esperar' };
        }

        const numCartasJugador =
          partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;
        const cartaIndex = Math.floor(Math.random() * numCartasJugador);
        const rivalId = partida.estadoGlobal.turnoJugadores[rivalNum];
        const numCartasRival =
          partida.estadoGlobal.jugadores[rivalNum].cartasMano.length;
        const cartaIndexRival = Math.floor(Math.random() * numCartasRival);

        return {
          accion: 'ver-carta-propia-y-rival',
          cartaIndex,
          targetUserId: rivalId,
          cartaIndexTarget: cartaIndexRival,
        };
      }

      case 'intercambiar-carta': {
        const idEnPartida = this.obtenerIndiceJugador(partida, botId);
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) {
          return { accion: 'esperar' };
        }

        const numCartasJugador =
          partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;
        const cartaCambiar = Math.floor(Math.random() * numCartasJugador);
        const rivalId = partida.estadoGlobal.turnoJugadores[rivalNum];
        const numCartasRival =
          partida.estadoGlobal.jugadores[rivalNum].cartasMano.length;
        const cartaRival = Math.floor(Math.random() * numCartasRival);

        return {
          accion: 'intercambiar-carta',
          cartaIndex: cartaCambiar,
          targetUserId: rivalId,
          cartaIndexTarget: cartaRival,
        };
      }

      case 'intercambiar-todas': {
        const idEnPartida = this.obtenerIndiceJugador(partida, botId);
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) {
          return { accion: 'esperar' };
        }

        return {
          accion: 'intercambiar-todas-cartas',
          targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
        };
      }

      case 'hacer-robar-carta': {
        const idEnPartida = this.obtenerIndiceJugador(partida, botId);
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) {
          return { accion: 'esperar' };
        }

        return {
          accion: 'hacer-robar-carta',
          targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
        };
      }

      case 'proteger-carta': {
        const idEnPartida = this.obtenerIndiceJugador(partida, botId);
        const numeroCartasMano =
          partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;
        const cartaIndex = Math.floor(Math.random() * numeroCartasMano);
        return { accion: 'proteger-carta', cartaIndex };
      }

      case 'saltar-turno-jugador': {
        const idEnPartida = this.obtenerIndiceJugador(partida, botId);
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) {
          return { accion: 'esperar' };
        }

        return {
          accion: 'saltar-turno-jugador',
          targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
        };
      }

      case 'ver-carta-todos':
        return { accion: 'ver-carta-todos' };

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

    if (indicesRivales.length === 0) {
      return null;
    }

    const rivalPosicion = Math.floor(Math.random() * indicesRivales.length);
    return indicesRivales[rivalPosicion];
  }
}
