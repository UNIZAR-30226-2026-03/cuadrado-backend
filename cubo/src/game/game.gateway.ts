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
import { OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { BotsService } from '../bots/bots.service';
import { FinPartidaMotivo, Game } from './interfaces/game.interface';
import { Card } from './interfaces/card.interface';
import { dificultadBot } from '../rooms/interfaces/room.interface';
import { RulesConfig } from '../rooms/interfaces/rules-config.interface';
import {
  AccionProtegidaCanceladaError,
  CartaReveladaTodos,
  CARTA_PROTEGIDA_BLOQUEA_ERROR_MESSAGE,
  HABILIDAD_DENEGADA_SIN_EFECTO_ERROR_MESSAGE,
  SIN_CARTAS_ERROR_MESSAGE,
} from './game.manager';

/////////////////////////////////////////////////////////////////////////////////
//    INTERFACES PAYLOAD: los datos a enviar en cada mensaje                  //
///////////////////////////////////////////////////////////////////////////////
interface robarCartaPayload {
  gameId: string;
}

interface cartaPorPendientePayload {
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

interface saltarTurnoJugadorPayload {
  gameId: string;
  adversarioId: string;
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
  savedRoomName?: string;
}

interface EstadoJugadorInicioPartida {
  userId: string;
  controlador: 'humano' | 'bot';
  dificultadBot?: dificultadBot;
  nombreEnPartida?: string;
  numCartas: number;
  cartasProtegidas: number[];
  habilidadesActivadas: number[];
  saltarTurno: boolean;
  tieneCartaPendiente: boolean;
}

interface EstadoPublicoInicioPartida {
  turn: number;
  turnoActualUserId: string;
  phase: Game['estadoGlobal']['phase'];
  turnDeadlineAt: number;
  numBarajas: number;
  cartasRestantes: number;
  cartasDescartadas: Card[];
  ultimaCartaDescartada: Card | null;
  habilidadesActivadas: number[];
  cuboActivado: boolean;
  cuboSolicitanteId: string | null;
  cuboTurnosRestantes?: number;
  jugadores: EstadoJugadorInicioPartida[];
}

interface iniciarPartidaResponse {
  success: true;
  gameId: string;
  roomId: string;
  loadedFromSave: boolean;
  estado: EstadoPublicoInicioPartida;
}

interface guardarYCerrarPayload {
  gameId: string;
}

interface abandonarPartidaPayload {
  gameId: string;
  dificultadBot?: dificultadBot;
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

interface verCartaTodosPayload {
  gameId: string;
}

interface resolverJPayload {
  gameId: string;
  intercambiar: boolean;
}

interface volverAJugarPayload {
  gameId: string;
}

type RevanchaEstado = 'waiting-host' | 'room-ready';

interface RematchSession {
  gameId: string;
  originalRoomCode: string;
  roomName: string;
  rules: RulesConfig;
  hostId: string;
  participantIds: Set<string>;
  readyUserIds: Set<string>;
  socketByUserId: Map<string, string>;
  launched: boolean;
  rematchRoomCode?: string;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
//Se ha preguntado a chatGPT cual es la mejor manera de implementar el ticker
//De ahi se ha sacado la idea de implementar OnGateway
export class GameGateway implements OnGatewayInit, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private timeoutTicker?: NodeJS.Timeout;
  private readonly queuedBotGames = new Set<string>();
  private readonly processingBotGames = new Set<string>();
  private readonly rematchSessions = new Map<string, RematchSession>();
  private static readonly MAX_BOT_ACTIONS_PER_FLUSH = 1;
  private static readonly BOT_INITIAL_DELAY_MS = 450;
  private static readonly BOT_ACTION_DELAY_MS = 850;

  constructor(
    private readonly gameService: GameService,
    private readonly botsService: BotsService,
  ) {}

  afterInit(): void {
    this.timeoutTicker = setInterval(() => {
      this.procesarTimeoutsTurno();
    }, 1000);
  }

  handleDisconnect(_client: Socket): void {
  }

  onModuleDestroy(): void {
    if (this.timeoutTicker) {
      clearInterval(this.timeoutTicker);
      this.timeoutTicker = undefined;
    }
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
        this.scheduleBotProcessing(partida);
      }
    } catch {
      // Never throw inside ticker; game actions keep reporting detailed errors.
    }
  }

  private scheduleBotProcessing(
    partida: Game,
    delayMs: number = GameGateway.BOT_INITIAL_DELAY_MS,
  ) {
    if (partida.estado !== 'activo') {
      return;
    }

    // Notifica el inicio del turno actual si corresponde (fase WAIT_DRAW)
    this.notificarTurnoIniciadoSiActivo(partida);

    const gameId = partida.gameId;
    if (
      this.processingBotGames.has(gameId) ||
      this.queuedBotGames.has(gameId)
    ) {
      return;
    }

    this.queuedBotGames.add(gameId);

    setTimeout(() => {
      this.queuedBotGames.delete(gameId);
      this.flushBotActions(gameId);
    }, delayMs);
  }

  private flushBotActions(gameId: string) {
    if (this.processingBotGames.has(gameId)) {
      return;
    }

    this.processingBotGames.add(gameId);
    let shouldReschedule = false;

    try {
      for ( 
        let accionesProcesadas = 0;
        accionesProcesadas < GameGateway.MAX_BOT_ACTIONS_PER_FLUSH;
        accionesProcesadas++
      ) {
        const partida = this.gameService.getGameById(gameId);
        if (partida.estado !== 'activo') {
          return;
        }

        const turnoActualId = partida.estadoGlobal.turnoJugadores[partida.estadoGlobal.turn];
        const estadoTurnoActual =
          partida.estadoGlobal.jugadores[partida.estadoGlobal.turn];
        if (estadoTurnoActual.controlador !== 'bot') {
          return;
        }

        const difficulty = estadoTurnoActual.dificultadBot ?? 'facil';
        const contexto = this.gameService.getBotDecisionContext(
          partida.gameId,
          turnoActualId,
        );

        const accion = this.botsService.decidirAccion(
          partida,
          turnoActualId,
          difficulty,
          contexto,
        );

        const actionApplied = this.ejecutarAccionBot(
          partida,
          turnoActualId,
          accion,
        );
        if (!actionApplied) {
          return;
        }

        // Notifica si el turno avanzó a fase WAIT_DRAW (turno intermedio de bots)
        this.notificarTurnoIniciadoSiActivo(partida);
      }

      shouldReschedule = true;
    } catch (error) {
      console.error('Error en flushBotActions:', error);
    } finally {
      this.processingBotGames.delete(gameId);
    }

    if (!shouldReschedule) {
      return;
    }

    let partida: Game;
    try {
      partida = this.gameService.getGameById(gameId);
    } catch {
      return;
    }
    if (partida.estado !== 'activo') {
      return;
    }

    const turnoActualId = partida.estadoGlobal.turnoJugadores[partida.estadoGlobal.turn];
    const estadoTurnoActual = partida.estadoGlobal.jugadores[partida.estadoGlobal.turn];
    if (estadoTurnoActual.controlador === 'bot') {
      this.scheduleBotProcessing(partida, GameGateway.BOT_ACTION_DELAY_MS);
    } else {
      // Turno de humano tras batch de bots: notificar directamente
      this.notificarTurnoIniciadoSiActivo(partida);
    }
  }

  /**
   * Ejecuta una acción de bot y emite los eventos correspondientes
   */
  private ejecutarAccionBot(
    partida: Game,
    botId: string,
    accion: any, // BotAction
  ): boolean {
    try {
      switch (accion.accion) {
        case 'robar':
          return this.ejecutarRobarBot(partida, botId);
        case 'descartar-pendiente':
          return this.ejecutarDescartarPendienteBot(partida, botId);
        case 'carta-por-pendiente':
          return this.ejecutarCartaPorPendienteBot(
            partida,
            botId,
            accion.cartaIndex,
          );
        case 'ver-carta':
          return this.ejecutarVerCartaBot(partida, botId, accion.cartaIndex);
        case 'ver-carta-todos':
          return this.ejecutarVerCartaTodosBot(partida, botId);
        case 'ver-carta-propia-y-rival':
          return this.ejecutarVerCartaPropiaYRivalBot(
            partida,
            botId,
            accion.cartaIndex,
            accion.targetUserId,
            accion.cartaIndexTarget,
          );
        case 'resolver-j':
          return this.ejecutarResolverJBot(partida, botId, accion.intercambiar ?? true);
        case 'intercambiar-carta':
          return this.ejecutarIntercambiarCartaBot(
            partida,
            botId,
            accion.cartaIndex,
            accion.targetUserId,
            accion.cartaIndexTarget,
          );
        case 'intercambiar-carta-interactivo':
          return this.ejecutarIntercambiarCartaInteractivoBot(
            partida,
            botId,
            accion.cartaIndex,
            accion.targetUserId,
          );
        case 'intercambiar-todas-cartas':
          return this.ejecutarIntercambiarTodasCartasBot(
            partida,
            botId,
            accion.targetUserId,
          );
        case 'hacer-robar-carta':
          return this.ejecutarHacerRobarCartaBot(
            partida,
            botId,
            accion.targetUserId,
          );
        case 'proteger-carta':
          return this.ejecutarProtegerCartaBot(
            partida,
            botId,
            accion.cartaIndex,
          );
        case 'saltar-turno-jugador':
          return this.ejecutarSaltarTurnoJugadorBot(
            partida,
            botId,
            accion.targetUserId,
          );
        case 'jugador-menos-puntuacion':
          return this.ejecutarJugadorMenosPuntuacionBot(partida, botId);
        case 'esperar':
          return false;
        default:
          return false;
      }
    } catch (error) {
      if (this.esErrorSinCartas(error) && partida) {
        this.finalizarPartidaYSincronizarSala(partida, 'sinCartasMazo');
      }
      if (this.esErrorHabilidadDenegada(error) && partida) {
        this.notificarTodosHabilidadDenegada(partida, botId, accion.accion);
        this.finalizarPartidaYSincronizarSala(partida);
        this.notificarEstadoPoder8(partida, null);
        return true;
      }
      if (this.esErrorCartaProtegidaBloquea(error) && partida) {
        if (error instanceof AccionProtegidaCanceladaError) {
          this.notificarTodosAccionProtegidaCancelada(partida, error);
        } else {
          this.notificarTodosHabilidadDenegada(partida, botId, accion.accion);
        }
        this.finalizarPartidaYSincronizarSala(partida);
        return true;
      }
      console.error(
        `Error ejecutando acción bot ${botId} (${accion.accion}):`,
        error,
      );
      return false;
    }
  }

  /**
   * El bot roba una carta
   */
  private ejecutarRobarBot(partida: Game, botId: string): boolean {
    const resultado = this.gameService.robarCarta(partida, botId);

    if (resultado.reshuffle.huboRebarajado) {
      this.notificarTodosRebarajado(partida);
    }

    this.notificarTodosCartaRobada(partida);
    this.server.to(partida.roomId).emit('game:bot-roba-carta', {
      gameId: partida.gameId,
      botId,
    });
    return true;
  }

  /**
   * El bot descarta la carta pendiente
   */
  private ejecutarDescartarPendienteBot(partida: Game, botId: string): boolean {
    const resultado = this.gameService.descartarPendiente(partida, botId);

    this.finalizarPartidaYSincronizarSala(partida);

    if (resultado.resultadoHabilidad.tipo === 'roba-y-sigue') {
      this.notificarTodosCartaRobada(partida);
    }

    this.notificarTodosDescartarPendiente(partida, resultado.cartaDescartada);
    this.server.to(partida.roomId).emit('game:bot-descarta-pendiente', {
      gameId: partida.gameId,
      botId,
    });
    return true;
  }

  /**
   * El bot intercambia una carta de mano por la pendiente
   */
  private ejecutarCartaPorPendienteBot(
    partida: Game,
    botId: string,
    cartaIndex: number,
  ): boolean {
    const carta = this.gameService.cartaPorPendiente(partida, cartaIndex, botId);

    this.finalizarPartidaYSincronizarSala(partida);

    this.notificarTodosDescartarPendiente(partida, carta);
    this.server.to(partida.roomId).emit('game:bot-intercambia-cartas', {
      gameId: partida.gameId,
      botId,
    });
    return true;
  }

  private ejecutarVerCartaBot(
    partida: Game,
    botId: string,
    cartaIndex?: number,
  ): boolean {
    if (cartaIndex == null) {
      return false;
    }

    this.gameService.verCarta(partida, botId, cartaIndex);
    this.finalizarPartidaYSincronizarSala(partida);
    this.notificarTodosBotVerCarta(partida, botId, cartaIndex);
    return true;
  }

  private ejecutarVerCartaTodosBot(partida: Game, botId: string): boolean {
    this.gameService.verCartaTodos(partida, botId);
    this.finalizarPartidaYSincronizarSala(partida);
    return true;
  }

  private ejecutarVerCartaPropiaYRivalBot(
    partida: Game,
    botId: string,
    cartaIndex?: number,
    rivalId?: string,
    cartaIndexRival?: number,
  ): boolean {
    if (cartaIndex == null || rivalId == null || cartaIndexRival == null) {
      return false;
    }

    this.gameService.verCarta(
      partida,
      botId,
      cartaIndex,
      rivalId,
      cartaIndexRival,
    );
    this.finalizarPartidaYSincronizarSala(partida);
    this.notificarTodosBotVerCartaPropiaYRival(
      partida,
      botId,
      rivalId,
      cartaIndex,
      cartaIndexRival,
    );
    return true;
  }

  private ejecutarIntercambiarCartaBot(
    partida: Game,
    botId: string,
    cartaIndex?: number,
    rivalId?: string,
    cartaIndexRival?: number,
  ): boolean {
    if (cartaIndex == null || rivalId == null || cartaIndexRival == null) {
      return false;
    }

    this.gameService.intercambiarCartaBot(
      partida,
      botId,
      rivalId,
      cartaIndex,
      cartaIndexRival,
    );
    this.notificarTodosCambioCartas(
      partida,
      botId,
      rivalId,
      cartaIndex,
      cartaIndexRival,
    );
    this.finalizarPartidaYSincronizarSala(partida);
    return true;
  }

  /** Paso 2 del intercambio interactivo: el bot responde como rival. */
  private ejecutarIntercambiarCartaInteractivoBot(
    partida: Game,
    botId: string,
    cartaIndex?: number,
    iniciadorId?: string,
  ): boolean {
    if (cartaIndex == null || iniciadorId == null) {
      return false;
    }

    const correcto = this.gameService.intercambiarCartaInteractivo(
      partida,
      botId,
      iniciadorId,
      cartaIndex,
    );

    this.finalizarPartidaYSincronizarSala(partida);

    if (correcto) {
      this.notificarTodosCambioCartas(partida, iniciadorId, botId);
    }

    return true;
  }

  private ejecutarIntercambiarTodasCartasBot(
    partida: Game,
    botId: string,
    rivalId?: string,
  ): boolean {
    if (rivalId == null) {
      return false;
    }

    this.gameService.intercambiarTodasCartas(partida, botId, rivalId);
    this.notificarTodosCambioCartas(partida, botId, rivalId);
    this.finalizarPartidaYSincronizarSala(partida);
    return true;
  }

  private ejecutarHacerRobarCartaBot(
    partida: Game,
    botId: string,
    rivalId?: string,
  ): boolean {
    if (rivalId == null) {
      return false;
    }

    this.gameService.hacerRobarCarta(partida, botId, rivalId);
    this.notificarTodosHacerRobarCarta(partida, botId, rivalId);
    this.finalizarPartidaYSincronizarSala(partida);
    return true;
  }

  private ejecutarProtegerCartaBot(
    partida: Game,
    botId: string,
    cartaIndex?: number,
  ): boolean {
    if (cartaIndex == null) {
      return false;
    }

    this.gameService.protegerCarta(partida, botId, cartaIndex);
    this.finalizarPartidaYSincronizarSala(partida);
    this.notificarTodosCartaProtegida(partida, botId, cartaIndex);
    return true;
  }

  private ejecutarSaltarTurnoJugadorBot(
    partida: Game,
    botId: string,
    rivalId?: string,
  ): boolean {
    if (rivalId == null) {
      return false;
    }

    this.gameService.saltarTurnoJugador(partida, botId, rivalId);
    this.finalizarPartidaYSincronizarSala(partida);
    this.notificarTodosTurnoJugadorSaltado(partida, botId, rivalId);
    return true;
  }

  private ejecutarResolverJBot(
    partida: Game,
    botId: string,
    intercambiar: boolean,
  ): boolean {
    const resultado = this.gameService.resolverDecisionJ(partida, botId, intercambiar);

    if (intercambiar) {
      this.notificarTodosCambioCartas(
        partida,
        botId,
        resultado.rivalId,
        resultado.indexCartaPropia,
        resultado.indexCartaRival,
      );
    }

    this.finalizarPartidaYSincronizarSala(partida);
    return true;
  }

  private ejecutarJugadorMenosPuntuacionBot(partida: Game, botId: string): boolean {
    const jugadorId = this.gameService.jugadorMenosPuntuacion(partida, botId);
    this.server.to(partida.roomId).emit('game:bot-jugador-menos-puntuacion', {
      gameId: partida.gameId,
      botId,
      jugadorId,
    });
    return true;
  }

  private notificarTodosCartaRobada(partida : Game ){
    
    const cartasRestantes = partida.estadoGlobal.cartasVigentes.length;

    this.server.to(partida.roomId).emit('game:carta-robada',{
      partidaId : partida.gameId,
      jugadorRobado: partida.estadoGlobal.turn,
      cartasRestantes: cartasRestantes,
    });

  }
 
  private notificarTodosDescartarPendiente(
    partida: Game,
    carta: Card,
    tipo?: 'descartar' | 'intercambiar',
    numCarta?: number,
  ) {
    this.server.to(partida.roomId).emit('game:descartar-pendiente', {
      partidaId: partida.gameId,
      carta,
      ...(tipo ? { tipo } : {}),
      ...(numCarta !== undefined ? { numCarta } : {}),
    });
  }

  private serializarJugadoresPartida(partida: Game) {
    return partida.estadoGlobal.turnoJugadores.map((userId, index) => {
      const jugador = partida.estadoGlobal.jugadores[index];
      return {
        userId,
        controlador: jugador.controlador,
        dificultadBot: jugador.dificultadBot,
        nombreEnPartida: jugador.nombreEnPartida,
      };
    });
  }

  private serializarEstadoPublicoPartida(partida: Game): EstadoPublicoInicioPartida {
    const ultimaCartaDescartada =
      partida.estadoGlobal.cartasDescartadas[
        partida.estadoGlobal.cartasDescartadas.length - 1
      ] ?? null;

    return {
      turn: partida.estadoGlobal.turn,
      turnoActualUserId:
        partida.estadoGlobal.turnoJugadores[partida.estadoGlobal.turn],
      phase: partida.estadoGlobal.phase,
      turnDeadlineAt: partida.estadoGlobal.turnDeadlineAt,
      numBarajas: partida.estadoGlobal.numBarajas,
      cartasRestantes: partida.estadoGlobal.cartasVigentes.length,
      cartasDescartadas: [...partida.estadoGlobal.cartasDescartadas],
      ultimaCartaDescartada,
      habilidadesActivadas: [...partida.estadoGlobal.habilidadesActivadas],
      cuboActivado: partida.estadoGlobal.cuboActivado,
      cuboSolicitanteId: partida.estadoGlobal.cuboSolicitanteId,
      cuboTurnosRestantes: partida.estadoGlobal.cuboTurnosRestantes,
      jugadores: partida.estadoGlobal.turnoJugadores.map((userId, index) => {
        const jugador = partida.estadoGlobal.jugadores[index];
        return {
          userId,
          controlador: jugador.controlador,
          dificultadBot: jugador.dificultadBot,
          nombreEnPartida: jugador.nombreEnPartida,
          numCartas: jugador.cartasMano.length,
          cartasProtegidas: jugador.cartasMano
            .map((carta, cartaIndex) => (carta.protegida ? cartaIndex : null))
            .filter((cartaIndex): cartaIndex is number => cartaIndex !== null),
          habilidadesActivadas: [...jugador.habilidadesActivadas],
          saltarTurno: Boolean(jugador.saltarTurno),
          tieneCartaPendiente: Boolean(jugador.cartaPendiente),
        };
      }),
    };
  }

  private notificarTodosComienzoPartida(partida: Game, loadedFromSave: boolean){

    this.server.to(partida.roomId).emit('game:inicio-partida',{
      partidaId : partida.gameId,
      gameId: partida.gameId,
      roomId: partida.roomId,
      loadedFromSave,
      jugadores: partida.estadoGlobal.turnoJugadores,
      jugadoresDetalle: this.serializarJugadoresPartida(partida),
      estado: this.serializarEstadoPublicoPartida(partida),
    });
  }

  private notificarTodosCambioControladorJugador(
    partida: Game,
    userId: string,
    controlador: 'humano' | 'bot',
    dificultadBot?: string,
    nombreEnPartida?: string,
  ) {
    this.server.to(partida.roomId).emit('game:player-controller-changed', {
      gameId: partida.gameId,
      userId,
      controlador,
      dificultadBot,
      nombreEnPartida,
    });
  }

  private notificarTodosCambioCartas(
    partida: Game, 
    idRemitente: string,
    idDestinatario: string, 
    numCartaRemitente?: number, 
    numCartaDestinatario?: number,
    cardCountRemitente?: number,
    cardCountDestinatario?: number
  ){
     this.server.to(partida.roomId).emit('game:intercambio-cartas',{
      partidaId : partida.gameId,
      remitente: idRemitente,
      destinatario: idDestinatario,
      numCartaRemitente : numCartaRemitente,
      numCartaDestinatario : numCartaDestinatario,
      ...(cardCountRemitente !== undefined && { cardCountRemitente }),
      ...(cardCountDestinatario !== undefined && { cardCountDestinatario }),
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

  private notificarEstadoPoder8(partida: Game, activadorId: string | null) {
    const pendientes = this.gameService.getHabilidadesSinEfectoRestantes(partida.gameId);
    const pendientesDiferidos =
      this.gameService.getHabilidadesSinEfectoDiferidasRestantes(partida.gameId);

    this.server.to(partida.roomId).emit('game:poder8-estado', {
      gameId: partida.gameId,
      pendientes,
      pendientesDiferidos,
      activadorId,
    });
  }

  private notificarTodosBotVerCarta(
    partida: Game,
    botId: string,
    cartaIndex: number,
  ) {
    this.server.to(partida.roomId).emit('game:bot-ver-carta', {
      gameId: partida.gameId,
      botId,
      cartaIndex,
    });
  }

  private notificarTodosBotVerCartaPropiaYRival(
    partida: Game,
    botId: string,
    rivalId: string,
    cartaIndex: number,
    cartaIndexRival: number,
  ) {
    this.server.to(partida.roomId).emit('game:bot-ver-carta-propia-y-rival', {
      gameId: partida.gameId,
      botId,
      rivalId,
      cartaIndex,
      cartaIndexRival,
    });
  }

  private notificarTodosCartaProtegida(
    partida: Game,
    jugadorId: string,
    cartaIndex: number,
  ) {
    this.server.to(partida.roomId).emit('game:carta-protegida', {
      gameId: partida.gameId,
      jugadorId,
      cartaIndex,
    });
  }

  private notificarTodosAccionProtegidaCancelada(
    partida: Game,
    error: AccionProtegidaCanceladaError,
  ) {
    this.server.to(partida.roomId).emit('game:accion-protegida-cancelada', {
      gameId: partida.gameId,
      accion: error.accion,
      actorId: error.actorId,
      propietarioId: error.propietarioId,
      proteccionesConsumidas: error.proteccionesConsumidas,
      message: error.message,
    });
  }

  private notificarTodosTurnoJugadorSaltado(
    partida: Game,
    remitenteId: string,
    destinatarioId: string,
  ) {
    this.server.to(partida.roomId).emit('game:turno-jugador-saltado', {
      gameId: partida.gameId,
      remitenteId,
      destinatarioId,
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

  /** Emite game:turno-iniciado solo si la partida está en fase WAIT_DRAW. */
  private notificarTurnoIniciadoSiActivo(partida: Game) {
    if (
      partida.estado !== 'activo' ||
      partida.estadoGlobal.phase !== 'WAIT_DRAW'
    ) {
      return;
    }
    const userId =
      partida.estadoGlobal.turnoJugadores[partida.estadoGlobal.turn];
    this.server.to(partida.roomId).emit('game:turno-iniciado', {
      gameId: partida.gameId,
      turn: partida.estadoGlobal.turn,
      userId,
      phase: 'WAIT_DRAW',
      turnDeadlineAt: partida.estadoGlobal.turnDeadlineAt,
    });
    this.notificarEstadoPoder8(partida, null);
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
      this.ensureRematchSession(partida, roomState);
    }

    return true;
  }

  private ensureRematchSession(partida: Game, roomState: { code: string; name: string; hostId: string; rules: RulesConfig; players: Array<{ userId: string; socketId: string; controlador: 'humano' | 'bot'; }>; }): RematchSession {
    const existing = this.rematchSessions.get(partida.gameId);
    if (existing) {
      for (const player of roomState.players) {
        if (player.socketId) {
          existing.socketByUserId.set(player.userId, player.socketId);
        }
      }
      return existing;
    }

    const participantIds = new Set<string>();
    partida.estadoGlobal.turnoJugadores.forEach((userId, index) => {
      const jugador = partida.estadoGlobal.jugadores[index];
      if (jugador.controlador === 'humano') {
        participantIds.add(userId);
      }
    });

    const socketByUserId = new Map<string, string>();
    roomState.players.forEach((player) => {
      if (player.controlador === 'humano' && player.socketId) {
        socketByUserId.set(player.userId, player.socketId);
      }
    });

    const session: RematchSession = {
      gameId: partida.gameId,
      originalRoomCode: roomState.code,
      roomName: roomState.name,
      rules: roomState.rules,
      hostId: roomState.hostId,
      participantIds,
      readyUserIds: new Set<string>(),
      socketByUserId,
      launched: false,
    };

    this.rematchSessions.set(partida.gameId, session);
    return session;
  }

  private getRematchSessionOrThrow(gameId: string): RematchSession {
    // Comprobar primero en el Map: la partida puede haberse limpiado ya del Map
    // de juegos activos por limpiarEstructurasPartida al finalizar.
    const existing = this.rematchSessions.get(gameId);
    if (existing) {
      return existing;
    }

    const partida = this.gameService.getGameById(gameId);

    if (partida.estado !== 'terminado') {
      throw new Error('La revancha solo está disponible al terminar la partida');
    }

    const roomState = this.gameService.getRoomState(partida.roomId);
    if (!roomState) {
      throw new Error('No hay una sala disponible para preparar la revancha');
    }

    return this.ensureRematchSession(partida, roomState);
  }

  private enlazarSocketASala(socketId: string, oldRoomCode: string, newRoomCode: string): void {
    const socket = this.server.sockets.sockets.get(socketId);
    if (!socket) {
      return;
    }

    socket.leave(oldRoomCode);
    socket.join(newRoomCode);
  }

  private construirPayloadRevancha(session: RematchSession, estado: RevanchaEstado) {
    return {
      gameId: session.gameId,
      estado,
      hostId: session.hostId,
      jugadoresListos: Array.from(session.readyUserIds),
      roomCode: session.rematchRoomCode,
      roomName: session.roomName,
    };
  }

  private notificarEstadoRevancha(session: RematchSession, estado: RevanchaEstado, destinatarios: Iterable<string>): void {
    const payload = this.construirPayloadRevancha(session, estado);

    for (const userId of destinatarios) {
      const socketId = session.socketByUserId.get(userId);
      if (!socketId) {
        continue;
      }

      this.server.to(socketId).emit('game:revancha-estado', payload);
    }
  }

  private crearSalaRevancha(session: RematchSession): void {
    if (session.launched) {
      return;
    }

    const hostSocketId = session.socketByUserId.get(session.hostId);
    if (!hostSocketId) {
      throw new Error('El líder no está conectado para crear la revancha');
    }

    this.gameService.desvincularUsuarioDeSalaActiva(session.hostId);

    const room = this.gameService.createRoom(session.hostId, hostSocketId, {
      name: session.roomName,
      rules: session.rules,
    });

    this.enlazarSocketASala(hostSocketId, session.originalRoomCode, room.code);

    for (const userId of session.readyUserIds) {
      if (userId === session.hostId) {
        continue;
      }

      const socketId = session.socketByUserId.get(userId);
      if (!socketId) {
        continue;
      }

      try {
        this.gameService.desvincularUsuarioDeSalaActiva(userId);
        this.gameService.joinRoom(userId, socketId, room.code);
        this.enlazarSocketASala(socketId, session.originalRoomCode, room.code);
      } catch {
        // Si un jugador no puede unirse, el resto no se bloquea.
      }
    }

    session.launched = true;
    session.rematchRoomCode = room.code;
    // Limpiar la sesión tras 5 minutos para evitar memory leak
    setTimeout(() => this.rematchSessions.delete(session.gameId), 5 * 60 * 1000);

    const roomState = this.gameService.getRoomState(room.code);
    if (roomState) {
      this.server.to(room.code).emit('room:update', roomState);
    }
  }

  private unirJugadorATrasLaCreacion(session: RematchSession, userId: string, socketId: string): void {
    if (!session.rematchRoomCode) {
      throw new Error('La sala de revancha aún no está disponible');
    }

    this.gameService.desvincularUsuarioDeSalaActiva(userId);
    this.gameService.joinRoom(userId, socketId, session.rematchRoomCode);
    this.enlazarSocketASala(socketId, session.originalRoomCode, session.rematchRoomCode);

    const roomState = this.gameService.getRoomState(session.rematchRoomCode);
    if (roomState) {
      this.server.to(session.rematchRoomCode).emit('room:update', roomState);
    }
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

  private esErrorCartaProtegidaBloquea(error: unknown): boolean {
    return (
      error instanceof AccionProtegidaCanceladaError ||
      (error instanceof Error &&
        error.message === CARTA_PROTEGIDA_BLOQUEA_ERROR_MESSAGE)
    );
  }

  //FIX: ahora se comprueba que el usuario que solicita iniciar la partida sea
  //el host de la misma.
  async iniciarPartida(
    client: Socket,
    payload?: iniciarPartidaPayload,
  ): Promise<iniciarPartidaResponse> {
    try {
      const userId = this.getUserId(client);
      const { room } = this.gameService.validateStartContext(userId, client.id);

      this.assertSocketInExpectedRoom(client, room.code);

      if (room.hostId !== userId) {
        throw new Error('Solo el host puede iniciar la partida');
      }

      const partida = payload?.savedRoomName
        ? await this.gameService.cargarPartidaGuardada(
            payload.savedRoomName,
            userId,
            client.id,
          )
        : this.gameService.inicioPartida(room);

      const loadedFromSave = Boolean(payload?.savedRoomName);

      this.notificarTodosComienzoPartida(partida, loadedFromSave);
      this.scheduleBotProcessing(partida);

      return{
        success: true,
        gameId: partida.gameId,
        roomId: partida.roomId,
        loadedFromSave,
        estado: this.serializarEstadoPublicoPartida(partida),
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
        savedRoomName: resultado.savedRoomName,
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

  @SubscribeMessage('game:abandonar-partida')
  abandonarPartida(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: abandonarPartidaPayload,
  ) {
    try {
      const { partida, userId } = this.getValidatedGameContext(client, payload.gameId);
      const resultado = this.gameService.abandonarPartidaConBot(
        partida,
        userId,
        payload.dificultadBot ?? 'media',
      );

      if (!resultado) {
        throw new Error('No se ha podido sustituir al jugador por un bot');
      }

      this.notificarTodosCambioControladorJugador(
        resultado.partida,
        resultado.userId,
        resultado.controlador,
        resultado.dificultadBot,
        resultado.nombreEnPartida,
      );

      if (resultado.roomState) {
        this.server.to(resultado.partida.roomId).emit('room:update', resultado.roomState);
      }

      client.leave(resultado.partida.roomId);
      this.scheduleBotProcessing(resultado.partida);

      return {
        success: true,
        gameId: resultado.partida.gameId,
        userId: resultado.userId,
        controlador: resultado.controlador,
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
        carta: resultado.cartaRobada,
      });
      this.scheduleBotProcessing(partida);

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

      if(
        resultado.resultadoHabilidad.tipo === 'roba-y-sigue' ||
        resultado.resultadoHabilidad.tipo === 'roba-y-decide'
      ){
        // El jugador descartó un 6: se emite la nueva carta al cliente.
        // roba-y-decide: la carta queda como pendiente (WAIT_DECISION).
        this.server.to(client.id).emit('game:carta-robada-por-descartar-6', {
          gameId: payload.gameId,
          cartaRobada: resultado.resultadoHabilidad.cartaRobada,
          reshuffle: resultado.resultadoHabilidad.reshuffle,
        });
        this.notificarTodosCartaRobada(partida);
      }

      this.notificarTodosDescartarPendiente(
        partida,
        resultado.cartaDescartada,
        'descartar',
      );
      this.scheduleBotProcessing(partida);
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

      this.notificarTodosDescartarPendiente(
        partida,
        carta,
        'intercambiar',
        payload.numCarta,
      );
      this.scheduleBotProcessing(partida);
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
    let partida: Game | undefined;
    let remitenteId: string | undefined;

    try {
      const contexto = this.getValidatedGameContext(
        client,
        payload.gameId,
      );
      partida = contexto.partida;
      remitenteId = contexto.userId;

      const resultado = this.gameService.intercambiarCarta(partida, remitenteId,
        payload.destinatarioId, payload.numCartaRemitente, 
        payload.numCartaDestinatario);

        this.notificarTodosCambioCartas(partida,remitenteId, payload.destinatarioId
        ,payload.numCartaRemitente, payload.numCartaDestinatario);
      this.scheduleBotProcessing(partida);

      return {
        success: true,
        //aqui lo del todo...
      };
    } catch (error) {
      if (error instanceof AccionProtegidaCanceladaError && partida && remitenteId) {
        this.notificarTodosAccionProtegidaCancelada(partida, error);
        return {
          success: true,
          gameId: partida.gameId,
          accionCancelada: true,
        };
      }
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
      this.scheduleBotProcessing(partida);

      return {
        success: true,
        gameId: partida.gameId,
      };
    } catch (error) {
      if (this.esErrorHabilidadDenegada(error) && partida && userId) {
        this.notificarTodosHabilidadDenegada(partida, userId, 'ver-carta');
        this.finalizarPartidaYSincronizarSala(partida);
        this.notificarEstadoPoder8(partida, null);
        this.scheduleBotProcessing(partida);
        return {
          success: true,
          gameId: partida.gameId,
          habilidadDenegada: true,
        };
      }
      if (error instanceof AccionProtegidaCanceladaError && partida && userId) {
        this.notificarTodosAccionProtegidaCancelada(partida, error);
        this.finalizarPartidaYSincronizarSala(partida);
        this.scheduleBotProcessing(partida);
        return {
          success: true,
          gameId: partida.gameId,
          accionCancelada: true,
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
    let partida: Game | undefined;
    let remitenteId: string | undefined;

    try{
      const contexto = this.getValidatedGameContext(client, payload.gameId);
      partida = contexto.partida;
      remitenteId = contexto.userId;

      this.gameService.intercambiarTodasCartas(partida, remitenteId,
        payload.destinatarioId);
      
      // Calcular los nuevos cardCounts para enviar al cliente
      const idEnPartidaR = partida.estadoGlobal.turnoJugadores.indexOf(remitenteId);
      const idEnPartidaD = partida.estadoGlobal.turnoJugadores.indexOf(payload.destinatarioId);
      const cardCountRemitente = idEnPartidaR >= 0 ? partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano.length : 0;
      const cardCountDestinatario = idEnPartidaD >= 0 ? partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano.length : 0;
      
      this.notificarTodosCambioCartas(partida, remitenteId,
        payload.destinatarioId, undefined, undefined, cardCountRemitente, cardCountDestinatario);
      this.finalizarPartidaYSincronizarSala(partida);
      this.scheduleBotProcessing(partida);

      return { success: true };
    } catch (error){
      if (this.esErrorCartaProtegidaBloquea(error) && partida && remitenteId) {
        if (error instanceof AccionProtegidaCanceladaError) {
          this.notificarTodosAccionProtegidaCancelada(partida, error);
        } else {
          this.notificarTodosHabilidadDenegada(partida, remitenteId, 'intercambiar-todas');
        }
        this.finalizarPartidaYSincronizarSala(partida);
        this.scheduleBotProcessing(partida);
        return { success: true, gameId: partida.gameId, accionCancelada: true };
      }
      if (this.esErrorHabilidadDenegada(error) && partida && remitenteId) {
        this.notificarTodosHabilidadDenegada(partida, remitenteId, 'intercambiar-todas');
        this.finalizarPartidaYSincronizarSala(partida);
        this.notificarEstadoPoder8(partida, null);
        this.scheduleBotProcessing(partida);
        return { success: true, gameId: partida.gameId, habilidadDenegada: true };
      }
      this.handleWsError(error);
    }
  }

  @SubscribeMessage('game:resolver-j')
  resolverJ(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: resolverJPayload,
  ) {
    let partida: Game | undefined;
    let userId: string | undefined;

    try {
      const contexto = this.getValidatedGameContext(client, payload.gameId);
      partida = contexto.partida;
      userId = contexto.userId;

      const resultado = this.gameService.resolverDecisionJ(
        partida,
        userId,
        payload.intercambiar,
      );

      if (payload.intercambiar) {
        this.notificarTodosCambioCartas(
          partida,
          userId,
          resultado.rivalId,
          resultado.indexCartaPropia,
          resultado.indexCartaRival,
        );
      }

      this.finalizarPartidaYSincronizarSala(partida);
      this.scheduleBotProcessing(partida);

      return { success: true, gameId: partida.gameId };
    } catch (error) {
      if (error instanceof AccionProtegidaCanceladaError && partida && userId) {
        this.notificarTodosAccionProtegidaCancelada(partida, error);
        this.finalizarPartidaYSincronizarSala(partida);
        this.scheduleBotProcessing(partida);
        return {
          success: true,
          gameId: partida.gameId,
          accionCancelada: true,
        };
      }
      this.handleWsError(error);
    }
  }


  @SubscribeMessage('game:hacer-robar-carta')
  hacerRobarCarta(
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
      this.scheduleBotProcessing(partida);

      return { success: true };
    } catch (error) {
      if (this.esErrorSinCartas(error) && partida) {
        this.finalizarPartidaYSincronizarSala(partida, 'sinCartasMazo');
        return { success: true };
      }
      if (this.esErrorHabilidadDenegada(error) && partida && remitenteId) {
        this.notificarTodosHabilidadDenegada(partida, remitenteId, 'hacer-robar-carta');
        this.finalizarPartidaYSincronizarSala(partida);
        this.notificarEstadoPoder8(partida, null);
        this.scheduleBotProcessing(partida);
        return { success: true, gameId: partida.gameId, habilidadDenegada: true };
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
      this.notificarTodosCartaProtegida(partida, remitenteId, payload.numCarta);
      this.scheduleBotProcessing(partida);
  
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
          this.notificarEstadoPoder8(partida, null);
          this.scheduleBotProcessing(partida);
          return {
            success: true,
            gameId: partida.gameId,
            habilidadDenegada: true,
          };
        }
        this.handleWsError(error);
    }
  }

  @SubscribeMessage('game:saltar-turno-jugador')
  saltarTurnoJugador(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: saltarTurnoJugadorPayload,
  ) {
    let partida: Game | undefined;
    let remitenteId: string | undefined;

    try {
      const contexto = this.getValidatedGameContext(
        client,
        payload.gameId,
      );
      partida = contexto.partida;
      remitenteId = contexto.userId;

      this.gameService.saltarTurnoJugador(partida, remitenteId, payload.adversarioId);
      
      this.notificarTodosTurnoJugadorSaltado(partida, remitenteId, payload.adversarioId);
      this.scheduleBotProcessing(partida);
  
      return {
        success: true,
      };
    } catch (error) {
      if (this.esErrorHabilidadDenegada(error) && partida && remitenteId) {
        this.notificarTodosHabilidadDenegada(
          partida,
          remitenteId,
          'saltar-turno-jugador',
        );
        this.finalizarPartidaYSincronizarSala(partida);
        this.notificarEstadoPoder8(partida, null);
        this.scheduleBotProcessing(partida);
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
      this.scheduleBotProcessing(partida);

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
        this.notificarEstadoPoder8(partida, null);
        this.scheduleBotProcessing(partida);
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
      this.notificarEstadoPoder8(partida, userId);
      this.scheduleBotProcessing(partida);

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
      this.scheduleBotProcessing(partida);

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
        const rival = contexto.room.players.get(payload.rivalId);
        if (!rival) {
          throw new Error('El rival seleccionado no pertenece a la sala');
        }

        if (rival.controlador === 'humano' && rival.socketId) {
          this.server.to(rival.socketId).emit('game:intercambio-rival', {
            gameId: payload.gameId,
            usuarioIniciador: contexto.userId,
          });
        }
      } 
      this.scheduleBotProcessing(partida);

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
  
   @SubscribeMessage('game:intercambiar-carta-interactivo')
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
      this.scheduleBotProcessing(partida);

      return {
        success: true,
        gameId: payload.gameId,
      };
    } catch (error) {
      if (this.esErrorSinCartas(error) && partida) {
        this.finalizarPartidaYSincronizarSala(partida, 'sinCartasMazo');
      }
      if (error instanceof AccionProtegidaCanceladaError && partida) {
        this.notificarTodosAccionProtegidaCancelada(partida, error);
        this.finalizarPartidaYSincronizarSala(partida);
        this.scheduleBotProcessing(partida);
        return {
          success: true,
          gameId: partida.gameId,
          accionCancelada: true,
        };
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

  @SubscribeMessage('game:volver-a-jugar')
  volverAJugar(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: volverAJugarPayload,
  ) {
    try {
      const userId = this.getUserId(client);
      const session = this.getRematchSessionOrThrow(payload.gameId);

      if (!session.participantIds.has(userId)) {
        throw new Error('Solo los jugadores humanos de la partida pueden solicitar revancha');
      }

      session.socketByUserId.set(userId, client.id);
      session.readyUserIds.add(userId);

      if (!session.launched) {
        if (!session.readyUserIds.has(session.hostId)) {
          this.notificarEstadoRevancha(session, 'waiting-host', session.readyUserIds);
          return {
            success: true,
            gameId: session.gameId,
            estado: 'waiting-host',
          };
        }

        this.crearSalaRevancha(session);
        this.notificarEstadoRevancha(session, 'room-ready', session.readyUserIds);

        return {
          success: true,
          gameId: session.gameId,
          estado: 'room-ready',
          roomCode: session.rematchRoomCode,
          roomName: session.roomName,
        };
      }

      if (!session.rematchRoomCode) {
        throw new Error('La sala de revancha aún no está disponible');
      }

      const roomActual = this.gameService.getRoomByUserId(userId);
      if (!roomActual || roomActual.code !== session.rematchRoomCode) {
        this.unirJugadorATrasLaCreacion(session, userId, client.id);
      }

      this.notificarEstadoRevancha(session, 'room-ready', [userId]);

      return {
        success: true,
        gameId: session.gameId,
        estado: 'room-ready',
        roomCode: session.rematchRoomCode,
        roomName: session.roomName,
      };
    } catch (error) {
      this.handleWsError(error);
    }
  }
 
////////////////////////////////////////////////////////////////////////////////
//                              HABILIDADES DE CARTAS                         //
////////////////////////////////////////////////////////////////////////////////

  /** Poder del 5: el jugador activo ve una carta aleatoria de cada rival. */
  @SubscribeMessage('game:ver-carta-todos')
  verCartaTodos(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: verCartaTodosPayload,
  ) {
    let partida: Game | undefined;
    let userId: string | undefined;

    try {
      const contexto = this.getValidatedGameContext(client, payload.gameId);
      partida = contexto.partida;
      userId = contexto.userId;

      const cartasReveladas: CartaReveladaTodos[] =
        this.gameService.verCartaTodos(partida, userId);

      // Solo el solicitante recibe las cartas reveladas
      this.server.to(client.id).emit('game:cartas-reveladas-todos', {
        gameId: payload.gameId,
        cartasReveladas,
      });

      this.finalizarPartidaYSincronizarSala(partida);
      this.scheduleBotProcessing(partida);

      return {
        success: true,
        gameId: partida.gameId,
      };
    } catch (error) {
      if (this.esErrorHabilidadDenegada(error) && partida && userId) {
        this.notificarTodosHabilidadDenegada(partida, userId, 'ver-carta-todos');
        this.finalizarPartidaYSincronizarSala(partida);
        this.notificarEstadoPoder8(partida, null);
        this.scheduleBotProcessing(partida);
        return {
          success: true,
          gameId: partida.gameId,
          habilidadDenegada: true,
        };
      }
      this.handleWsError(error);
    }
  }






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
      room: validation.room,
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
