import { Inject, Injectable } from '@nestjs/common';
import {
  GameManager,
  PersistedGameState,
  ResultadoPonerCartaSobreOtra,
  ResultadoRobarCarta,
} from './game.manager';
import { Game } from './interfaces/game.interface';
import { Room } from '../rooms/interfaces/room.interface';
import { Player } from '../rooms/interfaces/player.interface';
import { RoomsService } from '../rooms/rooms.service';
import { RoomState } from '../rooms/interfaces/room.interface';
import { PrismaService } from '../prisma/prisma.service';

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
  updatedAt: Date;
  players: string[];
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

  async guardarYcerrarPartida(game: Game, hostUserId: string): Promise<{
    roomCode: string;
    gameId: string;
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
      await tx.gameState.upsert({
        where: { name: persisted.gameId },
        create: {
          name: persisted.gameId,
          creatorId: hostUserId,
          habilidadesActivadas: persisted.habilidadesActivadas,
          discardedCards: persisted.discardedCards,
          turn: persisted.turn,
          updatedAt: new Date(),
        },
        update: {
          creatorId: hostUserId,
          habilidadesActivadas: persisted.habilidadesActivadas,
          discardedCards: persisted.discardedCards,
          turn: persisted.turn,
          updatedAt: new Date(),
        },
      });

      await tx.pausedGamePlayer.deleteMany({
        where: { roomId: persisted.gameId },
      });

      await tx.pausedGamePlayer.createMany({
        data: persisted.players.map((player) => ({
          roomId: persisted.gameId,
          userId: player.userId,
          turnOrder: player.turnOrder,
          cards: player.cards,
          habilidades: player.habilidades,
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
    };
  }

  async listarPartidasGuardadas(creatorId: string): Promise<SavedGameSummary[]> {
    const partidas = await this.prisma.gameState.findMany({
      where: { creatorId },
      include: { pausedGamePlayers: true },
      orderBy: { updatedAt: 'desc' },
    });

    return partidas.map((partida) => ({
      gameId: partida.name,
      creatorId: partida.creatorId,
      updatedAt: partida.updatedAt,
      players: partida.pausedGamePlayers
        .sort((a, b) => a.turnOrder - b.turnOrder)
        .map((player) => player.userId),
    }));
  }

  async cargarPartidaGuardada(
    gameId: string,
    hostUserId: string,
    socketId: string,
  ): Promise<Game> {
    const { room } = this.validateStartContext(hostUserId, socketId);

    if (room.hostId !== hostUserId) {
      throw new Error('Solo el creador de la sala puede cargar una partida guardada');
    }

    const snapshot = await this.prisma.gameState.findUnique({
      where: { name: gameId },
      include: { pausedGamePlayers: true },
    });

    if (!snapshot) {
      throw new Error('No existe una partida guardada con ese identificador');
    }

    if (snapshot.creatorId !== hostUserId) {
      throw new Error('No tienes permisos para cargar esta partida guardada');
    }

    const playersGuardados = snapshot.pausedGamePlayers;

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
      (player) => player.connected,
    );
    if (!allConnected) {
      throw new Error('Todos los jugadores deben estar conectados para cargar la partida');
    }

    const persisted: PersistedGameState = {
      gameId: snapshot.name,
      turn: snapshot.turn,
      habilidadesActivadas: snapshot.habilidadesActivadas,
      discardedCards: snapshot.discardedCards,
      players: playersGuardados.map((player) => ({
        userId: player.userId,
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
    this.gameManager.resolverTimeoutTurno(game);

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
    const playerUserIds = Array.from(room.players.values()).map(
      (player) => player.userId,
    );

    room.started = true;

    return this.gameManager.inicioPartida(
      room.players.size,
      room.code,
      playerUserIds,
    );
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

  verCarta(partida: Game, solicitanteId : string, indexCarta: number, playerId?: string
    ,indexCartaPlayer?: number
  ){
    return this.gameManager.verCarta(partida, solicitanteId, indexCarta, playerId
      ,indexCartaPlayer
    );
  } 

  intercambiarTodasCartas(partida: Game, remitenteId:string, destinatarioId:string){
    return this.gameManager.intercambiarTodasCartas(partida, remitenteId, destinatarioId);
  }

  hacerRobarCarta(partida: Game, userId : string, adversarioId : string){
    return this.gameManager.hacerRobarCarta(partida,userId,adversarioId);
  }

  protegerCarta(partida : Game, userId: string, numCarta : number) {
    this.gameManager.protegerCarta(partida,userId,numCarta);
  }

  jugadorMenosPuntuacion(partida: Game, userId: string) {
    return this.gameManager.jugadorMenosPuntuacion(partida, userId);
  }

  desactivarProximaHabilidad(partida: Game, userId: string) {
    return this.gameManager.desactivarProximaHabilidad(partida, userId);
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
    return this.intercambiarCartaInteractivo(partida,userId,rivalId,numCarta);
  }

  calcularRecompensas(partida: Game) {
    return this.gameManager.calcularRecompensas(partida);
  }

  async aplicarRecompensas(
    recompensas: Array<{ userId: string; eloChange: number; cubitosChange: number }>,
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
        },
      });
    }
  }

}
