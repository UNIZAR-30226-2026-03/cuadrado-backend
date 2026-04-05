import { Injectable } from '@nestjs/common';
import { BotManager } from '../bot.manager';
import { Game } from '../../game/interfaces/game.interface';
import { BotAction } from '../interfaces/bot-action.interface';

/**
 * Estrategia MEDIUM: IA que analiza su situación con información imperfecta
 * OBJETIVO: Minimizar puntos (quien MENOS tenga gana)
 * NO PUEDE: Ver cartas de otros (información incompleta)
 */
@Injectable()
export class MediumBotStrategy extends BotManager {
  decidir(partida: Game, botId: string): BotAction {
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
   * Decide sin ver cartas de otros (información imperfecta)
   * Solo observa: composición propia, número de jugadores, fase del juego
   */
  private decidirConPendiente(partida: Game, botId: string): BotAction {
    const estado = this.obtenerEstadoBot(partida, botId);
    const pendiente = estado.cartaPendiente;
    const mano = estado.cartasMano;

    if (!pendiente || !mano) {
      return { accion: 'descartar-pendiente' };
    }

    // Análisis 1: Evaluación de la carta pendiente
    const esPendienteAlta = pendiente.puntos > 8; // Cartas 9+ son problemáticas
    const esPendienteBaja = pendiente.puntos <= 4;

    // Análisis 2: Composición de mano
    const misPuntos = this.evaluarPuntosCartasMano(mano);
    const cartasAltas = mano.filter(c => c.puntos > 8);
    const tengoMuchosAltos = cartasAltas.length >= 3;

    // Análisis 3: Contexto del juego
    const numJugadores = this.contarJugadores(partida);
    const mazosRestantes = partida.estadoGlobal.cartasVigentes.length;
    const esTempranoEnPartida = mazosRestantes > 30;

    // ESTRATEGIA MEDIUM:
    // Regla 1: Si pendiente es alta Y tengo cartas altas → DESCARTA (reduce puntos)
    if (esPendienteAlta && tengoMuchosAltos) {
      return { accion: 'descartar-pendiente' };
    }

    // Regla 2: Si pendiente es baja → INTENTA INTERCAMBIAR (mejora mano)
    if (esPendienteBaja) {
      const cartaMasBaja = this.cartaMasBaja(mano);
      if (cartaMasBaja) {
        const indexBaja = this.obtenerIndiceCarta(estado, cartaMasBaja);
        return { accion: 'carta-por-pendiente', cartaIndex: indexBaja };
      }
    }

    // Regla 3: Contexto early/late game
    if (esTempranoEnPartida) {
      // Al inicio: sé más conservador (70% descarta)
      if (this.decisonAleatoria(0.7)) {
        return { accion: 'descartar-pendiente' };
      }
    } else {
      // Al final: sé más agresivo (más probabilidad intercambiar)
      if (this.decisonAleatoria(0.4)) {
        return { accion: 'descartar-pendiente' };
      }
    }

    // Regla 4: Si nada de lo anterior → analiza puntos totales
    // Si tengo muchos puntos → intenta descartar cartas
    if (misPuntos > 20) {
      return { accion: 'descartar-pendiente' };
    }

    return { accion: 'descartar-pendiente' };
  }

  /**
   * Ejecuta habilidades
   */
  private ejecutarHabilidad(partida: Game, botId: string): BotAction {
    return { accion: 'esperar' };
  }
}
