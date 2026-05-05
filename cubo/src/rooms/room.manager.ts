import { Injectable, Logger } from '@nestjs/common';
import { Player } from './interfaces/player.interface';
import {
  PublicRoomSummary,
  Room,
  RoomState,
} from './interfaces/room.interface';
import {
  AVAILABLE_POWERS,
  DEFAULT_ROOM_BOT_DIFFICULTY,
  DEFAULT_DECK_COUNT,
  ROOM_BOT_DIFFICULTIES,
  RoomBotDifficulty,
  RulesConfig,
} from './interfaces/rules-config.interface';
import { BotsService } from '../bots/bots.service';
import { playerController } from "./interfaces/room.interface";
import { dificultadBot } from "./interfaces/room.interface";

const RECONNECT_TIMEOUT_MS = 25000;
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export interface CreateRoomInput {
  name: string;
  rules: RulesConfig;
  savedRoomName?: string;
}

@Injectable()
export class RoomManager {
  private readonly logger = new Logger(RoomManager.name);

  //mapa que relaciona roomID -> Room Objeto
  private readonly rooms = new Map<string, Room>();
  //mapa que relaciona userID->roomID
  private readonly userToRoom = new Map<string, string>();

  constructor(private botsService: BotsService) {}


  // Crea una nueva sala y asigna al usuario como host. 
  // Lanza errores si el usuario ya está en una sala o si el nombre de la sala es inválido.
  createRoom(userId: string, socketId: string, input: CreateRoomInput): Room {
    if (this.userToRoom.has(userId)) {
      throw new Error('User is already in a room');
    }

    const roomName = input.name?.trim();
    if (!roomName) {
      throw new Error('Room name is required');
    }

    const normalizedRules = this.normalizarReglas(input.rules);

    const roomCode = this.generateUniqueRoomCode();
    const players = new Map<string, Player>();
    const jugadorNuevo = this.createPlayer(userId, socketId, true, 0);
    players.set(userId, jugadorNuevo);
    
    const room: Room = {
      name: roomName,
      code: roomCode,
      hostId: userId,
      players,
      rules: normalizedRules,
      savedRoomName: input.savedRoomName,
      started: false,
      createdAt: new Date(),
    };

    this.rooms.set(room.code, room);
    this.userToRoom.set(userId, room.code); 

    return room;
  }

  private normalizarReglas(rules: RulesConfig): RulesConfig {
    const deckCount = this.normalizarDeckCount(rules.deckCount);
    const maxPlayersLimit = deckCount === 1 ? 4 : 8;
    const dificultadBots = this.normalizarDificultadBots(rules.dificultadBots);

    if (!Number.isInteger(rules.maxPlayers) || rules.maxPlayers < 2) {
      throw new Error('maxPlayers debe ser un entero entre 2 y 8');
    }

    if (rules.maxPlayers > maxPlayersLimit) {
      throw new Error(
        `Con ${deckCount} baraja(s) el máximo de jugadores es ${maxPlayersLimit}`,
      );
    }

    const enabledPowers = this.normalizarHabilidades(rules.enabledPowers);

    return {
      maxPlayers: rules.maxPlayers,
      turnTimeSeconds: rules.turnTimeSeconds,
      isPrivate: rules.isPrivate,
      fillWithBots: rules.fillWithBots,
      dificultadBots,
      deckCount,
      enabledPowers,
    };
  }

  private normalizarDificultadBots(
    dificultad: unknown,
  ): RoomBotDifficulty {
    if (dificultad == null) {
      return DEFAULT_ROOM_BOT_DIFFICULTY;
    }

    if (
      typeof dificultad === 'string' &&
      ROOM_BOT_DIFFICULTIES.includes(dificultad as RoomBotDifficulty)
    ) {
      return dificultad as RoomBotDifficulty;
    }

    throw new Error(
      `dificultadBots debe ser una de: ${ROOM_BOT_DIFFICULTIES.join(', ')}`,
    );
  }

  private normalizarDeckCount(deckCount: number): 1 | 2 {
    if (deckCount == null) {
      return DEFAULT_DECK_COUNT;
    }

    if (deckCount !== 1 && deckCount !== 2) {
      throw new Error('deckCount debe ser 1 o 2');
    }

    return deckCount;
  }

  private normalizarHabilidades(enabledPowers: number[]): number[] {
    if (!Array.isArray(enabledPowers)) {
      return [...AVAILABLE_POWERS];
    }

    if (enabledPowers.length === 0) {
      return [];
    }

    const normalized = new Set<number>();

    for (const power of enabledPowers as unknown[]) {
      const value = this.parsePowerValue(power);
      if (value == null) {
        throw new Error(`enabledPowers contiene valores inválidos: ${String(power)}`);
      }

      if (!AVAILABLE_POWERS.includes(value as (typeof AVAILABLE_POWERS)[number])) {
        throw new Error(`La habilidad ${value} no es válida`);
      }

      normalized.add(value);
    }

    return [...normalized];
  }

  //ChatGPT ha ayudado a hacer esta funcion
  private parsePowerValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d+$/.test(trimmed)) {
        return Number(trimmed);
      }

      const normalized = trimmed
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');

      if (normalized === 'a' || normalized === 'poder_a' || normalized === 'podera') {
        return 1;
      }
      if (normalized === 'j' || normalized === 'poder_j' || normalized === 'poderj') {
        return 11;
      }

      const aliases: Record<string, number> = {
        intercambiar_todas: 1,
        hacer_robar_carta: 2,
        proteger_carta: 3,
        saltar_turno_jugador: 4,
        roba_y_sigue: 6,
        jugador_menos_puntuacion: 7,
        desactivar_proxima_habilidad: 8,
        intercambiar_carta: 9,
        ver_carta_propia: 10,
        ver_carta_propia_y_rival: 11,
      };

      if (aliases[normalized] != null) {
        return aliases[normalized];
      }

      const firstNumber = trimmed.match(/\d+/);
      if (firstNumber) {
        return Number(firstNumber[0]);
      }
    }

    return null;
  }

  // Unir a una sala existente usando el código de la sala.
  // Lanza errores si la sala no existe, si el usuario ya está en una sala, 
  // si la sala ya ha comenzado o si la sala está llena.
  joinRoom(userId: string, socketId: string, roomCode: string): Room {
    const normalizedCode = this.normalizeRoomCode(roomCode);
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      throw new Error('Room not found');
    }

    if (this.userToRoom.has(userId)) {
      throw new Error('User is already in a room');
    }

    if (room.started) {
      throw new Error('Room already started');
    }

    if (room.players.size >= room.rules.maxPlayers) {
      throw new Error('Room is full');
    }

    room.players.set(userId, this.createPlayer(userId, socketId, false,
        room.players.size));
    this.userToRoom.set(userId, room.code);

    return room;
  }

  leaveRoom(userId: string): { room: Room | null; isHostLeaving: boolean } {
    const roomCode = this.userToRoom.get(userId);

    if (!roomCode) {
      return { room: null, isHostLeaving: false };
    }

    const room = this.rooms.get(roomCode);
    this.userToRoom.delete(userId);

    if (!room) {
      return { room: null, isHostLeaving: false };
    }

    const player = room.players.get(userId);
    if (player?.disconnectTimeout) {
      clearTimeout(player.disconnectTimeout);
    }

    const isHost = room.hostId === userId;

    if (isHost) {
      room.players.forEach((existingPlayer) => {
        if (existingPlayer.disconnectTimeout) {
          clearTimeout(existingPlayer.disconnectTimeout);
        }
        if (this.userToRoom.get(existingPlayer.userId) === room.code) {
          this.userToRoom.delete(existingPlayer.userId);
        }
      });

      this.rooms.delete(room.code);
      return { room, isHostLeaving: true };
    }

    room.players.delete(userId);

    if (room.players.size === 0) {
      this.rooms.delete(room.code);
      return { room: null, isHostLeaving: false };
    }

    return { room, isHostLeaving: false };
  }

  handleDisconnect(userId: string): {
    roomCode: string | null;
    shouldEmitRoomUpdate: boolean;
    roomClosed: boolean;
    waitingForReconnect: boolean;
    isHostLeaving: boolean;
  } {
    const roomCode = this.userToRoom.get(userId);

    if (!roomCode) {
      return {
        roomCode: null,
        shouldEmitRoomUpdate: false,
        roomClosed: false,
        waitingForReconnect: false,
        isHostLeaving: false,
      };
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      return {
        roomCode: null,
        shouldEmitRoomUpdate: false,
        roomClosed: false,
        waitingForReconnect: false,
        isHostLeaving: false,
      };
    }

    const player = room.players.get(userId);
    if (!player) {
      return {
        roomCode: null,
        shouldEmitRoomUpdate: false,
        roomClosed: false,
        waitingForReconnect: false,
        isHostLeaving: false,
      };
    }

    if (room.started) {
      const isHostLeaving = room.hostId === userId;
      this.marcarJugadorDesconectado(userId);
      return {
        roomCode,
        shouldEmitRoomUpdate: true,
        roomClosed: isHostLeaving,
        waitingForReconnect: true,
        isHostLeaving,
      };
    }

    const leaveResult = this.leaveRoom(userId);
    return {
      roomCode,
      shouldEmitRoomUpdate: Boolean(leaveResult.room && !leaveResult.isHostLeaving),
      roomClosed: Boolean(leaveResult.room && leaveResult.isHostLeaving),
      waitingForReconnect: false,
      isHostLeaving: Boolean(leaveResult.isHostLeaving),
    };
  }

  handleReconnect(
    userId: string,
    socketId: string,
  ): { room: Room | null; reconnected: boolean } {
    const roomCode = this.userToRoom.get(userId);

    if (!roomCode) {
      return { room: null, reconnected: false };
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      return { room: null, reconnected: false };
    }

    const player = room.players.get(userId);
    if (!player) {
      return { room: null, reconnected: false };
    }

    if (player.disconnectTimeout) {
      clearTimeout(player.disconnectTimeout);
      player.disconnectTimeout = undefined;
    }

    player.socketId = socketId;
    player.connected = true;

    return { room, reconnected: true };
  }

  startRoom(userId: string, roomCode: string): Room {
    const room = this.getRoomByCode(roomCode);

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.hostId !== userId) {
      throw new Error('Only host can start the room');
    }

    const allConnected = Array.from(room.players.values()).every(
      (player) => player.connected || player.controlador === 'bot',
    );

    if (!allConnected) {
      throw new Error('All players must be connected to start');
    }
    // Agregar bots si está configurado
    this.botsService.agregarBotsARoom(
      room,
      room.rules.dificultadBots ?? DEFAULT_ROOM_BOT_DIFFICULTY,
    );

    
    if (room.players.size < 2) {
      throw new Error('At least 2 players required to start');
    }

    room.started = true;

    return room;
  }

  getSavedRoomName(roomCode: string): string | null {
    const room = this.getRoomByCode(roomCode);

    if (!room?.savedRoomName) {
      return null;
    }

    return room.savedRoomName;
  }

  clearSavedRoomName(roomCode: string): void {
    const room = this.getRoomByCode(roomCode);
    if (!room) {
      return;
    }

    room.savedRoomName = undefined;
  }

  /*
  * Cuando se implemente la funcionalidad de las partidas habrá
  * que guardar el estado de la partida en la base de datos.
  */
  pauseRoom(roomCode : string){
    const room = this.getRoomByCode(roomCode);

  }

  cerrarSalaForzado(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.players.forEach((player) => {
      if (this.userToRoom.get(player.userId) === roomCode) {
        this.userToRoom.delete(player.userId);
      }
    });
    this.rooms.delete(roomCode);
  }

  resetRoomAfterGame(roomCode: string): Room | null {
    const room = this.getRoomByCode(roomCode);

    if (!room) {
      return null;
    }

    room.started = false;

    const hayHumanosEnSala = Array.from(room.players.values()).some(
      (player) =>
        player.controlador === 'humano' &&
        this.userToRoom.get(player.userId) === room.code,
    );

    if (!hayHumanosEnSala) {
      room.players.forEach((player) => {
        if (this.userToRoom.get(player.userId) === room.code) {
          this.userToRoom.delete(player.userId);
        }
      });
      this.rooms.delete(room.code);
      return null;
    }

    return room;
  }

  getRoomState(roomCode: string): RoomState | null {
    const room = this.getRoomByCode(roomCode);

    if (!room) {
      return null;
    }

    return {
      name: room.name,
      code: room.code,
      hostId: room.hostId,
      players: Array.from(room.players.values()).map((player) => ({
        userId: player.userId,
        controlador: player.controlador,
        dificultadBot: player.dificultadBot,
        nombreEnPartida: player.nombreEnPartida,
        socketId: player.socketId,
        isHost: player.isHost,
        joinedAt: player.joinedAt,
        connected: player.connected,
      })),
      rules: room.rules,
      started: room.started,
      createdAt: room.createdAt,
    };
  }

  getRoomByUserId(userId: string): Room | null {
    const roomCode = this.userToRoom.get(userId);

    if (!roomCode) {
      return null;
    }

    return this.rooms.get(roomCode) || null;
  }

  getPublicRooms(): PublicRoomSummary[] {
    return Array.from(this.rooms.values())
      .filter((room) => !room.rules.isPrivate && !room.started)
      .map((room) => ({
        name: room.name,
        code: room.code,
        playersCount: room.players.size,
        rules: room.rules,
        createdAt: room.createdAt,
      }));
  }

  marcarJugadorDesconectado(userId: string): Room | null {
    const room = this.getRoomByUserId(userId);

    if (!room) {
      return null;
    }

    const player = room.players.get(userId);
    if (!player) {
      return null;
    }

    if (player.disconnectTimeout) {
      clearTimeout(player.disconnectTimeout);
      player.disconnectTimeout = undefined;
    }

    player.connected = false;
    player.socketId = '';

    return room;
  }

  cambiarControladorJugador(
    userId: string,
    controlador: playerController,
    dificultadBot?: dificultadBot,
  ): Player | null {
    const room = this.getRoomByUserId(userId);

    if (!room) {
      return null;
    }

    const player = room.players.get(userId);
    if (!player) {
      return null;
    }

    this.establecerControladorJugador(player, controlador, dificultadBot);
    return player;
  }

  desvincularUsuarioDeSalaActiva(userId: string): Room | null {
    const roomCode = this.userToRoom.get(userId);
    if (!roomCode) {
      return null;
    }

    const room = this.rooms.get(roomCode) || null;
    if (!room) {
      this.userToRoom.delete(userId);
      return null;
    }

    this.userToRoom.delete(userId);

    if (room.hostId === userId) {
      const hostAnterior = room.players.get(userId);
      if (hostAnterior) {
        hostAnterior.isHost = false;
      }

      const nuevoHost = Array.from(room.players.values()).find(
        (player) =>
          player.userId !== userId &&
          player.controlador === 'humano' &&
          this.userToRoom.get(player.userId) === room.code,
      );
      if (nuevoHost) {
        room.hostId = nuevoHost.userId;
        nuevoHost.isHost = true;
      }
    }

    return room;
  }

  private getRoomByCode(roomCode: string): Room | null {
    const normalizedCode = this.normalizeRoomCode(roomCode);
    return this.rooms.get(normalizedCode) || null;
  }

  private generateUniqueRoomCode(): string {
    let candidate = this.generateRoomCode();

    while (this.rooms.has(candidate)) {
      candidate = this.generateRoomCode();
    }

    return candidate;
  }

  private generateRoomCode(): string {
    let code = '';

    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
      code += ROOM_CODE_CHARS[randomIndex];
    }

    return code;
  }

  //quitar basura y ponerlo en mayus
  private normalizeRoomCode(code?: string): string {
    return (code || '').trim().toUpperCase();
  }

  private createPlayer(
    userId: string,
    socketId: string,
    isHost: boolean,
    idInRoom: number,
    controlador: playerController = 'humano',
  ): Player {

    return {
      userId,
      controlador,
      socketId,
      isHost,
      joinedAt: new Date(),
      connected: true,
      disconnectTimeout: undefined,
      idInRoom: idInRoom,
    };
  }

  private establecerControladorJugador(user: Player, controlador: playerController,
    dificultadBot?: dificultadBot,){

      user.controlador = controlador;

      if(user.controlador === 'bot'){
        user.dificultadBot = dificultadBot;
        user.nombreEnPartida = `bot${user.idInRoom + 1}`;
        user.connected = false;
        user.socketId = '';
        return;
      }

      user.dificultadBot = undefined;
      user.nombreEnPartida = undefined;
    }


}
