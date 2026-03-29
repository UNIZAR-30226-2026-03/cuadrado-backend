import { Inject, Injectable } from '@nestjs/common';
import { GameManager } from './game.manager';
import { Game } from './interfaces/game.interface';
import { Room } from '../rooms/interfaces/room.interface';
import { Player } from '../rooms/interfaces/player.interface';
import { RoomsService } from '../rooms/rooms.service';

export interface ValidatedGameContext {
  game: Game;
  room: Room;
  player: Player;
}

export interface ValidatedStartContext {
  room: Room;
  player: Player;
}

@Injectable()
export class GameService {
  constructor(
    @Inject(GameManager) private readonly gameManager: GameManager,
    private readonly roomsService: RoomsService,
  ) {}
  
  getGameById(gameId: string) : Game {
    return this.gameManager.getGameById(gameId);
  }
  getGameByRoomId(roomId: string): Game {
    return this.gameManager.getGameByRoomId(roomId);
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

  //TODO: pasar room.players entero para hacer un mapa y facilitar las 
  // comprobaciones
  inicioPartida(room: Room): Game {
    const playerUserIds = Array.from(room.players.values()).map(
      (player) => player.userId,
    );

    return this.gameManager.inicioPartida(
      room.players.size,
      room.code,
      playerUserIds,
    );
  }

  robarCarta(partida: Game, userId: string) {
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

  verCarta(partida: Game, numCarta: number, userId: string){
    return this.gameManager.verCarta(partida, numCarta, userId);
  } 

  intercambiarTodasCartas(partida: Game, remitenteId:string, destinatarioId:string){
    return this.gameManager.intercambiarTodasCartas(partida, remitenteId, destinatarioId);
  }

  calcularPuntosJugador(partida: Game, userId: string){
    return this.gameManager.calcularPuntosJugador(partida, userId);
  }

  solicitarColocarCartaSobreOtra(idPartida : string, userId: string){
    return this.gameManager.solicitarColocarCartaSobreOtra(idPartida, userId);
  }
  
  ponerCartaSobreotra(partida : Game , userId : string, numCarta :number){
    return this.gameManager.ponerCartaSobreOtra(partida, userId, numCarta);
  }
}
