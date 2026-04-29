import { Inject, Injectable } from '@nestjs/common';
import {
  dificultadBot,
  playerController,
  PublicRoomSummary,
  RoomState,
} from './interfaces/room.interface';
import { CreateRoomInput, RoomManager } from './room.manager';

@Injectable()
export class RoomsService {
  constructor(@Inject(RoomManager) private readonly roomManager: RoomManager) {}

  createRoom(
    userId: string,
    socketId: string,
    input: CreateRoomInput,
  ) {
    return this.roomManager.createRoom(userId, socketId, input);
  }

  joinRoom(userId: string, socketId: string, roomCode: string) {
    return this.roomManager.joinRoom(userId, socketId, roomCode);
  }

  leaveRoom(userId: string) {
    return this.roomManager.leaveRoom(userId);
  }

  startRoom(userId: string, roomCode: string) {
    return this.roomManager.startRoom(userId, roomCode);
  }

  getSavedRoomName(roomCode: string) {
    return this.roomManager.getSavedRoomName(roomCode);
  }

  clearSavedRoomName(roomCode: string) {
    this.roomManager.clearSavedRoomName(roomCode);
  }

  cerrarSalaForzado(roomCode: string): void {
    this.roomManager.cerrarSalaForzado(roomCode);
  }

  resetRoomAfterGame(roomCode: string) {
    return this.roomManager.resetRoomAfterGame(roomCode);
  }

  handleDisconnect(userId: string) {
    return this.roomManager.handleDisconnect(userId);
  }

  marcarJugadorDesconectado(userId: string) {
    return this.roomManager.marcarJugadorDesconectado(userId);
  }

  cambiarControladorJugador(
    userId: string,
    controlador: playerController,
    dificultad?: dificultadBot,
  ) {
    return this.roomManager.cambiarControladorJugador(
      userId,
      controlador,
      dificultad,
    );
  }

  desvincularUsuarioDeSalaActiva(userId: string) {
    return this.roomManager.desvincularUsuarioDeSalaActiva(userId);
  }

  handleReconnect(userId: string, socketId: string) {
    return this.roomManager.handleReconnect(userId, socketId);
  }

  getRoomState(roomCode: string): RoomState | null {
    return this.roomManager.getRoomState(roomCode);
  }

  getRoomByUserId(userId: string) {
    return this.roomManager.getRoomByUserId(userId);
  }

  getPublicRooms(): PublicRoomSummary[] {
    return this.roomManager.getPublicRooms();
  }
}
