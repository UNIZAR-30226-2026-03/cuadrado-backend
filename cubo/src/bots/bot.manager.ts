import { Logger } from '@nestjs/common';
import { Game } from '../game/interfaces/game.interface';
import { Card } from '../game/interfaces/card.interface';
import { PlayerState } from '../game/interfaces/game.interface';
import { BotAction } from './interfaces/bot-action.interface';
import { BotStrategy } from './interfaces/bot-strategy.interface';
import { PermisoHabilidad } from '../game/game.manager';

export abstract class BotManager implements BotStrategy {
  protected logger = new Logger(this.constructor.name);

  abstract decidir(
    partida: Game,
    botId: string,
    contexto: PermisoHabilidad | null,
  ): BotAction;

  /**
   * Obtiene el estado del bot en la partida
   */
  protected obtenerEstadoBot(partida: Game, botId: string): PlayerState {
    const idEnPartida = this.obtenerIndiceJugador(partida, botId);
    return partida.estadoGlobal.jugadores[idEnPartida];
  }

  /**
   * Obtiene el índice del jugador en la partida
   */
  protected obtenerIndiceJugador(partida: Game, userId: string): number {
    const index = partida.estadoGlobal.turnoJugadores.indexOf(userId);
    if (index === -1) {
      throw new Error(`Jugador ${userId} no encontrado en la partida`);
    }
    return index;
  }

  /**
   * Evalúa los puntos totales de un conjunto de cartas
   */
  protected evaluarPuntosCartasMano(cartas: Card[]): number {
    return cartas.reduce((sum, c) => sum + (c.puntos || 0), 0);
  }

  /**
   * Obtiene el promedio de puntos por carta
   */
  protected obtenerPromedioPuntos(cartas: Card[]): number {
    if (cartas.length === 0) return 0;
    return this.evaluarPuntosCartasMano(cartas) / cartas.length;
  }

  /**
   * Encuentra la carta con más puntos en un array
   */
  protected cartaMasAlta(cartas: Card[]): Card | null {
    if (cartas.length === 0) return null;
    return cartas.reduce((max, c) => (c.puntos || 0) > (max.puntos || 0) ? c : max);
  }

  /**
   * Encuentra la carta con menos puntos en un array
   */
  protected cartaMasBaja(cartas: Card[]): Card | null {
    if (cartas.length === 0) return null;
    return cartas.reduce((min, c) => (c.puntos || 0) < (min.puntos || 0) ? c : min);
  }

  /**
   * Obtiene el índice de una carta en la mano del bot
   */
  protected obtenerIndiceCarta(estado: PlayerState, carta: Card): number {
    return estado.cartasMano.indexOf(carta);
  }


  /**
   * Cantidad de jugadores en la partida
   */
  protected contarJugadores(partida: Game): number {
    return partida.estadoGlobal.turnoJugadores.length;
  }

  /**
   * Verifica si un jugador es un bot
   */
  protected esBot(userId: string): boolean {
    return userId.startsWith('bot_');
  }

  /**
   * Extrae la dificultad del ID del bot
   * Formato: "bot_ROOMCODE_DIFFICULTY_INDEX"
   */
  protected extraerDificultad(botId: string): string {
    const partes = botId.split('_');
    return partes.length >= 3 ? partes[2] : 'easy';
  }

  /**
   * Decisión aleatoria con probabilidad
   */
  protected decisonAleatoria(probabilidad: number = 0.5): boolean {
    return Math.random() < probabilidad;
  }
}
