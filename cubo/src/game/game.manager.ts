import { GameState, PlayerState, Game, TurnPhase } from './interfaces/game.interface';
import { Card, PaloCarta } from './interfaces/card.interface';

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TURN_TIMEOUT_MS = 30_000;

interface PermisoVerCarta {
  jugadorId: string;
  tipo: 'propia' | 'propia-y-rival';
  turno: number;
}

export interface ResultadoVerCarta {
  cartaPropia: Card;
  cartaRival?: Card;
}

type AccionTurno =
  | 'DRAW'
  | 'RESOLVE_PENDING'
  | 'RESOLVE_SKILL'
  | 'OWNER_TURN_ONLY';

export class GameManager {
////////////////////////////////////////////////////////////////////////////////
//                           ATRIBUTOS                                        //
////////////////////////////////////////////////////////////////////////////////

  // representa el acceso a una partida mediante su identificador
  private readonly games = new Map<string, Game>();
  // representa las partidas activas por sala (roomId -> gameId)
  private readonly roomToGame = new Map<string, string>();

    //variables usadas para controlar la acción de colocar una carta sobre otra
    //en el momento de descartar una carta
  private reaccionCarta = new Map<string, boolean>();
  private reaccionUserId = new Map <string, string>();

  //control de los requerimientos para ver carta
  private readonly permisosVerCarta = new Map<string, PermisoVerCarta>();

  getGameById(gameId: string): Game {
    const partida = this.games.get(gameId);

    if (!partida) {
      throw new Error('Partida no encontrada');
    }

    return partida;
  }

  getGameByRoomId(roomId: string): Game {
    const gameId = this.roomToGame.get(roomId);

    if (!gameId) {
      throw new Error('No hay partida activa para la sala');
    }

    return this.getGameById(gameId);
  }

  private getTurnUserId(partida: Game): string {
    return partida.estadoGlobal.turnoJugadores[partida.estadoGlobal.turn];
  }

  private obtenerIndiceJugador(partida: Game, userId: string): number {
    const idEnPartida = partida.estadoGlobal.turnoJugadores.indexOf(userId);

    if (idEnPartida === -1) {
      throw new Error('El usuario no está registrado en la partida');
    }

    return idEnPartida;
  }

  private actualizarDeadlineTurno(partida: Game) {
    partida.estadoGlobal.turnDeadlineAt = Date.now() + TURN_TIMEOUT_MS;
  }

  private cambiarFase(partida: Game, phase: TurnPhase) {
    partida.estadoGlobal.phase = phase;
    this.actualizarDeadlineTurno(partida);
    partida.updatedAt = new Date();
  }

  private avanzarTurno(partida: Game) {
    const totalJugadores = partida.estadoGlobal.turnoJugadores.length;
    partida.estadoGlobal.turn = (partida.estadoGlobal.turn + 1) % totalJugadores;
    this.limpiarPermisoVerCarta(partida.gameId);
    this.cambiarFase(partida, 'WAIT_DRAW');
  }

  private validarAccionTurno(partida: Game, userId: string, accion: AccionTurno) {
    const turnUserId = this.getTurnUserId(partida);
    if (userId !== turnUserId) {
      throw new Error('No es el turno del jugador que intenta jugar');
    }

    if (accion === 'DRAW' && partida.estadoGlobal.phase !== 'WAIT_DRAW') {
      throw new Error('No se puede robar carta en este momento del turno');
    }

    if (
      accion === 'RESOLVE_PENDING' &&
      partida.estadoGlobal.phase !== 'WAIT_DECISION'
    ) {
      throw new Error('Debes estar en fase de decision para resolver carta pendiente');
    }

    if (
      accion === 'RESOLVE_SKILL' &&
      partida.estadoGlobal.phase !== 'WAIT_SKILL'
    ) {
      throw new Error('Debes estar en fase de habilidad para ejecutar esta accion');
    }
  }

  private abrirVentanaReaccionGlobal(partida: Game) {
    this.reaccionCarta.set(partida.gameId, true);
    this.reaccionUserId.delete(partida.gameId);
  }

  private limpiarPermisoVerCarta(gameId: string) {
    this.permisosVerCarta.delete(gameId);
  }

  private registrarPermisoVerCarta(
    partida: Game,
    jugadorId: string,
    cartaDescartada: Card,
  ): boolean {
    this.limpiarPermisoVerCarta(partida.gameId);

    if (cartaDescartada.carta === 10) {
      this.permisosVerCarta.set(partida.gameId, {
        jugadorId,
        tipo: 'propia',
        turno: partida.estadoGlobal.turn,
      });
      return true;
    }

    if (cartaDescartada.carta === 11) {
      this.permisosVerCarta.set(partida.gameId, {
        jugadorId,
        tipo: 'propia-y-rival',
        turno: partida.estadoGlobal.turn,
      });
      return true;
    }

    return false;
  }

  resolverTimeoutTurno(partida: Game): boolean {
    if (partida.estado !== 'activo') {
      return false;
    }

    if (Date.now() <= partida.estadoGlobal.turnDeadlineAt) {
      return false;
    }

    const turnUserId = this.getTurnUserId(partida);
    const idEnPartida = this.obtenerIndiceJugador(partida, turnUserId);
    const estadoJugador = partida.estadoGlobal.jugadores[idEnPartida];

    if (partida.estadoGlobal.phase === 'WAIT_DECISION' && estadoJugador.cartaPendiente) {
      // Se descarta la pendiente
      partida.estadoGlobal.cartasDescartadas.push(estadoJugador.cartaPendiente);
      estadoJugador.cartaPendiente = undefined;
      this.abrirVentanaReaccionGlobal(partida);
    }

    if (partida.estadoGlobal.phase === 'WAIT_SKILL') {
      // timeout cuando habilidad obligatoria: se pierde la accion y se pasa turno
      this.limpiarPermisoVerCarta(partida.gameId);
    }

    this.avanzarTurno(partida);
    return true;
  }

  private static crearCarta(
    carta: number,
    palo: PaloCarta,
    habilidad = 'ninguna',
    puntos: number,
  ): Card {
    return {
      carta,
      palo,
      habilidad,
      puntos,
    };
  }

  // función que crea la baraja inicial del juego
  private static rellenarBaraja(): Card[] {
    const baraja: Card[] = [];
    const vtipo: PaloCarta[] = ['corazones', 'picas', 'treboles', 'rombos'];

    for (let tipo = 0; tipo < vtipo.length; tipo++) {
      for (let i = 1; i <= 13; i++) {
        let puntos = 0;
        if (i === 13 && (vtipo[tipo] === 'corazones' || vtipo[tipo] === 'rombos')) {
          puntos = 0;
        } else if (
          i === 13 &&
          (vtipo[tipo] === 'picas' || vtipo[tipo] === 'treboles')
        ) {
          puntos = 20;
        } else {
          puntos = i;
        }
        baraja.push(GameManager.crearCarta(i, vtipo[tipo], 'ninguna', puntos));
      }
    }

    for (let i = 1; i <= 3; i++) {
      baraja.push(GameManager.crearCarta(52 + i, 'jocker', 'ninguna', -1));
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

  private obtenerCartaDeJugador(
    partida: Game,
    userId: string,
    numCarta: number,
  ): Card {
    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const cartas = partida.estadoGlobal.jugadores[idEnPartida].cartasMano;

    if (numCarta < 0 || numCarta >= cartas.length) {
      throw new Error('La carta seleccionada no existe');
    }

    const carta = cartas[numCarta];
    if (!carta) {
      throw new Error('La carta seleccionada no existe');
    }

    return carta;
  }

  inicioPartida(
    numJugadores: number,
    codigoSala: string,
    idJugadores: string[],
  ): Game {
    if (this.roomToGame.has(codigoSala)) {
      throw new Error('Ya existe una partida activa para la sala');
    }

    const aux: Card[] = GameManager.rellenarBaraja();
    const baraja: Card[] = GameManager.mezclarArray(aux);
    const gameCode = this.generateUniqueRoomCode();
    const estadoJugadores: PlayerState[] = Array.from(
      { length: numJugadores },
      () => ({
        cartasMano: [],
        habilidadesActivadas: [],
      }),
    );

    GameManager.asignarCartasJugadores(baraja, estadoJugadores, numJugadores);
    const estadoGlobal: GameState = {
      turn: 0,
      phase: 'WAIT_DRAW',
      turnDeadlineAt: Date.now() + TURN_TIMEOUT_MS + 8000, // se le da un tiempo extra en el primer turno
      cartasVigentes: baraja,
      cartasDescartadas: [],
      habilidadesActivadas: [],
      turnoJugadores: idJugadores,
      jugadores: estadoJugadores,
    };

    const partida: Game = {
      gameId: gameCode,
      roomId: codigoSala,
      estado: 'activo',
      estadoGlobal,
      updatedAt: new Date(),
    };

    this.abrirVentanaReaccionGlobal(partida);
    this.games.set(gameCode, partida);
    this.roomToGame.set(codigoSala, gameCode);
    return partida;
  }

  robarCarta(partida: Game, userId: string) {
    this.validarAccionTurno(partida, userId, 'DRAW');

    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const estadoJugador = partida.estadoGlobal.jugadores[idEnPartida];

    if (estadoJugador.cartaPendiente) {
      throw new Error('El jugador ya tiene una carta pendiente de resolver');
    }

    this.limpiarPermisoVerCarta(partida.gameId);

    const cartaRobada = partida.estadoGlobal.cartasVigentes.pop();
    if (!cartaRobada) {
      // TODO: hacer reshuffle cuando no queden cartas en el mazo.
      throw new Error('No quedan cartas para robar');
    }

    estadoJugador.cartaPendiente = cartaRobada;
    this.cambiarFase(partida, 'WAIT_DECISION');
  }

  descartarCarta(
    partida: Game,
    userId: string,
    cartaSobreOtra: boolean,
    numCarta: number,
  ) {
    if (!cartaSobreOtra) {
      this.validarAccionTurno(partida, userId, 'OWNER_TURN_ONLY');
    }

    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const cartas = partida.estadoGlobal.jugadores[idEnPartida].cartasMano;

    if (numCarta < 0 || numCarta >= cartas.length) {
      throw new Error('No tienes esa carta en la mano');
    }

    const carta = cartas[numCarta];
    partida.estadoGlobal.cartasDescartadas.push(carta);
    cartas.splice(numCarta, 1);

    if (!cartaSobreOtra) {
      this.abrirVentanaReaccionGlobal(partida);
    }
  }

  descartarCartaPendiente(partida: Game, userId: string): Card {
    this.validarAccionTurno(partida, userId, 'RESOLVE_PENDING');

    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const cartaPendiente = partida.estadoGlobal.jugadores[idEnPartida].cartaPendiente;
    if (!cartaPendiente) {
      throw new Error('No hay carta pendiente');
    }

    partida.estadoGlobal.cartasDescartadas.push(cartaPendiente);
    partida.estadoGlobal.jugadores[idEnPartida].cartaPendiente = undefined;

    const requiereResolverHabilidad = this.registrarPermisoVerCarta(
      partida,
      userId,
      cartaPendiente,
    );

    this.abrirVentanaReaccionGlobal(partida);

    if (requiereResolverHabilidad) {
      this.cambiarFase(partida, 'WAIT_SKILL');
    } else {
      this.avanzarTurno(partida);
    }

    return cartaPendiente;
  }

  descartarCartaPorPendiente(
    partida: Game,
    numCarta: number,
    userId: string,
  ): Card {
    this.validarAccionTurno(partida, userId, 'RESOLVE_PENDING');

    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const cartaPendiente = partida.estadoGlobal.jugadores[idEnPartida].cartaPendiente;
    if (!cartaPendiente) {
      throw new Error('No hay carta pendiente');
    }

    const cartas = partida.estadoGlobal.jugadores[idEnPartida].cartasMano;
    const cartaDescartar = cartas[numCarta];
    if (!cartaDescartar) {
      throw new Error('No tienes esa carta en la mano');
    }

    partida.estadoGlobal.cartasDescartadas.push(cartaDescartar);
    cartas[numCarta] = cartaPendiente;
    partida.estadoGlobal.jugadores[idEnPartida].cartaPendiente = undefined;

    this.limpiarPermisoVerCarta(partida.gameId); //Porque aqui???


    this.abrirVentanaReaccionGlobal(partida);
    this.avanzarTurno(partida);

    return cartaDescartar;
  }

  intercambiarCarta(
    partida: Game,
    remitenteId: string,
    destinatarioId: string,
    numCartaRemitente: number,
    numCartaDestinatario: number,
  ) {
    this.validarAccionTurno(partida, remitenteId, 'OWNER_TURN_ONLY');

    const idEnPartidaR = this.obtenerIndiceJugador(partida, remitenteId);
    const idEnPartidaD = this.obtenerIndiceJugador(partida, destinatarioId);

    const cartaRemitente =
      partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano[numCartaRemitente];
    if (!cartaRemitente) {
      throw new Error('No tienes en la mano la carta seleccionada');
    }

    const cartaDestinatario =
      partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano[numCartaDestinatario];
    if (!cartaDestinatario) {
      throw new Error('El destinatario no tiene en la mano la carta seleccionada');
    }

    partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano[numCartaDestinatario] =
      cartaRemitente;
    partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano[numCartaRemitente] =
      cartaDestinatario;
  }

  verCarta(
    partida: Game,
    solicitanteId: string,
    indexCartaPropia: number,
    rivalId?: string,
    indexCartaRival?: number,
  ): ResultadoVerCarta {
    this.validarAccionTurno(partida, solicitanteId, 'RESOLVE_SKILL');

    const turno = partida.estadoGlobal.turn;
    const permiso = this.permisosVerCarta.get(partida.gameId);
    if (!permiso || permiso.jugadorId !== solicitanteId || permiso.turno !== turno) {
      throw new Error('No tienes permiso para usar verCarta en este momento');
    }

    const quiereVerRival = rivalId != null || indexCartaRival != null;

    if (permiso.tipo === 'propia') {
      if (quiereVerRival) {
        throw new Error('La carta 10 solo permite ver una carta propia');
      }

      const cartaPropia = this.obtenerCartaDeJugador(
        partida,
        solicitanteId,
        indexCartaPropia,
      );

      this.limpiarPermisoVerCarta(partida.gameId);
      this.avanzarTurno(partida);
      return { cartaPropia };
    }

    if (rivalId == null || indexCartaRival == null) {
      throw new Error('La carta 11 requiere indicar una carta propia y otra rival');
    }

    if (rivalId === solicitanteId) {
      throw new Error('La segunda carta debe pertenecer a un rival');
    }

    const cartaPropia = this.obtenerCartaDeJugador(
      partida,
      solicitanteId,
      indexCartaPropia,
    );

    const cartaRival = this.obtenerCartaDeJugador(partida, rivalId, indexCartaRival);

    this.limpiarPermisoVerCarta(partida.gameId);
    this.avanzarTurno(partida);

    return {
      cartaPropia,
      cartaRival,
    };
  }

  intercambiarTodasCartas(partida: Game, remitenteId: string, destinatarioId: string) {
    this.validarAccionTurno(partida, remitenteId, 'OWNER_TURN_ONLY');

    const idEnPartidaR = this.obtenerIndiceJugador(partida, remitenteId);
    const idEnPartidaD = this.obtenerIndiceJugador(partida, destinatarioId);

    const cartasRemitente = [
      ...partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano,
    ];

    partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano = [
      ...partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano,
    ];

    partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano = cartasRemitente;
  }

  calcularPuntosJugador(partida: Game, userId: string): number {
    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const cartasJugador = partida.estadoGlobal.jugadores[idEnPartida].cartasMano;
    return cartasJugador.reduce((total, carta) => total + carta.puntos, 0);
  }

  // esta función la puede invocar cualquier jugador en cualquier fase
  solicitarColocarCartaSobreOtra(idPartida: string, userId: string): boolean {
    const partida = this.games.get(idPartida);
    if (!partida) {
      throw new Error('Partida no encontrada');
    }

    if (partida.estado !== 'activo') {
      throw new Error('La partida no está activa');
    }

    const reaccionCarta = this.reaccionCarta.get(idPartida);
    if (reaccionCarta == null) {
      throw new Error('Ha habido algun error inicializando el estadoReaccion para esta partida');
    }

    if (reaccionCarta === true) {
      this.reaccionCarta.set(idPartida, false);
      this.reaccionUserId.set(idPartida, userId);
      return true;
    }

    const userBloqueado = this.reaccionUserId.get(idPartida);
    return userBloqueado === userId;
  }

  private finalizarPartida(partida: Game, ganadorId: string): void {
    // TODO: notificar a gateway/service con el resultado final y limpieza global.
    void ganadorId;
    partida.estado = 'terminado';
    partida.updatedAt = new Date();
    this.reaccionCarta.delete(partida.gameId);
    this.reaccionUserId.delete(partida.gameId);
    this.permisosVerCarta.delete(partida.gameId);
  }

  private validarFinPartidaPorSinCartas(partida: Game, userId: string): boolean {
    const idEnPartida = partida.estadoGlobal.turnoJugadores.indexOf(userId);
    if (idEnPartida === -1) {
      return false;
    }

    const numCartas = partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;
    if (numCartas === 0) {
      this.finalizarPartida(partida, userId);
      return true;
    }

    return false;
  }

  ponerCartaSobreOtra(partida: Game, userId: string, numCarta: number) {
    let accionCorrecta: boolean;
    let numCartas: number;

    const idPartida = partida.gameId;
    const reaccionCartaAbierta = this.reaccionCarta.get(idPartida);
    const reaccionUserId = this.reaccionUserId.get(idPartida);

    //chequeo mas seguro por si queda un userID anterior mientras la ventana esta reabierta
    if (reaccionCartaAbierta === true || userId !== reaccionUserId) {
      throw new Error('El jugador no tiene permiso para realizar esta acción');
    }

    const idEnPartida = partida.estadoGlobal.turnoJugadores.indexOf(userId);
    numCartas = partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;
    if (numCarta < 0 || numCarta > numCartas - 1) {
      throw new Error('La carta que se quiere jugar no está disponible');
    }

    const carta = partida.estadoGlobal.jugadores[idEnPartida].cartasMano[numCarta];
    const ultimaCartaPendiente =
      partida.estadoGlobal.cartasDescartadas[
        partida.estadoGlobal.cartasDescartadas.length - 1
      ];

    if (!ultimaCartaPendiente) {
      throw new Error('No hay carta descartada sobre la que reaccionar');
    }

                //gestionar la excepción de que los reyes tienen distinta 
                //puntuación en función del palo pero siguen siendo el mismo
                //número
    if (carta.carta === ultimaCartaPendiente.carta) {
        //actividad normal, deja poner la carta encima de la otra
        //descartar carta
        this.descartarCarta(partida, userId, true, numCarta);
      numCartas = partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;
      this.validarFinPartidaPorSinCartas(partida, userId);
      // si acierta, mantiene el bloqueo de reacción para encadenar intentos.
      accionCorrecta = true;
    } else {
        //el jugador ha fallado a la hora de elegir la carta
      const cartaRobada = partida.estadoGlobal.cartasVigentes.pop();
      if (!cartaRobada) {
        // TODO: hacer reshuffle cuando no queden cartas en el mazo.
        throw new Error('No quedan cartas para robar');
      }

      partida.estadoGlobal.jugadores[idEnPartida].cartasMano.push(cartaRobada);
      numCartas = partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;
      // si falla, libera el bloqueo para permitir nuevos intentos
      this.abrirVentanaReaccionGlobal(partida);
      accionCorrecta = false;
    }

    return { accionCorrecta, numCartas };
  }
}
