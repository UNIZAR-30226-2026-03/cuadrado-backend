import { Inject, Injectable } from '@nestjs/common';
import { RoomState } from './interfaces/room.interface';
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

  handleDisconnect(userId: string) {
    return this.roomManager.handleDisconnect(userId);
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
}
