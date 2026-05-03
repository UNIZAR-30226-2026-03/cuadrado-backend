import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  EstadoInicialJugador,
  GameManager,
  PersistedGameState,
  PermisoHabilidad,
  ResultadoPonerCartaSobreOtra,
  ResultadoRobarCarta,
  CartaReveladaTodos,
} from './game.manager';
import { Game } from './interfaces/game.interface';
import { dificultadBot, Room, RoomState } from '../rooms/interfaces/room.interface';
import { Player } from '../rooms/interfaces/player.interface';
import {
  AVAILABLE_POWERS,
  DEFAULT_ROOM_BOT_DIFFICULTY,
  DEFAULT_DECK_COUNT,
  ROOM_BOT_DIFFICULTIES,
  RoomBotDifficulty,
  RulesConfig,
} from '../rooms/interfaces/rules-config.interface';
import { RoomsService } from '../rooms/rooms.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomInput } from '../rooms/room.manager';

export interface ValidatedGameContext {
  game: Game;
  room: Room;
  player: Player;
}

export interface ValidatedStartContext {
  room: Room;
  player: Player;
}

export interface SavedGameSummary {
  gameId: string;
  creatorId: string;
  roomName: string;
  updatedAt: Date;
  players: string[];
}

export interface SavedRoomConfig {
  roomName: string;
  rules: RulesConfig;
}

export interface ResultadoSustitucionBot {
  partida: Game;
  roomState: RoomState | null;
  userId: string;
  controlador: 'bot';
  dificultadBot: dificultadBot;
  nombreEnPartida?: string;
}

@Injectable()
export class GameService {
  constructor(
    @Inject(GameManager) private readonly gameManager: GameManager,
    private readonly roomsService: RoomsService,
    private readonly prisma: PrismaService,
  ) {}
  
  getGameById(gameId: string) : Game {
    return this.gameManager.getGameById(gameId);
  }
  getGameByRoomId(roomId: string): Game {
    return this.gameManager.getGameByRoomId(roomId);
  }

  getActiveGames(): Game[] {
    return this.gameManager.getActiveGames();
  }

  getRoomState(roomCode: string): RoomState | null {
    return this.roomsService.getRoomState(roomCode);
  }

  getBotDecisionContext(gameId: string, botId: string): PermisoHabilidad | null {
    return this.gameManager.getBotDecisionContext(gameId, botId);
  }

  resolverTimeoutsTurnoActivos(): Game[] {
    const partidasAfectadas: Game[] = [];
    const partidasActivas = this.gameManager.getActiveGames();

    for (const partida of partidasActivas) {
      const huboTimeout = this.gameManager.resolverTimeoutTurno(partida);
      if (huboTimeout) {
        partidasAfectadas.push(partida);
      }
    }

    return partidasAfectadas;
  }

  abandonarPartidaConBot(
    partida: Game,
    userId: string,
    dificultad: dificultadBot = 'media',
  ): ResultadoSustitucionBot | null {
    const room = this.roomsService.getRoomByUserId(userId);
    if (!room || !room.started || room.code !== partida.roomId) {
      return null;
    }

    const player = room.players.get(userId);
    if (!player || player.controlador === 'bot') {
      return null;
    }

    this.roomsService.marcarJugadorDesconectado(userId);

    const playerActualizado = this.roomsService.cambiarControladorJugador(
      userId,
      'bot',
      dificultad,
    );
    if (!playerActualizado) {
      return null;
    }

    this.gameManager.cambiarControladorJugador(
      partida,
      userId,
      'bot',
      playerActualizado.dificultadBot,
      playerActualizado.nombreEnPartida,
    );

    this.roomsService.desvincularUsuarioDeSalaActiva(userId);

    return {
      partida,
      roomState: this.roomsService.getRoomState(room.code),
      userId,
      controlador: 'bot',
      dificultadBot: playerActualizado.dificultadBot ?? dificultad,
      nombreEnPartida: playerActualizado.nombreEnPartida,
    };
  }

  async guardarYcerrarPartida(game: Game, hostUserId: string): Promise<{
    roomCode: string;
    gameId: string;
    savedRoomName: string;
  }> {
    const room = this.roomsService.getRoomByUserId(hostUserId);
    if (!room) {
      throw new Error('El usuario no pertenece a ninguna sala');
    }

    if (room.code !== game.roomId) {
      throw new Error('La partida no corresponde a la sala del usuario');
    }

    if (room.hostId !== hostUserId) {
      throw new Error('Solo el creador de la sala puede guardar y cerrar');
    }

    const persisted = this.gameManager.exportarEstadoPersistido(game);

    await this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.gameState.upsert({
        where: {
          creatorId_roomName: {
            creatorId: hostUserId,
            roomName: room.name,
          },
        },
        create: {
          creatorId: hostUserId,
          roomName: room.name,
          roomRules: this.toPrismaJsonRules(room.rules),
          habilidadesActivadas: persisted.habilidadesActivadas,
          discardedCards: persisted.discardedCards,
          turn: persisted.turn,
          updatedAt: new Date(),
        },
        update: {
          creatorId: hostUserId,
          roomName: room.name,
          roomRules: this.toPrismaJsonRules(room.rules),
          habilidadesActivadas: persisted.habilidadesActivadas,
          discardedCards: persisted.discardedCards,
          turn: persisted.turn,
          updatedAt: new Date(),
        },
      });

      await tx.pausedGamePlayer.deleteMany({
        where: { gameStateId: snapshot.id },
      });

      await tx.pausedGamePlayer.createMany({
        data: persisted.players.map((player) => ({
          gameStateId: snapshot.id,
          userId: player.userId,
          turnOrder: player.turnOrder,
          cards: player.cards,
          habilidades: player.habilidades,
          controlador: player.controlador,
          dificultadBot: player.dificultadBot,
          nombreEnPartida: player.nombreEnPartida,
        })),
      });
    });

    this.gameManager.cerrarPartidaActiva(game.gameId);

    const leaveResult = this.roomsService.leaveRoom(hostUserId);
    if (!leaveResult.room || !leaveResult.isHostLeaving) {
      throw new Error('No se pudo cerrar la sala tras guardar la partida');
    }

    return {
      roomCode: leaveResult.room.code,
      gameId: game.gameId,
      savedRoomName: room.name,
    };
  }

  async listarPartidasGuardadas(creatorId: string): Promise<SavedGameSummary[]> {
    const partidas = await this.prisma.gameState.findMany({
      where: { creatorId },
      include: { pausedGamePlayers: true },
      orderBy: { updatedAt: 'desc' },
    });

    return partidas.map((partida) => ({
      gameId: partida.id,
      creatorId: partida.creatorId,
      roomName: this.requireRoomName(partida.roomName),
      updatedAt: partida.updatedAt,
      players: partida.pausedGamePlayers
        .sort((a, b) => a.turnOrder - b.turnOrder)
        .map((player) => player.userId),
    }));
  }

  async getSavedRoomConfigByName(
    creatorId: string,
    roomName: string,
  ): Promise<SavedRoomConfig | null> {
    const normalizedName = roomName.trim();
    if (!normalizedName) {
      return null;
    }

    const snapshot = await this.prisma.gameState.findUnique({
      where: {
        creatorId_roomName: {
          creatorId,
          roomName: normalizedName,
        },
      },
    });

    if (!snapshot) {
      return null;
    }

    return {
      roomName: this.requireRoomName(snapshot.roomName),
      rules: this.parseRulesConfig(snapshot.roomRules),
    };
  }

  async cargarPartidaGuardada(
    savedRoomName: string,
    hostUserId: string,
    socketId: string,
  ): Promise<Game> {
    const { room } = this.validateStartContext(hostUserId, socketId);

    if (room.hostId !== hostUserId) {
      throw new Error('Solo el creador de la sala puede cargar una partida guardada');
    }

    const snapshot = await this.prisma.gameState.findUnique({
      where: {
        creatorId_roomName: {
          creatorId: hostUserId,
          roomName: savedRoomName,
        },
      },
      include: { pausedGamePlayers: true },
    });

    if (!snapshot) {
      throw new Error('No tienes una partida guardada con ese identificador');
    }

    room.rules = this.parseRulesConfig(snapshot.roomRules);

    //he puesto aqui unas cuantas cosas para la carga de bots
    const playersGuardados = snapshot.pausedGamePlayers.map((player) => ({
      userId: player.userId,
      turnOrder: player.turnOrder,
      cards: player.cards,
      habilidades: player.habilidades,
      controlador: player.controlador as 'humano' | 'bot',
      dificultadBot: player.dificultadBot as dificultadBot | undefined,
      nombreEnPartida: player.nombreEnPartida ?? undefined,
    }));

    //porque aun guardamos por separado la dificultad. se podria cambiar pero bueno, por ahora se queda asi 
    const dificultadBots =
      playersGuardados.find((player) => player.controlador === 'bot')
        ?.dificultadBot ??
      room.rules.dificultadBots ??
      DEFAULT_ROOM_BOT_DIFFICULTY;

    for (const player of playersGuardados) {
      if (player.controlador !== 'bot') {
        continue;
      }

      if (room.players.has(player.userId)) {
        continue;
      }

      room.players.set(player.userId, {
        userId: player.userId,
        controlador: 'bot',
        dificultadBot: player.dificultadBot ?? dificultadBots,
        nombreEnPartida: player.nombreEnPartida,
        idInRoom: room.players.size,
        socketId: '',
        isHost: false,
        joinedAt: new Date(),
        connected: true,
      });
    }

    const idsGuardados = new Set(playersGuardados.map((player) => player.userId));
    const idsSala = new Set(Array.from(room.players.keys()));

    if (idsGuardados.size !== idsSala.size) {
      throw new Error('La sala no tiene los mismos jugadores que la partida guardada');
    }

    for (const userId of idsGuardados) {
      if (!idsSala.has(userId)) {
        throw new Error('La sala no tiene los mismos jugadores que la partida guardada');
      }
    }

    const allConnected = Array.from(room.players.values()).every(
      (player) => player.connected || player.controlador === 'bot',
    );
    if (!allConnected) {
      throw new Error('Todos los jugadores deben estar conectados para cargar la partida');
    }

    const persisted: PersistedGameState = {
      turn: snapshot.turn,
      deckCount: room.rules.deckCount,
      habilidadesActivadas: snapshot.habilidadesActivadas,
      discardedCards: snapshot.discardedCards,
      players: playersGuardados.map((player) => ({
        userId: player.userId,
        controlador: player.controlador,
        dificultadBot: player.dificultadBot,
        nombreEnPartida: player.nombreEnPartida,
        turnOrder: player.turnOrder,
        cards: player.cards,
        habilidades: player.habilidades,
      })),
    };

    room.started = true;

    return this.gameManager.cargarEstadoPersistido(room.code, persisted);
  }

  validateStartContext(userId: string, socketId: string): ValidatedStartContext {
    const room = this.roomsService.getRoomByUserId(userId);

    if (!room) {
      throw new Error('El usuario no pertenece a ninguna sala');
    }

    const player = room.players.get(userId);
    if (!player) {
      throw new Error('El usuario no pertenece a la sala');
    }

    if (!player.connected) {
      throw new Error('El jugador no está conectado');
    }

    if (player.socketId !== socketId) {
      throw new Error('El socket no corresponde al jugador de la sala');
    }

    return { room, player };
  }

  validateGameContext(
    gameId: string,
    userId: string,
    socketId: string,
  ): ValidatedGameContext {
    const game = this.gameManager.getGameById(gameId);

    if (game.estado !== 'activo') {
      throw new Error('La partida no está activa');
    }

    const room = this.roomsService.getRoomByUserId(userId);
    if (!room) {
      throw new Error('El usuario no pertenece a ninguna sala');
    }

    if (room.code !== game.roomId) {
      throw new Error('El usuario no pertenece a la sala de esta partida');
    }

    if (!room.started) {
      throw new Error('La sala no ha iniciado la partida');
    }

    const player = room.players.get(userId);
    if (!player) {
      throw new Error('El usuario no pertenece a la sala de esta partida');
    }

    if (!player.connected) {
      throw new Error('El jugador no está conectado');
    }

    if (player.socketId !== socketId) {
      throw new Error('El socket no corresponde al jugador de la sala');
    }

    if (!game.estadoGlobal.turnoJugadores.includes(userId)) {
      throw new Error('El usuario no pertenece a la partida');
    }

    return {
      game,
      room,
      player,
    };
  }

  inicioPartida(room: Room): Game {
    const jugadoresIniciales: EstadoInicialJugador[] = Array.from(
      room.players.values(),
    ).map((player) => ({
      userId: player.userId,
      controlador: player.controlador,
      dificultadBot: player.dificultadBot,
      nombreEnPartida: player.nombreEnPartida,
    }));

    room.started = true;

    return this.gameManager.inicioPartida(room.code, jugadoresIniciales, {
      deckCount: room.rules.deckCount,
      enabledPowers: room.rules.enabledPowers,
    });
  }

  robarCarta(partida: Game, userId: string): ResultadoRobarCarta {
    return this.gameManager.robarCarta(partida,userId);
  }

  descartarPendiente(partida : Game, userId: string) {
    return this.gameManager.descartarCartaPendiente(partida,userId);
  }
  
  cartaPorPendiente(partida: Game, numCarta: number, userId: string){
    return this.gameManager.descartarCartaPorPendiente(
      partida, 
      numCarta, 
      userId,
    );
  }

  intercambiarCarta(partida: Game, remitenteId:string, destinatarioId:string,
    numCartaRemitente: number, numCartaDestinatario: number){
      return this.gameManager.intercambiarCarta(
        partida, remitenteId, destinatarioId, numCartaRemitente,
        numCartaDestinatario
      );
  }

  intercambiarCartaBot(
    partida: Game,
    remitenteId: string,
    destinatarioId: string,
    numCartaRemitente: number,
    numCartaDestinatario: number,
  ) {
    return this.gameManager.intercambiarCartaBot(
      partida,
      remitenteId,
      destinatarioId,
      numCartaRemitente,
      numCartaDestinatario,
    );
  }

  verCarta(partida: Game, solicitanteId : string, indexCarta: number, playerId?: string
    ,indexCartaPlayer?: number
  ){
    return this.gameManager.verCarta(partida, solicitanteId, indexCarta, playerId
      ,indexCartaPlayer
    );
  } 

  verCartaTodos(partida: Game, solicitanteId: string): CartaReveladaTodos[] {
    return this.gameManager.verCartaTodos(partida, solicitanteId);
  }

  intercambiarTodasCartas(partida: Game, remitenteId:string, destinatarioId:string){
    return this.gameManager.intercambiarTodasCartas(partida, remitenteId, destinatarioId);
  }

  resolverDecisionJ(partida: Game, userId: string, intercambiar: boolean) {
    return this.gameManager.resolverDecisionJ(partida, userId, intercambiar);
  }

  hacerRobarCarta(partida: Game, userId : string, adversarioId : string){
    return this.gameManager.hacerRobarCarta(partida,userId,adversarioId);
  }

  protegerCarta(partida : Game, userId: string, numCarta : number) {
    this.gameManager.protegerCarta(partida,userId,numCarta);
  }

  saltarTurnoJugador(partida: Game, userId: string, adversarioId: string) {
    return this.gameManager.saltarTurnoJugador(partida, userId, adversarioId);
  }

  jugadorMenosPuntuacion(partida: Game, userId: string) {
    return this.gameManager.jugadorMenosPuntuacion(partida, userId);
  }

  desactivarProximaHabilidad(partida: Game, userId: string) {
    return this.gameManager.desactivarProximaHabilidad(partida, userId);
  }

  getHabilidadesSinEfectoRestantes(gameId: string): number {
    return this.gameManager.getHabilidadesSinEfectoRestantes(gameId);
  }

  getHabilidadesSinEfectoDiferidasRestantes(gameId: string): number {
    return this.gameManager.getHabilidadesSinEfectoDiferidasRestantes(gameId);
  }

  calcularPuntosJugador(partida: Game, userId: string){
    return this.gameManager.calcularPuntosJugador(partida, userId);
  }

  solicitarCubo(partida: Game, userId: string) {
    return this.gameManager.solicitarCubo(partida, userId);
  }

  resetRoomAfterGame(roomCode: string) {
    return this.roomsService.resetRoomAfterGame(roomCode);
  }

  resetRoomAfterGameAndGetState(roomCode: string): RoomState | null {
    this.roomsService.resetRoomAfterGame(roomCode);
    return this.roomsService.getRoomState(roomCode);
  }

  getRoomByUserId(userId: string): Room | null {
    return this.roomsService.getRoomByUserId(userId);
  }

  desvincularUsuarioDeSalaActiva(userId: string): Room | null {
    return this.roomsService.desvincularUsuarioDeSalaActiva(userId);
  }

  createRoom(userId: string, socketId: string, input: CreateRoomInput): Room {
    return this.roomsService.createRoom(userId, socketId, input);
  }

  joinRoom(userId: string, socketId: string, roomCode: string): Room {
    return this.roomsService.joinRoom(userId, socketId, roomCode);
  }

  solicitarColocarCartaSobreOtra(idPartida : string, userId: string){
    return this.gameManager.solicitarColocarCartaSobreOtra(idPartida, userId);
  }
  
  ponerCartaSobreotra(
    partida : Game,
    userId : string,
    numCarta :number,
  ): ResultadoPonerCartaSobreOtra {
    return this.gameManager.ponerCartaSobreOtra(partida, userId, numCarta);
  }

  prepararIntercabioCarta(
    partida : Game,
    userId : string,
    rivalId : string,
    numCartaJugador : number
  ) : boolean {
    return this.gameManager.
      prepararIntercambioCarta(partida,userId,rivalId,numCartaJugador);
  }

  intercambiarCartaInteractivo(
    partida: Game,
    userId: string,
    rivalId: string,
    numCarta: number,
  ) : boolean {
    return this.gameManager.intercambiarCartaInteractivo(
      partida,
      userId,
      rivalId,
      numCarta,
    );
  }

  calcularRecompensas(partida: Game) {
    return this.gameManager.calcularRecompensas(partida);
  }

  async aplicarRecompensas(
    recompensas: Array<{ userId: string; posicion: number; eloChange: number; cubitosChange: number }>,
  ): Promise<void> {
    for (const recompensa of recompensas) {
      await this.prisma.user.update({
        where: { username: recompensa.userId },
        data: {
          eloRating: {
            increment: recompensa.eloChange,
          },
          cubitos: {
            increment: recompensa.cubitosChange,
          },
          gamesPlayed: {
            increment: 1,
          },
          gamesWon: recompensa.posicion === 1 ? { increment: 1 } : undefined,
        },
      });
    }
  }

  private parseRulesConfig(rawRules: unknown): RulesConfig {
    if (
      typeof rawRules !== 'object' ||
      rawRules === null ||
      Array.isArray(rawRules)
    ) {
      throw new Error('Las reglas guardadas tienen un formato inválido');
    }

    const rules = rawRules as Partial<RulesConfig>;
    const {
      maxPlayers,
      turnTimeSeconds,
      isPrivate,
      fillWithBots,
      dificultadBots,
      deckCount,
      enabledPowers,
    } = rules;

    const normalizedDeckCount =
      deckCount == null ? DEFAULT_DECK_COUNT : deckCount;

    if (normalizedDeckCount !== 1 && normalizedDeckCount !== 2) {
      throw new Error('Las reglas guardadas tienen un formato inválido');
    }

    const normalizedEnabledPowers = this.parseEnabledPowers(enabledPowers);
    const normalizedBotDifficulty = this.parseRoomBotDifficulty(dificultadBots);

    if (
      typeof maxPlayers !== 'number' ||
      typeof turnTimeSeconds !== 'number' ||
      typeof isPrivate !== 'boolean' ||
      typeof fillWithBots !== 'boolean'
    ) {
      throw new Error('Las reglas guardadas tienen un formato inválido');
    }

    return {
      maxPlayers,
      turnTimeSeconds,
      isPrivate,
      fillWithBots,
      dificultadBots: normalizedBotDifficulty,
      deckCount: normalizedDeckCount,
      enabledPowers: normalizedEnabledPowers,
    };
  }

  //Se ha preguntado a chatGPT como pasar un objeto a Json y ha enseñado las funciones de Prisma
  private toPrismaJsonRules(rules: RulesConfig): Prisma.InputJsonValue {
    return {
      maxPlayers: rules.maxPlayers,
      turnTimeSeconds: rules.turnTimeSeconds,
      isPrivate: rules.isPrivate,
      fillWithBots: rules.fillWithBots,
      dificultadBots: rules.dificultadBots ?? DEFAULT_ROOM_BOT_DIFFICULTY,
      deckCount: rules.deckCount ?? DEFAULT_DECK_COUNT,
      enabledPowers: rules.enabledPowers ?? [...AVAILABLE_POWERS],
    };
  }

  private parseRoomBotDifficulty(dificultad: unknown): RoomBotDifficulty {
    if (dificultad == null) {
      return DEFAULT_ROOM_BOT_DIFFICULTY;
    }

    if (
      typeof dificultad === 'string' &&
      ROOM_BOT_DIFFICULTIES.includes(dificultad as RoomBotDifficulty)
    ) {
      return dificultad as RoomBotDifficulty;
    }

    throw new Error('Las reglas guardadas tienen un formato invalido');
  }

  private parseEnabledPowers(enabledPowers: unknown): number[] {
    if (enabledPowers == null) {
      return [...AVAILABLE_POWERS];
    }

    if (!Array.isArray(enabledPowers)) {
      throw new Error('Las reglas guardadas tienen un formato inválido');
    }

    const normalized = new Set<number>();

    for (const power of enabledPowers) {
      if (typeof power !== 'number' || !Number.isInteger(power)) {
        throw new Error('Las reglas guardadas tienen un formato inválido');
      }

      if (!AVAILABLE_POWERS.includes(power as (typeof AVAILABLE_POWERS)[number])) {
        throw new Error('Las reglas guardadas tienen un formato inválido');
      }

      normalized.add(power);
    }

    return [...normalized];
  }

  private requireRoomName(roomName: string | null): string {
    if (!roomName) {
      throw new Error('La partida guardada no contiene el nombre de sala');
    }

    return roomName;
  }

}
