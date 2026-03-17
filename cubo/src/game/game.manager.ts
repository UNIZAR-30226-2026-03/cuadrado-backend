import { GameState } from "./interfaces/game.interface";
import { PlayerState } from "./interfaces/game.interface";
import { Game} from "./interfaces/game.interface";
import { RoomManager } from "src/rooms/room.manager";
import { Card, PaloCarta } from "./interfaces/card.interface"
import {Room} from '../rooms/interfaces/room.interface'

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export class GameManager {
////////////////////////////////////////////////////////////////////////////////
//                           ATRIBUTOS                                        //
////////////////////////////////////////////////////////////////////////////////
    
    //representa el acceso a una sala mediante su identificador
    private readonly games = new Map<string, Game>();
    //representa las partidas activas por sala (solo puede haber 1)
    private readonly rooms = new Map<string, Room>();


    getGameById(gameId: string): Game {
        const partida = this.games.get(gameId);

        if (!partida) {
            throw new Error('Partida no encontrada');
         }

        return partida;
    }

    
    private static crearCarta(carta: number, palo: PaloCarta, habilidad = 'ninguna'): Card {
        return {
            carta,
            palo,
            habilidad,
        };
    }

    //función que crea la baraja inicial del juego
    private static rellenarBaraja(): Card[] {
        const baraja : Card[] = [];
        const vtipo: PaloCarta[] = [
        'corazones',
        'picas',
        'treboles',
        'rombos',
        ];
        for (let tipo = 0; tipo < vtipo.length; tipo++) {
        for (let i = 1; i <= 13; i++) {
            baraja.push(GameManager.crearCarta(i, vtipo[tipo]));
        }
    }

    for (let i = 1; i <= 3; i++) {
        baraja.push(GameManager.crearCarta(52 + i, 'jocker'));
    }
    return baraja;
}

private static mezclarArray<T>(array: T[]): T[] {
  const resultado = [...array];

  for (let i = resultado.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }

  return resultado;
}

 private generateRoomCode(): string {
    let code = '';

    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
      code += ROOM_CODE_CHARS[randomIndex];
    }

    return code;
  }

  private generateUniqueRoomCode(): string {
    let candidate = this.generateRoomCode();

    while (this.games.has(candidate)) {
      candidate = this.generateRoomCode();
    }

    return candidate;
  }

  private static asignarCartasJugadores(baraja : Card[],
                estadoJugadores : PlayerState[], numJugadores : number){
    for(let cartas=0; cartas <= 3 ; cartas++){
        for(let jugador = 0; jugador <= numJugadores-1; jugador++){
            const carta = baraja.pop();
            if (!carta) {
                throw new Error('No quedan cartas en la baraja');
            }
            estadoJugadores[jugador].cartasMano.push(carta);
        }
    }
  }
    
    //A partir de una Room crea el objeto Game Correspondiente
    inicioPartida(room : Room) : Game {
        if (this.rooms.get(room.code)){
            throw new Error("Ya hay una partida en curso para esa sala");
        }
        //generar las cartas de la baraja aleatoriamente
        const aux : Card[] = GameManager.rellenarBaraja();
        const baraja : Card[] = GameManager.mezclarArray(aux);
        const gameCode = this.generateUniqueRoomCode();
        this.rooms.set(room.code, room);
        const estadoJugadores: PlayerState[] = Array.from(room.players.values()).map(
        (player) : PlayerState => ({
            userId: player.userId,
            cartasMano: [],
            habilidadesActivadas: [],
         }),
        );

        GameManager.asignarCartasJugadores(baraja, estadoJugadores,
                                room.players.size);
        const estadoGlobal : GameState =  {
            turn:0,
            cartasVigentes: baraja,
            cartasDescartadas: [],
            habilidadesActivadas: [],
            jugadores: estadoJugadores,
        };

        const partida : Game = {
            gameId: gameCode,
            roomId: room.code,
            estado: 'activo',
            estadoGlobal: estadoGlobal,
            updatedAt: new Date(),
        }
        this.games.set(gameCode, partida);
        return partida;
    }

    //un jugador roba una carta y se actualiza el estado de la partida
    robarCarta(partida : Game) {
        const cartaRobada = partida.estadoGlobal.cartasVigentes.pop();
        if(!cartaRobada){
            throw new Error("No quedan cartas para robar")
        }
        partida.estadoGlobal.jugadores[partida.estadoGlobal.turn].cartaPendiente
            = cartaRobada;
    }

    descartarCartaPendiente(partida: Game){
        const turno = partida.estadoGlobal.turn;
        const cartaPendiente = partida.estadoGlobal.jugadores[turno]
                                                        .cartaPendiente;
        if(cartaPendiente){
           partida.estadoGlobal.cartasDescartadas.push(cartaPendiente);
           partida.estadoGlobal.jugadores[turno].cartaPendiente = undefined;                                                  
        } else {
            throw new Error("No había carta pendiente");
        }
    }

    descartarCartaPorPendiente(partida: Game, numCarta: number){
        const turno = partida.estadoGlobal.turn;
        const cartaPendiente = partida.estadoGlobal.jugadores[turno]
                                                        .cartaPendiente;
        const cartaDescartar = partida.estadoGlobal.jugadores[turno]
                                                        .cartasMano[numCarta];
        if(numCarta < 0 || numCarta > 3){
            throw new Error("El número de carta se sale del rango 0-3")
        }
        if(cartaPendiente){
           partida.estadoGlobal.cartasDescartadas.push(cartaDescartar);
           partida.estadoGlobal.jugadores[turno].cartasMano[numCarta]
            = cartaPendiente;        
           partida.estadoGlobal.jugadores[turno].cartaPendiente = undefined;                                           
        } else {
            throw new Error("No había carta pendiente");
        }
    }
}
