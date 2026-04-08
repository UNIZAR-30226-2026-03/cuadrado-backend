import { Injectable } from '@nestjs/common';
import { BotManager } from '../bot.manager';
import { Game } from '../../game/interfaces/game.interface';
import { BotAction } from '../interfaces/bot-action.interface';
import { PermisoHabilidad } from '../../game/game.manager';

/**
 * Estrategia HARD: IA avanzada con análisis de contexto
 * OBJETIVO: Minimizar puntos (quien MENOS tenga gana)
 * NO PUEDE: Ver cartas de otros jugadores (información imperfecta)
 * PUEDE: Observar número de cartas, fase del juego, estadísticas propias
 */
@Injectable()
export class HardBotStrategy extends BotManager {
  decidir(
    partida: Game,
    botId: string,
    _contexto: PermisoHabilidad | null,
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
   * Análisis contextual sin ver cartas de otros
   * Considera: composición de mano propia, cartas en mazo, fase del juego
   */
  private decidirConPendiente(partida: Game, botId: string): BotAction {
    const estado = this.obtenerEstadoBot(partida, botId);
    const pendiente = estado.cartaPendiente;
    const mano = estado.cartasMano;

    if (!pendiente || !mano) {
      return { accion: 'descartar-pendiente' };
    }

    // Análisis 1: Mis puntos actuales y composición
    const misPuntos = this.evaluarPuntosCartasMano(mano);
    const cartasEnMano = mano.length;
    const promedioPuntosEnMano = cartasEnMano > 0 ? misPuntos / cartasEnMano : 0;

    // Análisis 2: Número de cartas altas en mano
    const cartasAltas = mano.filter(c => c.puntos > 8);
    const cartasBajas = mano.filter(c => c.puntos <= 4);
    const proporcionAltas = cartasAltas.length / cartasEnMano;
    const proporcionBajas = cartasBajas.length / cartasEnMano;

    // Análisis 3: Fase del juego
    const mazosRestantes = partida.estadoGlobal.cartasVigentes.length;
    const esTempranoEnPartida = mazosRestantes > 30;
    const esFinEnPartida = mazosRestantes < 10;

    // Análisis 4: Evaluación de pendiente
    const pendienteEsAlta = pendiente.puntos > 8;
    const pendienteEsBaja = pendiente.puntos <= 4;
    const pendienteEsMedia = !pendienteEsAlta && !pendienteEsBaja;

    // ESTRATEGIA HARD: Decisiones basadas en análisis probabilístico

    // Situación 1: Mano desbalanceada (muchos altos) + pendiente baja = INTERCAMBIA
    if (proporcionAltas > 0.5 && pendienteEsBaja) {
      const cartaMasAlta = this.cartaMasAlta(mano);
      if (cartaMasAlta) {
        const indexAlta = this.obtenerIndiceCarta(estado, cartaMasAlta);
        return { accion: 'carta-por-pendiente', cartaIndex: indexAlta };
      }
    }

    // Situación 2: Mano desbalanceada (muchos altos) + pendiente alta = DESCARTA
    if (proporcionAltas > 0.5 && pendienteEsAlta) {
      return { accion: 'descartar-pendiente' };
    }

    // Situación 3: Mano bien balanceada
    if (proporcionAltas <= 0.4 && proporcionBajas >= 0.4) {
      // Si estoy al inicio: sé conservador (mantén buen estado)
      if (esTempranoEnPartida) {
        if (pendienteEsBaja && this.decisonAleatoria(0.6)) {
          // 60% probabilidad intercambiar si es beneficiosa
          const cartaMasAlta = this.cartaMasAlta(mano);
          if (cartaMasAlta) {
            const indexAlta = this.obtenerIndiceCarta(estado, cartaMasAlta);
            return { accion: 'carta-por-pendiente', cartaIndex: indexAlta };
          }
        }
        // 40% descarta
        return { accion: 'descartar-pendiente' };
      }

      // Si estoy al final: sé más agresivo (intenta mejorar)
      if (esFinEnPartida) {
        if (pendienteEsBaja && this.decisonAleatoria(0.8)) {
          // 80% intercambiar si es baja
          const cartaMasAlta = this.cartaMasAlta(mano);
          if (cartaMasAlta) {
            const indexAlta = this.obtenerIndiceCarta(estado, cartaMasAlta);
            return { accion: 'carta-por-pendiente', cartaIndex: indexAlta };
          }
        }
      }

      // Game normal (ni temp ni fin)
      if (pendienteEsBaja && this.decisonAleatoria(0.7)) {
        const cartaMasAlta = this.cartaMasAlta(mano);
        if (cartaMasAlta) {
          const indexAlta = this.obtenerIndiceCarta(estado, cartaMasAlta);
          return { accion: 'carta-por-pendiente', cartaIndex: indexAlta };
        }
      }
    }

    // Situación 4: Mano con muchas bajas (ideal) + pendiente media/alta = DESCARTA
    if (proporcionBajas > 0.6 && pendienteEsAlta) {
      return { accion: 'descartar-pendiente' };
    }

    // Default: descarta
    return { accion: 'descartar-pendiente' };
  }

  /**
   * Ejecuta habilidades
   */
  private ejecutarHabilidad(partida: Game, botId: string): BotAction {
    return { accion: 'esperar' };
  }
}
