import { Player } from './interfaces/player.interface';
import {
  PublicRoomSummary,
  Room,
  RoomState,
} from './interfaces/room.interface';
import { RulesConfig } from './interfaces/rules-config.interface';

const RECONNECT_TIMEOUT_MS = 25000;
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export interface CreateRoomInput {
  name: string;
  rules: RulesConfig;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly userToRoom = new Map<string, string>();

  createRoom(userId: string, socketId: string, input: CreateRoomInput): Room {
    if (this.userToRoom.has(userId)) {
      throw new Error('User is already in a room');
    }

    const roomName = input.name?.trim();
    if (!roomName) {
      throw new Error('Room name is required');
    }

    const roomCode = this.generateUniqueRoomCode();
    const players = new Map<string, Player>();
    players.set(userId, this.createPlayer(userId, socketId, true));

    const room: Room = {
      name: roomName,
      code: roomCode,
      hostId: userId,
      players,
      rules: input.rules,
      started: false,
      createdAt: new Date(),
    };

    this.rooms.set(room.code, room);
    this.userToRoom.set(userId, room.code);

    return room;
  }

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

    room.players.set(userId, this.createPlayer(userId, socketId, false));
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
        this.userToRoom.delete(existingPlayer.userId);
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
    shouldWaitForReconnect: boolean;
  } {
    const roomCode = this.userToRoom.get(userId);

    if (!roomCode) {
      return { roomCode: null, shouldWaitForReconnect: false };
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      return { roomCode: null, shouldWaitForReconnect: false };
    }

    const player = room.players.get(userId);
    if (!player) {
      return { roomCode: null, shouldWaitForReconnect: false };
    }

    player.connected = false;

    if (player.disconnectTimeout) {
      clearTimeout(player.disconnectTimeout);
    }

    player.disconnectTimeout = setTimeout(() => {
      this.leaveRoom(userId);
    }, RECONNECT_TIMEOUT_MS);

    return { roomCode, shouldWaitForReconnect: true };
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
      (player) => player.connected,
    );

    if (!allConnected) {
      throw new Error('All players must be connected to start');
    }

    if (room.players.size < 2) {
      throw new Error('At least 2 players required to start');
    }

    room.started = true;

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
  ): Player {
    return {
      userId,
      socketId,
      isHost,
      joinedAt: new Date(),
      connected: true,
      disconnectTimeout: undefined,
    };
  }
}
