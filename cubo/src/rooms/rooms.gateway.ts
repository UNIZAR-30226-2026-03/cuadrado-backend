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
import { Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RulesConfig } from './interfaces/rules-config.interface';
import { RoomsService } from './rooms.service';
import { GameService } from '../game/game.service';
import { GameGateway } from '../game/game.gateway';

interface CreateRoomPayload {
  name?: string;
  rules?: RulesConfig | null;
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

  constructor(
    private readonly roomsService: RoomsService,
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
  ) {}

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
      if (result.waitingForReconnect) {
        // Política: cualquier desconexión mid-game termina la partida para todos
        this.roomsService.cerrarSalaForzado(result.roomCode);
        this.server.to(result.roomCode).emit('room:closed', {
          reason: 'Player left the game',
          roomCode: result.roomCode,
        });
        this.server.in(result.roomCode).socketsLeave(result.roomCode);
      } else {
        this.server.to(result.roomCode).emit('room:playerDisconnected', {
          userId,
          waitingForReconnect: false,
        });
        const roomState = this.roomsService.getRoomState(result.roomCode);
        if (roomState) {
          this.server.to(result.roomCode).emit('room:update', roomState);
        }
      }
    }
  }

  @SubscribeMessage('rooms:create')
  async createRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateRoomPayload,
  ) {
    try {
      const userId = this.getUserId(client);

      const roomName = payload.name?.trim();
      if (!roomName) {
        throw new WsException('La sala necesita un nombre');
      }

      let rules = payload.rules ?? undefined;
      let savedRoomName: string | undefined;
      let warning: string | undefined;

      if (!rules) {
        const savedRoom = await this.gameService.getSavedRoomConfigByName(
          userId,
          roomName,
        );

        if (!savedRoom) {
          throw new WsException(
            'No se encontraron reglas guardadas para ese nombre de sala',
          );
        }

        rules = savedRoom.rules;
        savedRoomName = savedRoom.roomName;
      } else {
        const existingSavedRoom = await this.gameService.getSavedRoomConfigByName(
          userId,
          roomName,
        );
        if (existingSavedRoom) {
          warning =
            'Ya existe una partida guardada con este nombre; al guardar se sobreescribirá';
        }
      }

      const room = this.roomsService.createRoom(userId, client.id, {
        name: roomName,
        rules,
        savedRoomName,
      });

      client.join(room.code);

      const roomState = this.roomsService.getRoomState(room.code);
      this.server.to(room.code).emit('room:update', roomState);

      return {
        success: true,
        roomCode: room.code,
        roomName: room.name,
        loadedFromSave: Boolean(savedRoomName),
        warning,
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
  async startRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: StartRoomPayload,
  ) {
    try {
      const userId = this.getUserId(client);
      const room = this.roomsService.getRoomByUserId(userId);
      if (!room || room.code !== payload.roomCode) {
        throw new WsException('El usuario no pertenece a la sala indicada');
      }

      const savedRoomName = this.roomsService.getSavedRoomName(room.code) ?? undefined;

      let startResult;
      if (savedRoomName) {
        startResult = await this.gameGateway.iniciarPartida(client, {
          savedRoomName,
        });
        this.roomsService.clearSavedRoomName(room.code);
      } else {
        this.roomsService.startRoom(userId, payload.roomCode);
        startResult = await this.gameGateway.iniciarPartida(client);
      }

      const roomState = this.roomsService.getRoomState(room.code);
      this.server.to(room.code).emit('room:update', roomState);

      return {
        roomCode: room.code,
        ...startResult,
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
    if (error instanceof WsException) {
      const wsError = error.getError();

      if (typeof wsError === 'string') {
        return wsError;
      }

      if (
        typeof wsError === 'object' &&
        wsError !== null &&
        'message' in wsError
      ) {
        const message = (wsError as { message?: unknown }).message;

        if (typeof message === 'string') {
          return message;
        }

        if (Array.isArray(message)) {
          return message.join(', ');
        }
      }

      if (
        typeof wsError === 'object' &&
        wsError !== null &&
        'error' in wsError
      ) {
        const nestedError = (wsError as { error?: unknown }).error;

        if (
          typeof nestedError === 'object' &&
          nestedError !== null &&
          'message' in nestedError
        ) {
          const nestedMessage = (nestedError as { message?: unknown }).message;

          if (typeof nestedMessage === 'string') {
            return nestedMessage;
          }

          if (Array.isArray(nestedMessage)) {
            return nestedMessage.join(', ');
          }
        }
      }

      return 'Unexpected room error';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unexpected room error';
  }
}
