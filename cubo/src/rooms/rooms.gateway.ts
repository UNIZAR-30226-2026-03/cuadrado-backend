import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RulesConfig } from './interfaces/rules-config.interface';
import { RoomsService } from './rooms.service';

interface SavedRoomPayload {
  name: string;
  rules: RulesConfig;
}

interface CreateRoomPayload {
  name?: string;
  rules?: RulesConfig;
  savedRoom?: SavedRoomPayload;
}

interface JoinRoomPayload {
  roomCode: string;
}

interface StartRoomPayload {
  roomCode: string;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly roomsService: RoomsService) {}

  handleConnection(client: Socket): void {
    try {
      const userId = this.getUserId(client);
      const existingRoom = this.roomsService.getRoomByUserId(userId);

      if (!existingRoom) {
        return;
      }

      const result = this.roomsService.handleReconnect(userId, client.id);
      if (!result.reconnected || !result.room) {
        return;
      }

      client.join(result.room.code);

      this.server.to(result.room.code).emit('room:playerReconnected', {
        userId,
        socketId: client.id,
      });

      const roomState = this.roomsService.getRoomState(result.room.code);
      if (roomState) {
        this.server.to(result.room.code).emit('room:update', roomState);
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    //leo directamente para que no sale excepción 
    const userId = client.data?.userId as string | undefined;

    if (!userId) {
      return;
    }

    const result = this.roomsService.handleDisconnect(userId);

    if (result.roomCode && result.roomClosed) {
      this.server.to(result.roomCode).emit('room:closed', {
        reason: 'Host left the room',
        roomCode: result.roomCode,
      });
      return;
    }

    if (result.roomCode && result.shouldEmitRoomUpdate) {
      this.server.to(result.roomCode).emit('room:playerDisconnected', {
        userId,
        waitingForReconnect: result.waitingForReconnect,
      });

      const roomState = this.roomsService.getRoomState(result.roomCode);
      if (roomState) {
        this.server.to(result.roomCode).emit('room:update', roomState);
      }
    }
  }

  @SubscribeMessage('rooms:create')
  createRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateRoomPayload,
  ) {
    try {
      const userId = this.getUserId(client);

      const source = payload.savedRoom
        ? {
            name: payload.savedRoom.name,
            rules: payload.savedRoom.rules,
          }
        : {
            name: payload.name,
            rules: payload.rules,
          };

      if (!source.name || !source.rules) {
        throw new WsException('name and rules are required');
      }

      const room = this.roomsService.createRoom(userId, client.id, {
        name: source.name,
        rules: source.rules,
      });

      client.join(room.code);

      const roomState = this.roomsService.getRoomState(room.code);
      this.server.to(room.code).emit('room:update', roomState);

      return {
        success: true,
        roomCode: room.code,
        roomName: room.name,
      };
    } catch (error) {
      throw new WsException(this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('rooms:join')
  joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    try {
      const userId = this.getUserId(client);

      const room = this.roomsService.joinRoom(userId, client.id, payload.roomCode);

      client.join(room.code);

      const roomState = this.roomsService.getRoomState(room.code);
      this.server.to(room.code).emit('room:update', roomState);

      return {
        success: true,
        roomCode: room.code,
        roomName: room.name,
      };
    } catch (error) {
      throw new WsException(this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('rooms:list-public')
  listPublicRooms(@ConnectedSocket() client: Socket) {
    try {
      return {
        success: true,
        rooms: this.roomsService.getPublicRooms(),
      };
    } catch (error) {
      throw new WsException(this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('rooms:leave')
  leaveRoom(@ConnectedSocket() client: Socket) {
    try {
      const userId = this.getUserId(client);
      const room = this.roomsService.getRoomByUserId(userId);
      if (room?.started) {
        throw new WsException(
          'No se puede salir manualmente de la sala mientras la partida está activa',
        );
      }

      const result = this.roomsService.leaveRoom(userId);

      if (result.isHostLeaving && result.room) {
        this.server.to(result.room.code).emit('room:closed', {
          reason: 'Host left the room',
          roomCode: result.room.code,
        });

        this.server.in(result.room.code).socketsLeave(result.room.code);
      } else if (result.room) {
        const roomState = this.roomsService.getRoomState(result.room.code);
        if (roomState) {
          this.server.to(result.room.code).emit('room:update', roomState);
        }
      }

      client.leave(result.room?.code || '');

      return {
        success: true,
      };
    } catch (error) {
      throw new WsException(this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('rooms:start')
  startRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: StartRoomPayload,
  ) {
    try {
      const userId = this.getUserId(client);
      const room = this.roomsService.startRoom(userId, payload.roomCode);

      const roomState = this.roomsService.getRoomState(room.code);
      this.server.to(room.code).emit('room:update', roomState);

      return {
        success: true,
        roomCode: room.code,
      };
    } catch (error) {
      throw new WsException(this.getErrorMessage(error));
    }
  }

  private getUserId(client: Socket): string {
    const userId = client.data?.userId as string | undefined;

    if (!userId) {
      throw new WsException('Unauthorized socket');
    }

    return userId;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unexpected room error';
  }
}
