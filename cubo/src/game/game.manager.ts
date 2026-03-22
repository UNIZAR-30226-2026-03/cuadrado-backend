import { GameState } from './interfaces/game.interface';
import { PlayerState } from './interfaces/game.interface';
import { Game } from './interfaces/game.interface';
//import { RoomManager } from "src/rooms/room.manager";
import { Card, PaloCarta, Habilidad } from './interfaces/card.interface';
import { Room } from '../rooms/interfaces/room.interface';

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

  getRoomById(roomId: string): Room {
    const sala = this.rooms.get(roomId);

    if (!sala) {
      throw new Error('Partida no encontrada');
    }

    return sala;
  }

  getGameById(gameId: string): Game {
    const partida = this.games.get(gameId);

    if (!partida) {
      throw new Error('Partida no encontrada');
    }

    return partida;
  }

  private static crearCarta(
    carta: number,
    palo: PaloCarta,
    habilidad: Habilidad = 'ninguna',
  ): Card {
    return {
      carta,
      palo,
      habilidad,
    };
  }

  // Crear la baraja inicial del juego
  private static rellenarBaraja(): Card[] {
    const baraja: Card[] = [];
    const vtipo: PaloCarta[] = ['corazones', 'picas', 'treboles', 'rombos'];
    for (let tipo = 0; tipo < vtipo.length; tipo++) {
      for (let i = 1; i <= 13; i++) {
        baraja.push(GameManager.crearCarta(i, vtipo[tipo]));
      }
    }

    for (let i = 1; i <= 3; i++) {
      baraja.push(GameManager.crearCarta(52 + i, 'joker'));
    }
    return baraja;
  }

  // Barajar
  private static mezclarArray<T>(array: T[]): T[] {
    const resultado = [...array];

    for (let i = resultado.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
    }

    return resultado;
  }

  // Repartir cartas
  private static asignarCartasJugadores(
    baraja: Card[],
    estadoJugadores: PlayerState[],
    numJugadores: number,
  ) {
    for (let cartas = 0; cartas <= 3; cartas++) {
      for (let jugador = 0; jugador <= numJugadores - 1; jugador++) {
        const carta = baraja.pop();
        if (!carta) {
          throw new Error('No quedan cartas en la baraja');
        }
        estadoJugadores[jugador].cartasMano.push(carta);
      }
    }
  }

  // Código de partidas
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

  //A partir de una Room crea el objeto Game Correspondiente
  inicioPartida(numJugadores: number, codigoSala: string): Game {
    //TODO: comprobar que la sala no haya empezado la partida desde room.gateway

    //generar las cartas de la baraja aleatoriamente
    const aux: Card[] = GameManager.rellenarBaraja();
    const baraja: Card[] = GameManager.mezclarArray(aux);
    const gameCode = this.generateUniqueRoomCode();
    const estadoJugadores: PlayerState[] = Array.from(
      { length: numJugadores },
      () => ({
        userId: '',
        cartasMano: [],
        habilidadesActivadas: [],
      }),
    );

    GameManager.asignarCartasJugadores(baraja, estadoJugadores, numJugadores);
    const estadoGlobal: GameState = {
      turn: 0,
      cartasVigentes: baraja,
      cartasDescartadas: [],
      habilidadesActivadas: [],
      jugadores: estadoJugadores,
    };

    const partida: Game = {
      gameId: gameCode,
      roomId: codigoSala,
      estado: 'activo',
      estadoGlobal: estadoGlobal,
      updatedAt: new Date(),
    };
    this.games.set(gameCode, partida);
    return partida;
  }

  //Un jugador roba una carta y se actualiza el estado de la partida
  robarCarta(partida: Game, id: number) {
    //TODO: Añadir a las funciones el idEnPartida para saber quién realiza la acción
    if (id == partida.estadoGlobal.turn) {
      const cartaRobada = partida.estadoGlobal.cartasVigentes.pop();
      if (!cartaRobada) {
        throw new Error('No quedan cartas para robar');
      }
      partida.estadoGlobal.jugadores[id].cartaPendiente = cartaRobada;
    } else {
      throw new Error(
        'No es el turno del jugador que intenta realizar  \
                    la acción',
      );
    }
  }

  // El jugador no quiere la carta que acaba de robar
  descartarCartaPendiente(partida: Game, id: number): Card {
    if (id == partida.estadoGlobal.turn) {
      const cartaPendiente = partida.estadoGlobal.jugadores[id].cartaPendiente;
      if (cartaPendiente) {
        partida.estadoGlobal.cartasDescartadas.push(cartaPendiente);
        partida.estadoGlobal.jugadores[id].cartaPendiente = undefined;
        return cartaPendiente;
      } else {
        throw new Error('No había carta pendiente');
      }
    } else {
      throw new Error(
        'No es el turno del jugador que intenta realizar \
                la acción',
      );
    }
  }

  // El jugador quiere la carta que acaba de robar, la cambia por una de las suyas
  descartarCartaPorPendiente(
    partida: Game,
    numCarta: number,
    id: number,
  ): Card {
    if (numCarta < 0 || numCarta > 3) {
      throw new Error('El número de carta se sale del rango 0-3'); // Esto no tendría que ser un error, un jugador puede tener más de 4 cartas
    }
    if (id == partida.estadoGlobal.turn) {
      const cartaPendiente = partida.estadoGlobal.jugadores[id].cartaPendiente;
      const cartaDescartar =
        partida.estadoGlobal.jugadores[id].cartasMano[numCarta];

      // cartaDescartar: la del mazo; numCarta: índice de cartaDescartar
      if (cartaPendiente) {
        partida.estadoGlobal.cartasDescartadas.push(cartaDescartar);
        partida.estadoGlobal.jugadores[id].cartasMano[numCarta] =
          cartaPendiente;
        partida.estadoGlobal.jugadores[id].cartaPendiente = undefined;
        return cartaDescartar;
      } else {
        throw new Error('No había carta pendiente');
      }
    } else {
      throw new Error(
        'No es el turno del jugador que intenta realizar \
                la acción',
      );
    }
  }

  // El jugador puede cambiar una de sus cartas por una de otro jugador
  intercambiarCarta(
    partida: Game,
    remitenteId: number,
    destinatarioId: number,
    numCartaRemitente: number,
    numCartaDestinatario: number,
  ) {
    if (remitenteId == partida.estadoGlobal.turn) {
      const cartaRemitente =
        partida.estadoGlobal.jugadores[remitenteId].cartasMano[
          numCartaRemitente
        ];

      const cartaDestinatario =
        partida.estadoGlobal.jugadores[destinatarioId].cartasMano[
          numCartaDestinatario
        ];

      partida.estadoGlobal.jugadores[destinatarioId].cartasMano[
        numCartaDestinatario
      ] = cartaRemitente;

      partida.estadoGlobal.jugadores[remitenteId].cartasMano[
        numCartaRemitente
      ] = cartaDestinatario;
    }
  }

  /////////////////////////////////////////////////
  //    HABILIDADES                             //
  ///////////////////////////////////////////////
  usarHabilidadAS(
    partida: Game,
    remitenteId: number,
    destinatarioId: number,
  ): void {
    //AS = intercambia todas tus cartas por todas las cartas de otro jugador

    const aux = partida.estadoGlobal.jugadores[remitenteId].cartasMano;
    partida.estadoGlobal.jugadores[remitenteId].cartasMano =
      partida.estadoGlobal.jugadores[destinatarioId].cartasMano;
    partida.estadoGlobal.jugadores[destinatarioId].cartasMano = aux;
  }

  usarHabilidad10(partida: Game, idJugador: number, numCarta: number): Card {
    //10 = permite ver una de tus cartas

    return partida.estadoGlobal.jugadores[idJugador].cartasMano[numCarta];
  }
}
