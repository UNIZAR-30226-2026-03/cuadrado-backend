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
import { Card } from './interfaces/card.interface';

interface robarCartaPayload {
  gameId: string;
  idEnPartida: number,
}

interface cartaPorPendientePayload{
  gameId: string;
  numCarta: number;
  idEnPartida: number,
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

  private notificarTodosCartaRobada(partida : Game, ){
    this.server.to(partida.roomId).emit('carta-robada',{
      partidaId : partida.gameId,
      jugadorRobado: partida.estadoGlobal.turn,
    });
  }
 
  private notificarTodosDescartarPendiente(partida : Game, carta: Card){
    this.server.to(partida.roomId).emit('descartar-pendiente',{
      partidaId : partida.gameId,
      carta: carta,
    });
  }

  private notificarTodosDescartarEnTablero(partida : Game, carta: Card){
    this.server.to(partida.roomId).emit('descartar-pendiente',{
      partidaId : partida.gameId,
      carta: carta,
    });
  }
  
  @SubscribeMessage('game:robar-carta')
  robarCarta(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: robarCartaPayload,
  ) {
    try {
      const partida = this.gameService.getGameById(payload.gameId);
      this.gameService.robarCarta(partida, payload.idEnPartida);

      this.notificarTodosCartaRobada(partida);
      this.server.to(client.id).emit('game:decision-requerida', {
        gameId : payload.gameId,
        cartaPendiente:
          partida.estadoGlobal.jugadores[payload.idEnPartida]
          .cartaPendiente,
      });
      return {
        success: true,
      };
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
      const cartaPendiente = this.gameService.descartarPendiente(partida,
                                                          payload.idEnPartida);
      this.notificarTodosDescartarPendiente(partida,cartaPendiente);
      return {
        succes: true,
        gameId: partida.gameId,
      }
    } catch {
      throw new WsException("Error inesperado");
    }
  }

  @SubscribeMessage('game:carta-por-pendiente')
  descartarCartaPorPendiente(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: cartaPorPendientePayload,
  ){
    try{
      const partida = this.gameService.getGameById(payload.gameId);
      const carta = this.gameService.cartaPorPendiente(
        partida,
        payload.numCarta,
        payload.idEnPartida,                                            
      );
      this.notificarTodosDescartarEnTablero(partida, carta);
      return {
        succes: true,
        gameId: partida.gameId,
      }
    } catch {
      throw new WsException("Error inesperado");
    }
  }

////////////////////////////////////////////////////////////////////////////////
//                              HABILIDADES DE CARTAS                         //
////////////////////////////////////////////////////////////////////////////////






  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Error inesperado';
  }
}
