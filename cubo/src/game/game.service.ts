import { Inject, Injectable } from '@nestjs/common';
import { GameManager } from './game.manager';
import { Game } from './interfaces/game.interface';
import { Room } from '../rooms/interfaces/room.interface';

@Injectable()
export class GameService {
  constructor(@Inject(GameManager) private readonly gameManager: GameManager) {}

  getGameById(gameId: string): Game {
    return this.gameManager.getGameById(gameId);
  }
  getRoomById(roomId: string): Room {
    return this.gameManager.getRoomById(roomId);
  }
  inicioPartida(room: Room): Game {
    return this.gameManager.inicioPartida(room.players.size, room.code);
  }

  robarCarta(partida: Game, idEnPartida: number) {
    return this.gameManager.robarCarta(partida, idEnPartida);
  }

  descartarPendiente(partida: Game, idEnPartida: number) {
    return this.gameManager.descartarCartaPendiente(partida, idEnPartida);
  }
  cartaPorPendiente(partida: Game, numCarta: number, idEnPartida: number) {
    return this.gameManager.descartarCartaPorPendiente(
      partida,
      numCarta,
      idEnPartida,
    );
  }

  intercambiarCarta(
    partida: Game,
    remitenteId: number,
    destinatarioId: number,
    numCartaRemitente: number,
    numCartaDestinatario: number,
  ) {
    return this.gameManager.intercambiarCarta(
      partida,
      remitenteId,
      destinatarioId,
      numCartaRemitente,
      numCartaDestinatario,
    );
  }

  /////////////////////////////////////////////////
  //    HABILIDADES                             //
  ///////////////////////////////////////////////
  usarHabilidadAS(partida: Game, remitenteId: number, destinatarioId: number) {
    return this.gameManager.usarHabilidadAS(
      partida,
      remitenteId,
      destinatarioId,
    );
  }

  usarHabilidad10(partida: Game, idJugador: number, numCarta: number) {
    return this.gameManager.usarHabilidad10(partida, idJugador, numCarta);
  }
}
