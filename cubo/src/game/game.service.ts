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
  inicioPartida(room: Room): Game {
    return this.gameManager.inicioPartida(room);
  }

  robarCarta(partida: Game) {
    return this.gameManager.robarCarta(partida);
  }

  descartarPendiente(partida : Game) {
    return this.gameManager.descartarCartaPendiente(partida);
  }
  cartaPorPendiente(partida: Game, numCarta: number){
    return this.gameManager.descartarCartaPorPendiente(partida, numCarta);
  }
  
}
