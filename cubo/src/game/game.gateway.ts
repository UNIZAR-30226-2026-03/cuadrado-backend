import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { Game } from './interfaces/game.interface';

interface robarCartaPayload {
  gameId: string;
}

interface cartaPorPendientePayload{
  gameId: string;
  numCarta: number;
}



@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class GameGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gameService: GameService) {}

  private notificarTodos(partida : Game, ){
    this.server.to(partida.roomId).emit('actualizacion:partida',{
      partidaId : partida.gameId,
      cartasBaraja: partida.estadoGlobal.cartasVigentes,
      habilidades: partida.estadoGlobal.habilidadesActivadas,
    });
  }

  
  @SubscribeMessage('game:robar-carta')
  robarCarta(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: robarCartaPayload,
  ) {
    try {
      const partida = this.gameService.getGameById(payload.gameId);
      this.gameService.robarCarta(partida);

      this.notificarTodos(partida);
      this.server.to(client.id).emit('game:decision-requerida', {
        gameId : payload.gameId,
        cartaPendiente:
          partida.estadoGlobal.jugadores[partida.estadoGlobal.turn]
          .cartaPendiente,
      });
      return {success: true};
    } catch (error) {
      throw new WsException(this.getErrorMessage(error));
    }
  }

  @SubscribeMessage('game:descartar-pendiente')
  descartarPendiente(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: robarCartaPayload,
  ){
    try{
      const partida = this.gameService.getGameById(payload.gameId);
      this.gameService.descartarPendiente(partida);
      //this.notificarTodos(partida);
      this.server.to(client.id).emit('game:accion-aceptada', {
        gameId : payload.gameId,
      });
    } catch {
      throw new Error("Error inesperado");
    }
  }

  @SubscribeMessage('game:carta-por-pendiente')
  descartarCartaPorPendiente(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: cartaPorPendientePayload,
  ){
    try{
      const partida = this.gameService.getGameById(payload.gameId);
      this.gameService.cartaPorPendiente(partida,payload.numCarta);
      //this.notificarTodos(partida);
      this.server.to(client.id).emit('game:accion-aceptada', {
        gameId : payload.gameId,
      });
    } catch {
      throw new Error("Error inesperado");
    }
  }








  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Error inesperado';
  }
}
