import { Inject, Injectable } from '@nestjs/common';
import { GameManager } from './game.manager';
import { Game } from './interfaces/game.interface';
import { Room } from '../rooms/interfaces/room.interface';

@Injectable()
export class GameService {
  constructor(@Inject(GameManager) private readonly gameManager: GameManager) {}
  
  getGameById(gameId: string) : Game {
    return this.gameManager.getGameById(gameId);
  }
  getRoomById(roomId: string) : Room {
    return this.gameManager.getRoomById(roomId);
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
}
