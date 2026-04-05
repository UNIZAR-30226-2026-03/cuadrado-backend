import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { FinPartidaMotivo, Game } from './interfaces/game.interface';
import { Card } from './interfaces/card.interface';
import {
  HABILIDAD_DENEGADA_SIN_EFECTO_ERROR_MESSAGE,
  SIN_CARTAS_ERROR_MESSAGE,
} from './game.manager';

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
  //atributos que envía en caso de que quieras ver la carta de otro jugador
  playerId? : string,
  indexCartaPlayer? : number,
}

interface intercambiarTodasPaylaod{
  gameId : string,
  destinatarioId: string,
}

interface hacerRobarCartaPayload{
  gameId: string,
  adversarioId : string,
}

interface protegerCartaPayload{
  gameId: string,
  numCarta : number,
}

interface calcularPuntosJugadorPayload{
  gameId: string,
}

interface jugadorMenosPuntuacionPayload{
  gameId: string,
}

interface desactivarProximaHabilidadPayload{
  gameId: string,
}

interface solicitarCartaSobreOtraPayload{
  gameId: string,
}

interface cartaSobreOtraPayload{
  gameId : string,
  numCarta :number,
}

interface cuboPayload {
  gameId: string;
}

interface iniciarPartidaPayload {
  savedGameId?: string;
}

interface guardarYCerrarPayload {
  gameId: string;
}

interface prepararIntercabioCartaPayload {
  gameId: string,
  numCartaJugador: number,
  rivalId: string,
}

interface intercambiarCartaInteractivo {
  gameId: string,
  numCartaJugador: number,
  rivalId: string,
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
//Se ha preguntado a chatGPT cual es la mejor manera de implementar el ticker
//De ahi se ha sacado la idea de implementar OnGateway
export class GameGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private timeoutTicker?: NodeJS.Timeout;

  constructor(
    private readonly gameService: GameService,
  ) {}

  afterInit(): void {
    this.timeoutTicker = setInterval(() => {
      this.procesarTimeoutsTurno();
    }, 1000);
  }

  handleDisconnect(): void {
    // Hook required by lifecycle interface; socket-level disconnect is handled in RoomsGateway.
  }

  onModuleDestroy(): void {
    if (!this.timeoutTicker) {
      return;
    }

    clearInterval(this.timeoutTicker);
    this.timeoutTicker = undefined;
  }

  private procesarTimeoutsTurno() {
    try {
      const partidasAfectadas = this.gameService.resolverTimeoutsTurnoActivos();

      for (const partida of partidasAfectadas) {
        this.server.to(partida.roomId).emit('game:turno-expirado', {
          gameId: partida.gameId,
          turn: partida.estadoGlobal.turn,
          phase: partida.estadoGlobal.phase,
          turnDeadlineAt: partida.estadoGlobal.turnDeadlineAt,
          //TODO: Porque turnDeadlineAt? que devolvera exactamente?
        });

        this.finalizarPartidaYSincronizarSala(partida);
      }
    } catch {
      // Never throw inside ticker; game actions keep reporting detailed errors.
    }
  }

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

  private notificarTodosHacerRobarCarta(partida : Game, idRemitente: string,
    idDestinatario: string
  ){
     this.server.to(partida.roomId).emit('game:se-ha-hecho-robar-carta',{
      partidaId : partida.gameId,
      remitente: idRemitente,
      destinatario: idDestinatario,
    });
  }

  private notificarTodosHabilidadDenegada(
    partida: Game,
    jugadorId: string,
    habilidad: string,
  ) {
    this.server.to(partida.roomId).emit('game:habilidad-denegada', {
      gameId: partida.gameId,
      jugadorId,
      habilidad,
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

  private notificarTodosRebarajado(partida: Game) {
    this.server.to(partida.roomId).emit('game:mazo-rebarajado', {
      gameId: partida.gameId,
      cantidadCartasMazo: partida.estadoGlobal.cartasVigentes.length,
      cantidadCartasDescartadas: partida.estadoGlobal.cartasDescartadas.length,
    });
  }

  private notificarTodosPartidaFinalizada(
    partida: Game,
    motivo: FinPartidaMotivo,
  ) {
    const cartasJugadores = partida.estadoGlobal.turnoJugadores.map(
      (jugadorId, index) => {
        const cartas = partida.estadoGlobal.jugadores[index].cartasMano;
        return {
          jugadorId,
          valoresCartas: cartas.map((carta) => carta.carta),
        };
      },
    );

    // Calcular recompensas (ELO y cubitos) para cada jugador
    const recompensas = this.gameService.calcularRecompensas(partida);

    // Aplica recompensas en background (sin esperar)
    this.gameService.aplicarRecompensas(recompensas);

    this.server.to(partida.roomId).emit('game:partida-finalizada', {
      gameId: partida.gameId,
      motivo,
      ranking: partida.ranking,
      ganadorId: partida.ranking?.[0]?.userId, // El primer elemento es el ganador (posición 1)
      cartasJugadores,
      recompensas,
    });
  }

  private finalizarPartidaYSincronizarSala(
    partida: Game,
    fallbackMotivo?: FinPartidaMotivo,
  ): boolean {
    if (partida.estado !== 'terminado') {
      return false;
    }

    const motivo = partida.finPartidaMotivo ?? fallbackMotivo ?? 'unJugadorSinCartas';
    this.notificarTodosPartidaFinalizada(partida, motivo);

    const roomState = this.gameService.resetRoomAfterGameAndGetState(partida.roomId);
    //Aviso para que todos los fronts esten actualizados y sepan que ha terminado
    if (roomState) {
      this.server.to(partida.roomId).emit('room:update', roomState);
    }

    return true;
  }

  private esErrorSinCartas(error: unknown): boolean {
    return error instanceof Error && error.message === SIN_CARTAS_ERROR_MESSAGE;
  }

  private esErrorHabilidadDenegada(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message === HABILIDAD_DENEGADA_SIN_EFECTO_ERROR_MESSAGE
    );
  }

  //FIX: ahora se comprueba que el usuario que solicita iniciar la partida sea
  //el host de la misma.
  @SubscribeMessage('game:iniciar-partida')
  async iniciarPartida(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: iniciarPartidaPayload,
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

      const partida = payload?.savedGameId
        ? await this.gameService.cargarPartidaGuardada(
            payload.savedGameId,
            userId,
            client.id,
          )
        : this.gameService.inicioPartida(room);
      this.notificarTodosComienzoPartida(partida);

      return{
        success: true,
        gameId: partida.gameId,
        roomId: partida.roomId,
        loadedFromSave: Boolean(payload?.savedGameId),
      }
    } catch (error) {
      this.handleWsError(error);
    }
  }

  @SubscribeMessage('game:guardar-y-cerrar')
  async guardarYCerrarPartida(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: guardarYCerrarPayload,
  ) {
    try {
      const { partida, userId } = this.getValidatedGameContext(client, payload.gameId);

      const resultado = await this.gameService.guardarYcerrarPartida(partida, userId);

      this.server.to(resultado.roomCode).emit('room:closed', {
        reason: 'Host saved and closed the room',
        roomCode: resultado.roomCode,
        savedGameId: resultado.gameId,
      });

      this.server.in(resultado.roomCode).socketsLeave(resultado.roomCode);

      return {
        success: true,
        gameId: resultado.gameId,
        roomCode: resultado.roomCode,
      };
    } catch (error) {
      this.handleWsError(error);
    }
  }

  @SubscribeMessage('game:listar-partidas-guardadas')
  async listarPartidasGuardadas(@ConnectedSocket() client: Socket) {
    try {
      const userId = this.getUserId(client);
      const partidas = await this.gameService.listarPartidasGuardadas(userId);

      return {
        success: true,
        partidas,
      };
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
    let partida: Game | undefined;

    try {
      const contexto = this.getValidatedGameContext(
        client,
        payload.gameId,
      );
      partida = contexto.partida;

      const resultado = this.gameService.robarCarta(partida, contexto.userId);

      if (resultado.reshuffle.huboRebarajado) {
        this.notificarTodosRebarajado(partida);
      }

      this.notificarTodosCartaRobada(partida);
      this.server.to(client.id).emit('game:decision-requerida', {
        gameId : payload.gameId,
      });
      return {
        success: true,
      };
    } catch (error) {
      if (this.esErrorSinCartas(error) && partida) {
        this.finalizarPartidaYSincronizarSala(partida, 'sinCartasMazo');
      }
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

      const resultado = this.gameService.descartarPendiente(partida,userId);

      this.finalizarPartidaYSincronizarSala(partida);

      if(resultado.resultadoHabilidad.tipo === 'roba-y-sigue'){
        /*implica que el jugador ha robado una carta resultante de la acción
        de descartar un 6*/
        this.server.to(client.id).emit('game:carta-robada-por-descartar-6', {
          gameId: payload.gameId,
          cartaRobada: resultado.resultadoHabilidad.cartaRobada,
          reshuffle: resultado.resultadoHabilidad.reshuffle,
        });
        this.notificarTodosCartaRobada(partida);
      }

      this.notificarTodosDescartarPendiente(partida,resultado.cartaDescartada);
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

      this.finalizarPartidaYSincronizarSala(partida);

      this.notificarTodosDescartarPendiente(partida, carta);
      return {
        success: true,
        gameId: partida.gameId,
      }
    } catch (error) {
      this.handleWsError(error);
    }
  }
  
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
    let partida: Game | undefined;
    let userId: string | undefined;

    try {
      const contexto = this.getValidatedGameContext(
        client,
        payload.gameId,
      );
      partida = contexto.partida;
      userId = contexto.userId;

      const resultado = this.gameService.verCarta(
      partida,
      userId,
      payload.indexCarta,
      payload.playerId,
      payload.indexCartaPlayer,
    );

      this.finalizarPartidaYSincronizarSala(partida);

      this.server.to(client.id).emit('game:carta-revelada',{
        gameId: payload.gameId,
        carta: resultado.cartaPropia,
        cartaJugadorContrario: resultado.cartaRival,
      });

      return {
        success: true,
        gameId: partida.gameId,
      };
    } catch (error) {
      if (this.esErrorHabilidadDenegada(error) && partida && userId) {
        this.notificarTodosHabilidadDenegada(partida, userId, 'ver-carta');
        this.finalizarPartidaYSincronizarSala(partida);
        return {
          success: true,
          gameId: partida.gameId,
          habilidadDenegada: true,
        };
      }
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


   @SubscribeMessage('game:hacer-robar-carta')
  hacerRoarCarta(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: hacerRobarCartaPayload,
  ){
    let partida: Game | undefined;
    let remitenteId: string | undefined;

    try{
      const contexto = this.getValidatedGameContext(
        client,
        payload.gameId,
      );
      partida = contexto.partida;
      remitenteId = contexto.userId;

      this.gameService.hacerRobarCarta(partida, remitenteId,
        payload.adversarioId);
      
      this.notificarTodosHacerRobarCarta(partida,remitenteId, 
        payload.adversarioId);

      return {
        success: true,
        //Todo: rellenar bien el payload
      };
      } catch (error){
        if (this.esErrorHabilidadDenegada(error) && partida && remitenteId) {
          this.notificarTodosHabilidadDenegada(
            partida,
            remitenteId,
            'hacer-robar-carta',
          );
          this.finalizarPartidaYSincronizarSala(partida);
          return {
            success: true,
            gameId: partida.gameId,
            habilidadDenegada: true,
          };
        }
        this.handleWsError(error);
    }
  }

  @SubscribeMessage('game:proteger-carta')
  protegerCarta(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: protegerCartaPayload,
  ){
    let partida: Game | undefined;
    let remitenteId: string | undefined;

    try{
      const contexto = this.getValidatedGameContext(
        client,
        payload.gameId,
      );
      partida = contexto.partida;
      remitenteId = contexto.userId;

      this.gameService.protegerCarta(partida, remitenteId,
        payload.numCarta);
  
      return {
        success: true,
      };
      } catch (error){
        if (this.esErrorHabilidadDenegada(error) && partida && remitenteId) {
          this.notificarTodosHabilidadDenegada(
            partida,
            remitenteId,
            'proteger-carta',
          );
          this.finalizarPartidaYSincronizarSala(partida);
          return {
            success: true,
            gameId: partida.gameId,
            habilidadDenegada: true,
          };
        }
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

  @SubscribeMessage('game:jugador-menos-puntuacion')
  jugadorMenosPuntuacion(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: jugadorMenosPuntuacionPayload,
  ){
    let partida: Game | undefined;
    let userId: string | undefined;

    try{
      const contexto = this.getValidatedGameContext(
        client,
        payload.gameId,
      );
      partida = contexto.partida;
      userId = contexto.userId;

      const jugadorId = this.gameService.jugadorMenosPuntuacion(partida, userId);

      this.server.to(client.id).emit('game:jugador-menos-puntuacion-calculado',{
        gameId: payload.gameId,
        jugadorId: jugadorId,
      });

      return {
        success: true,
        gameId: payload.gameId,
        jugadorId: jugadorId,
      }
    } catch (error){
      if (this.esErrorHabilidadDenegada(error) && partida && userId) {
        this.notificarTodosHabilidadDenegada(
          partida,
          userId,
          'jugador-menos-puntuacion',
        );
        this.finalizarPartidaYSincronizarSala(partida);
        return {
          success: true,
          gameId: partida.gameId,
          habilidadDenegada: true,
        };
      }
      this.handleWsError(error);
    } 
  }

  @SubscribeMessage('game:desactivar-proxima-habilidad')
  desactivarProximaHabilidad(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: desactivarProximaHabilidadPayload,
  ){
    try{
      const { partida, userId } = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

      this.gameService.desactivarProximaHabilidad(partida, userId);

      return {
        success: true,
        gameId: payload.gameId,
      };
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
    let partida: Game | undefined;

    try {
      const contexto = this.getValidatedGameContext(
        client,
        payload.gameId,
      );
      partida = contexto.partida;

      const resultado = this.gameService.ponerCartaSobreotra(
        partida,
        contexto.userId,
        payload.numCarta,
      );

      this.finalizarPartidaYSincronizarSala(partida);

      if (resultado.reshuffle.huboRebarajado) {
        this.notificarTodosRebarajado(partida);
      }

      if(resultado.accionCorrecta){
        //el jugador ha puesto una carta con el número correcto
        this.server.to(client.id).emit('game:poner-otra-carta-sobre-otra',{
          gameId: payload.gameId,
        });
      } 
      //notificar al resto de jugadores que el jugador en cuestión tiene una
      //carta más o una menos
      this.notificarTodosAccionCartaSobreOtra(partida, resultado.numCartas,
        contexto.userId);

      return {
        success: true,
        gameId: payload.gameId,
        //TODO: revisar el payload
      };
    } catch (error) {
      if (this.esErrorSinCartas(error) && partida) {
        this.finalizarPartidaYSincronizarSala(partida, 'sinCartasMazo');
      }
      this.handleWsError(error);
    }
  }

  @SubscribeMessage('game:preparar-intercambio-carta')
  prepararIntercambioCarta(
    @ConnectedSocket() client : Socket,
    @MessageBody() payload: prepararIntercabioCartaPayload,
  ){
    let partida: Game | undefined;

    try {
      const contexto = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

      partida = contexto.partida;

      const correcto = this.gameService.prepararIntercabioCarta(
        partida,
        contexto.userId,
        payload.rivalId,
        payload.numCartaJugador
      );

      this.finalizarPartidaYSincronizarSala(partida);

      if(correcto){
        /*se puede notificar al otro jugador para que efectue su parte de la 
        acción*/
        this.server.to(payload.rivalId).emit('game:intercambio-rival',{
          gameId: payload.gameId,
          usuarioIniciador: contexto.userId,
        });
      } 

      return {
        success: true,
        gameId: payload.gameId,
      };
    } catch (error) {
      if (this.esErrorSinCartas(error) && partida) {
        this.finalizarPartidaYSincronizarSala(partida, 'sinCartasMazo');
      }
      this.handleWsError(error);
    }
  }
  
   @SubscribeMessage('game:preparar-intercambio-carta')
  intercambiarCartaInteractivo(
    @ConnectedSocket() client : Socket,
    @MessageBody() payload: intercambiarCartaInteractivo,
  ){
    let partida: Game | undefined;

    try {
      const contexto = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

      partida = contexto.partida;

      const correcto = this.gameService.intercambiarCartaInteractivo(
        partida,
        contexto.userId,
        payload.rivalId,
        payload.numCartaJugador
      );

      this.finalizarPartidaYSincronizarSala(partida);

      if(correcto){
        /*se puede notificar al otro jugador para que efectue su parte de la 
        acción*/
        this.notificarTodosCambioCartas(partida,payload.rivalId,contexto.userId);
      }

      return {
        success: true,
        gameId: payload.gameId,
      };
    } catch (error) {
      if (this.esErrorSinCartas(error) && partida) {
        this.finalizarPartidaYSincronizarSala(partida, 'sinCartasMazo');
      }
      this.handleWsError(error);
    }
  }

  @SubscribeMessage('game:cubo')
  cubo(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: cuboPayload,
  ) {
    try {
      const { partida, userId } = this.getValidatedGameContext(
        client,
        payload.gameId,
      );

      const resultado = this.gameService.solicitarCubo(partida, userId);

      if (resultado.activado) {
        this.server.to(partida.roomId).emit('game:cubo-activado', {
          gameId: partida.gameId,
          solicitanteId: userId,
          turnosRestantes: partida.estadoGlobal.cuboTurnosRestantes,
        });
      }

      return {
        success: true,
        gameId: partida.gameId,
        cuboActivado: resultado.activado,
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
