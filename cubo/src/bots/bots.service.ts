import { Injectable, Inject, Logger } from '@nestjs/common';
import type { BotAction } from './interfaces/bot-action.interface';
import type { BotStrategy } from './interfaces/bot-strategy.interface';
import type { BotDifficulty } from './interfaces/bot-difficulty.interface';
import { Game } from '../game/interfaces/game.interface';
import { PermisoHabilidad } from '../game/game.manager';
import { Room } from '../rooms/interfaces/room.interface';
import { Player } from '../rooms/interfaces/player.interface';

@Injectable()
export class BotsService {
  private readonly logger = new Logger(BotsService.name);

  constructor(
    @Inject('BOT_EASY') private easyStrategy: BotStrategy,
    @Inject('BOT_MEDIUM') private mediumStrategy: BotStrategy,
    @Inject('BOT_HARD') private hardStrategy: BotStrategy,
  ) {}

  /**
   * Decide la acción que debe tomar un bot
   */
  decidirAccion(
    partida: Game,
    botId: string,
    difficulty: BotDifficulty = 'easy',
    contexto: PermisoHabilidad | null = null,
  ): BotAction {
    try {
      const strategy = this.getStrategy(difficulty);
      const accion = strategy.decidir(partida, botId, contexto);

      this.logger.debug(
        `Bot ${botId} (${difficulty}) decidió: ${accion.accion}`,
      );

      return accion;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error al decidir acción para bot ${botId}: ${errorMessage}`,
      );
      // Fallback: acción segura
      return { accion: 'descartar-pendiente' };
    }
  }

  /**
   * Agrega bots a una room si fillWithBots está habilitado
   */
  agregarBotsARoom(
    room: Room,
    difficulty: BotDifficulty = 'easy',
  ): void {
    if (!room.rules.fillWithBots) {
      this.logger.debug(`Room ${room.code} no tiene fillWithBots habilitado`);
      return;
    }

    const botsNeeded = room.rules.maxPlayers - room.players.size;
    if (botsNeeded <= 0) {
      this.logger.debug(`Room ${room.code} ya está llena de jugadores`);
      return;
    }

    this.logger.log(
      `Agregando ${botsNeeded} bots a room ${room.code} con dificultad ${difficulty}`,
    );

    for (let i = 0; i < botsNeeded; i++) {
      this.crearBotEnRoom(room, i, difficulty);
    }
  }

  /**
   * Crea un bot individual en la room
   */
  private crearBotEnRoom(
    room: Room,
    index: number,
    difficulty: BotDifficulty,
  ): void {
    const botId = `bot_${room.code}_${difficulty}_${index}`;
    const idInRoom = room.players.size;

    const botPlayer: Player = {
      userId: botId,
      idInRoom,
      socketId: '', // Los bots no tienen socket
      isHost: false,
      joinedAt: new Date(),
      connected: true, // Siempre conectados
    };

    room.players.set(botId, botPlayer);
    this.logger.debug(`Bot ${botId} creado en room ${room.code}`);
  }

  /**
   * Obtiene la estrategia correspondiente según dificultad
   */
  private getStrategy(difficulty: BotDifficulty): BotStrategy {
    switch (difficulty) {
      case 'medium':
        return this.mediumStrategy;
      case 'hard':
        return this.hardStrategy;
      case 'easy':
      default:
        return this.easyStrategy;
    }
  }

  /**
   * Verifica si un userId corresponde a un bot
   */
  esBot(userId: string): boolean {
    return userId.startsWith('bot_');
  }

  /**
   * Extrae la dificultad del ID del bot
   * Formato: "bot_ROOMCODE_DIFFICULTY_INDEX"
   */
  extraerDificultad(botId: string): BotDifficulty {
    const partes = botId.split('_');
    if (partes.length >= 3 && ['easy', 'medium', 'hard'].includes(partes[2])) {
      return partes[2] as BotDifficulty;
    }
    return 'easy';
  }
}
