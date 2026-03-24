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
import { Room } from 'src/rooms/interfaces/room.interface';
import { RoomsService } from 'src/rooms/rooms.service';
import { RoomManager } from 'src/rooms/room.manager';
import { use } from 'passport';

interface robarCartaPayload {
  gameId: string;
}

interface cartaPorPendientePayload{
  gameId: string;
  numCarta: number;
}

interface iniciarPartidaPayload {
  sala : Room;
}

interface intercambiarCartaPayload{
  gameId : string,
  numCartaRemitente: number,
  destinatarioId: string,
  numCartaDestinatario: number,
}

interface verCartaPayload{
  gameId: string,
  indexCarta: number,
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

  constructor(
      private readonly gameService: GameService, 
      private readonly roomsService : RoomsService,
  ) {}

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


  private notificarTodosComienzoPartida(partida: Game){
    this.server.to(partida.roomId).emit('inicio-partida',{
      partidaId : partida.gameId,
    });
  }

  private notificarTodosCambioCartas(partida: Game, idRemitente: string,
    idDestinatario: string
  ){
     this.server.to(partida.roomId).emit('intercambio-cartas',{
      partidaId : partida.gameId,
      remitente: idRemitente,
      destinatario: idDestinatario,
    });
  }

  //FIX: ahora se comprueba que el usuario que solicita iniciar la partida sea
  //el host de la misma.
  @SubscribeMessage('iniciar-partida')
  iniciarPartida(
    @ConnectedSocket() client: Socket,
  ){
    //comprobar que el usuario que solicita iniciar la partida sea el host
    const userId = this.getUserId(client);
    const sala = this.roomsService.getRoomByUserId(userId);
    if(!sala){
      throw new WsException('No hay ninguna sala registrada para el usuario \
        que intenta iniciar partida');
    }
    if(sala.hostId == userId && sala.started == false){
      const partida = this.gameService.inicioPartida(sala);
      this.notificarTodosComienzoPartida(partida);
       return{
        success: true
      }
    } else{
      throw new Error('Ha habido un error inesperado al iniciar la partida');
    }
  }

  //FIX: el front no tiene que saber la carta que está pendiente
  @SubscribeMessage('game:robar-carta')
  robarCarta(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: robarCartaPayload,
  ) {
    try {
      const partida = this.gameService.getGameById(payload.gameId);
      if(!partida){
        throw new WsException('No existe partida asociada con dicho \
          Identificador');
      }
      const userId = this.getUserId(client);
      this.gameService.robarCarta(partida, userId);

      this.notificarTodosCartaRobada(partida);
      this.server.to(client.id).emit('game:decision-requerida', {
        gameId : payload.gameId,
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
      const userId = this.getUserId(client);
      const cartaPendiente = this.gameService.descartarPendiente(partida,userId);
      
      this.notificarTodosDescartarPendiente(partida,cartaPendiente);
      return {
        success: true,
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
      const userId = this.getUserId(client);
      const carta = this.gameService.cartaPorPendiente(
        partida,
        payload.numCarta,
        userId,                                            
      );
      this.notificarTodosDescartarPendiente(partida, carta);
      return {
        success: true,
        gameId: partida.gameId,
      }
    } catch {
      throw new WsException("Error inesperado");
    }
  }
  
  @SubscribeMessage('intercambiar-carta')
  intercambiarCarta(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: intercambiarCartaPayload,
  ){
    const partida = this.gameService.getGameById(payload.gameId);
    const remitenteId = this.getUserId(client);
    this.gameService.intercambiarCarta(partida, remitenteId,
      payload.destinatarioId, payload.numCartaRemitente, 
      payload.numCartaDestinatario);
    this.notificarTodosCambioCartas(partida,remitenteId, 
      payload.destinatarioId);

  }

  @SubscribeMessage('game:ver-carta')
  verCarta(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: verCartaPayload
  ) {
    try {
      const partida = this.gameService.getGameById(payload.gameId);
      const userId = this.getUserId(client);
      const carta = this.gameService.verCarta(partida, payload.indexCarta, userId);

      this.server.to(client.id).emit('carta-revelada',{
        gameId: payload.gameId,
        carta: carta,
      });

      return {
        success: true,
        gameId: partida.gameId,
      };
    } catch (error) {
      throw new WsException("Error inesperado");
    }


  }
////////////////////////////////////////////////////////////////////////////////
//                              HABILIDADES DE CARTAS                         //
////////////////////////////////////////////////////////////////////////////////






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

    return 'Error inesperado';
  }
}
