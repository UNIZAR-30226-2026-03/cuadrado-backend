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
}

interface cartaPorPendientePayload{
  gameId: string;
  numCarta: number;
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

interface intercambiarTodasPaylaod{
  gameId : string,
  destinatarioId: string,
}

interface calcularPuntosJugadorPayload{
  gameId: string,
}

interface solicitarCartaSobreOtraPayload{
  gameId: string,
}

interface cartaSobreOtraPayload{
  gameId : string,
  numCarta :number,
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

  private notificarTodosCartaRobada(partida : Game ){
    this.server.to(partida.roomId).emit('game:carta-robada',{
      partidaId : partida.gameId,
      jugadorRobado: partida.estadoGlobal.turn,
    });
  }
 
  private notificarTodosDescartarPendiente(partida : Game, carta: Card){
    this.server.to(partida.roomId).emit('game:descartar-pendiente',{
      partidaId : partida.gameId,
      carta: carta,
    });
  }


  private notificarTodosComienzoPartida(partida: Game){
    this.server.to(partida.roomId).emit('game:inicio-partida',{
      partidaId : partida.gameId,
    });
  }

  private notificarTodosCambioCartas(partida: Game, idRemitente: string,
    idDestinatario: string
  ){
     this.server.to(partida.roomId).emit('game:intercambio-cartas',{
      partidaId : partida.gameId,
      remitente: idRemitente,
      destinatario: idDestinatario,
    });
  }

  private notificarTodosAccionCartaSobreOtra(
    partida: Game,
    numCartasMano : number,
    idUsuario : string,
  ) {
    this.server.to(partida.roomId).emit('game:accion-carta-sobre-otra',{
      partidaId: partida.gameId,
      usuarioImplicado: idUsuario,
      numCartasMano: numCartasMano,
    });
  }

  //FIX: ahora se comprueba que el usuario que solicita iniciar la partida sea
  //el host de la misma.
  @SubscribeMessage('game:iniciar-partida')
  iniciarPartida(
    @ConnectedSocket() client: Socket,
  ){
    try {
      const userId = this.getUserId(client);
      const { room } = this.gameService.validateStartContext(userId, client.id);

      this.assertSocketInExpectedRoom(client, room.code);

      if (room.hostId !== userId) {
        throw new Error('Solo el host puede iniciar la partida');
      }

      if (room.started) {
        throw new Error('La sala ya está iniciada');
      }

      const partida = this.gameService.inicioPartida(room);
      this.notificarTodosComienzoPartida(partida);

      return{
        success: true,
      }
    } catch (error) {
      this.handleWsError(error);
    }
  }

  //FIX: el front no tiene que saber la carta que está pendiente
  @SubscribeMessage('game:robar-carta')
  robarCarta(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: robarCartaPayload,
  ) {
    try {
      const { partida, userId } = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

      this.gameService.robarCarta(partida, userId);

      this.notificarTodosCartaRobada(partida);
      this.server.to(client.id).emit('game:decision-requerida', {
        gameId : payload.gameId,
      });
      return {
        success: true,
      };
    } catch (error) {
      this.handleWsError(error);
    }
  }

  @SubscribeMessage('game:descartar-pendiente')
  descartarPendiente(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: robarCartaPayload,
  ){
    try{
      const { partida, userId } = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

      const cartaPendiente = this.gameService.descartarPendiente(partida,userId);
      
      this.notificarTodosDescartarPendiente(partida,cartaPendiente);
      return {
        success: true,
        gameId: partida.gameId,
      }
    } catch (error) {
      this.handleWsError(error);
    }
  }

  @SubscribeMessage('game:carta-por-pendiente')
  descartarCartaPorPendiente(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: cartaPorPendientePayload,
  ){
    try{
      const { partida, userId } = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

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
    } catch (error) {
      this.handleWsError(error);
    }
  }
  
  //TODO: aquí en intercambio de carta no se puede devolver la fornt el estado
  //completo de la partida
  @SubscribeMessage('game:intercambiar-carta')
  intercambiarCarta(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: intercambiarCartaPayload,
  ){
    try {
      const { partida, userId: remitenteId } = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

      this.gameService.intercambiarCarta(partida, remitenteId,
        payload.destinatarioId, payload.numCartaRemitente, 
        payload.numCartaDestinatario);
      this.notificarTodosCambioCartas(partida,remitenteId, 
        payload.destinatarioId);

      return {
        success: true,
        //aqui lo del todo...
      };
    } catch (error) {
      this.handleWsError(error);
    }

  }

  @SubscribeMessage('game:ver-carta')
  verCarta(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: verCartaPayload
  ) {
    try {
      const { partida, userId } = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

      const carta = this.gameService.verCarta(partida, payload.indexCarta, userId);

      this.server.to(client.id).emit('game:carta-revelada',{
        gameId: payload.gameId,
        carta: carta,
      });

      return {
        success: true,
        gameId: partida.gameId,
      };
    } catch (error) {
      this.handleWsError(error);
    }


  }

  @SubscribeMessage('game:intercambiar-todas-cartas')
  intercambiarTodasCartas(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: intercambiarTodasPaylaod,
  ){
    try{
      const { partida, userId: remitenteId } = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

      this.gameService.intercambiarTodasCartas(partida, remitenteId,
        payload.destinatarioId);
      this.notificarTodosCambioCartas(partida,remitenteId, 
        payload.destinatarioId);

      return {
        success: true,
        //Todo: rellenar bien el payload
      };
      } catch (error){
        this.handleWsError(error);
    }
  }

  @SubscribeMessage('game:calcular-puntos')
  calcularPuntosJugador(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: calcularPuntosJugadorPayload,
  ){
    try{
      const { partida, userId } = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

      const puntos = this.gameService.calcularPuntosJugador(partida, userId);

      this.server.to(client.id).emit('game:puntos-calculados',{
        gameId: payload.gameId,
        puntos: puntos,
      });

      return {
        success: true,
        gameId: payload.gameId,
      }
    } catch (error){
      this.handleWsError(error);
    } 
  }

  @SubscribeMessage('game:solicitar-carta-sobre-otra')
  solicitarCartaSobreOtra(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: solicitarCartaSobreOtraPayload,
  ){  
    try {
      const { userId } = this.getValidatedGameContext(client, payload.gameId);

      const aceptado = this.gameService.solicitarColocarCartaSobreOtra(
        payload.gameId,
        userId
      );
      this.server.to(client.id).emit('game:poner-carta-sobre-otra',{
        aceptada: aceptado,
      });

      return {
        success: true,
        gameId: payload.gameId,
        //TODO: revisar el payload
      };
    } catch (error) {
      this.handleWsError(error);
    }
  }
  
  @SubscribeMessage('game:poner-carta-sobre-otra')
  ponerCartaSobreOtra(
    @ConnectedSocket() client : Socket,
    @MessageBody() payload: cartaSobreOtraPayload,
  ){
    try {
      const { partida, userId } = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

      const resultado = this.gameService.ponerCartaSobreotra(
        partida,
        userId,
        payload.numCarta,
      );
      if(resultado.accionCorrecta){
        //el jugador ha puesto una carta con el número correcto
        this.server.to(client.id).emit('game:poner-otra-carta-sobre-otra',{
          gameId: payload.gameId,
        });
      } 
      //notificar al resto de jugadores que el jugador en cuestión tiene una
      //carta más o una menos
      this.notificarTodosAccionCartaSobreOtra(partida, resultado.numCartas,
        userId);

      return {
        success: true,
        gameId: payload.gameId,
        //TODO: revisar el payload
      };
    } catch (error) {
      this.handleWsError(error);
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

  private getValidatedGameContext(client: Socket, gameId: string) {
    const userId = this.getUserId(client);
    const validation = this.gameService.validateGameContext(
      gameId,
      userId,
      client.id,
    );

    this.assertSocketInExpectedRoom(client, validation.room.code);

    return {
      partida: validation.game,
      userId,
    };
  }

  private assertSocketInExpectedRoom(client: Socket, roomCode: string) {
    if (!client.rooms.has(roomCode)) {
      throw new Error('El socket no está unido a la sala esperada');
    }
  }


  //Se ha solicitado a Gemini un helper centralizado de error para los WebSockets
  private handleWsError(error: unknown): never {
    throw new WsException({
      success: false,
      error: {
        message: this.getErrorMessage(error),
      },
    });
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

      return 'Error inesperado';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Error inesperado';
  }
}
