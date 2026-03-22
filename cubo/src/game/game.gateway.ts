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

/////////////////////////////////////////////////////////////////////////////////
//    INTERFACES PAYLOAD: los datos a enviar en cada mensaje                  //
///////////////////////////////////////////////////////////////////////////////
interface robarCartaPayload {
  gameId: string;
  idEnPartida: number;
}

interface cartaPorPendientePayload {
  gameId: string;
  numCarta: number;
  idEnPartida: number;
}

interface iniciarPartidaPayload {
  sala: Room;
}

interface intercambiarCartaPayload {
  gameId: string;
  remitenteId: number;
  numCartaRemitente: number;
  destinatarioId: number;
  numCartaDestinatario: number;
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

  // Avisar a los jugadores de una partida que alguien ha robado
  private notificarTodosCartaRobada(partida: Game) {
    this.server.to(partida.roomId).emit('carta-robada', {
      partidaId: partida.gameId,
      jugadorRobado: partida.estadoGlobal.turn,
    });
  }

  // Avisar a los jugadores de una partida que alguien ha descartado
  private notificarTodosDescartarPendiente(partida: Game, carta: Card) {
    this.server.to(partida.roomId).emit('descartar-pendiente', {
      partidaId: partida.gameId,
      carta: carta,
    });
  }

  // POR QUÉ ES IGUAL QUE LA OTRA Y SE LLAMAN DISTINTO?
  private notificarTodosDescartarEnTablero(partida: Game, carta: Card) {
    this.server.to(partida.roomId).emit('descartar-pendiente', {
      partidaId: partida.gameId,
      carta: carta,
    });
  }

  // Avisar a los jugadores de una partida que se ha iniciado
  private notificarTodosComienzoPartida(partida: Game) {
    this.server.to(partida.roomId).emit('descartar-pendiente', {
      partidaId: partida.gameId,
    });
  }

  // Avisar a los jugadores de una partida que se han intercambiado cartas de dos jugadores
  private notificarTodosCambioCartas(
    partida: Game,
    idRemitente: number,
    idDestinatario: number,
  ) {
    this.server.to(partida.roomId).emit('intercambio-cartas', {
      partidaId: partida.gameId,
      remitente: idRemitente,
      destinatario: idDestinatario,
    });
  }

  // Suscripción para escuchar los mensajes que pueden llegar en una partida
  @SubscribeMessage('iniciar-partida')
  iniciarPartida(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: iniciarPartidaPayload,
  ) {
    if (payload.sala.started == false) {
      const partida = this.gameService.inicioPartida(payload.sala);
      this.notificarTodosComienzoPartida(partida);
      return {
        success: true,
      };
    } else {
      throw new Error('La partida ya ha sido empezada');
    }
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
        gameId: payload.gameId,
        cartaPendiente:
          partida.estadoGlobal.jugadores[payload.idEnPartida].cartaPendiente,
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
  ) {
    try {
      const partida = this.gameService.getGameById(payload.gameId);
      const cartaPendiente = this.gameService.descartarPendiente(
        partida,
        payload.idEnPartida,
      );
      this.notificarTodosDescartarPendiente(partida, cartaPendiente);
      return {
        succes: true,
        gameId: partida.gameId,
      };
    } catch {
      throw new WsException('Error inesperado');
    }
  }

  @SubscribeMessage('game:carta-por-pendiente')
  descartarCartaPorPendiente(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: cartaPorPendientePayload,
  ) {
    try {
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
      };
    } catch {
      throw new WsException('Error inesperado');
    }
  }

  @SubscribeMessage('intercambiar-carta')
  intercambiarCarta(@MessageBody() payload: intercambiarCartaPayload) {
    const partida = this.gameService.getGameById(payload.gameId);
    this.gameService.intercambiarCarta(
      partida,
      payload.remitenteId,
      payload.destinatarioId,
      payload.numCartaRemitente,
      payload.numCartaDestinatario,
    );
    this.notificarTodosCambioCartas(
      partida,
      payload.remitenteId,
      payload.destinatarioId,
    );
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
