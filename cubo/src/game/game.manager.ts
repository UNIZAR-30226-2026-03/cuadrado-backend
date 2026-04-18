import {
  GameState,
  PlayerState,
  Game,
  TurnPhase,
  FinPartidaMotivo,
} from './interfaces/game.interface';
import { Card, PaloCarta, Habilidad } from './interfaces/card.interface';
import { dificultadBot, playerController } from '../rooms/interfaces/room.interface';
import {
  AVAILABLE_POWERS,
  DEFAULT_DECK_COUNT,
} from '../rooms/interfaces/rules-config.interface';

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TURN_TIMEOUT_MS = 30_000;
const EXTRA_TIME_FIRST_TURN = 8000;

interface PermisoHabilidadBase {
  jugadorId: string;
  turno: number;
}

type ResultadoRegistroHabilidad =
  | { tipo: 'sin-efecto-inmediato'; requiereResolverHabilidad: false }
  | { tipo: 'requiere-skill'; requiereResolverHabilidad: true }
  | {
      tipo: 'roba-y-sigue';
      requiereResolverHabilidad: false;
      cartaRobada: Card;
      reshuffle: ReshuffleInfo;
    };

type ResultadoDescartarPendiente = {
  cartaDescartada: Card;
  resultadoHabilidad: ResultadoRegistroHabilidad;
};


export type TipoPermisoHabilidad =
  | 'ver-carta-propia'
  | 'ver-carta-propia-y-rival'
  | 'intercambiar-carta'
  | 'intercambiar-todas'
  | 'hacer-robar-carta'
  | 'proteger-carta'
  | 'saltar-turno-jugador'
  | 'jugador-menos-puntuacion';

export type PermisoHabilidad =
  | (PermisoHabilidadBase & { tipo: 'ver-carta-propia' })
  | (PermisoHabilidadBase & { tipo: 'ver-carta-propia-y-rival' })
  | (PermisoHabilidadBase & {
      tipo: 'intercambiar-carta';
      estado?: 'esperando-iniciador' | 'esperando-rival';
      rivalId?: string;
      indiceCartaIniciador?: number;
    })
  | (PermisoHabilidadBase & { tipo: 'intercambiar-todas' })
  | (PermisoHabilidadBase & { tipo: 'hacer-robar-carta' })
  | (PermisoHabilidadBase & { tipo: 'proteger-carta' })
  | (PermisoHabilidadBase & { tipo: 'saltar-turno-jugador' })
  | (PermisoHabilidadBase & { tipo: 'jugador-menos-puntuacion' });

export interface ResultadoVerCarta {
  cartaPropia: Card;
  cartaRival?: Card;
}

export interface ReshuffleInfo {
  huboRebarajado: boolean;
  cantidadCartasMazo: number;
}

export interface ResultadoRobarCarta {
  cartaRobada: Card;
  reshuffle: ReshuffleInfo;
}

export interface ResultadoPonerCartaSobreOtra {
  accionCorrecta: boolean;
  numCartas: number;
  reshuffle: ReshuffleInfo;
}

export interface PersistedPlayerState {
  userId: string;
  controlador: playerController;
  dificultadBot: dificultadBot | undefined;
  nombreEnPartida: string | undefined;
  turnOrder: number;
  cards: number[];
  habilidades: number[];
}

export interface PersistedGameState {
  turn: number;
  deckCount?: number;
  habilidadesActivadas: number[];
  discardedCards: number[];
  players: PersistedPlayerState[];
}

export interface EstadoInicialJugador {
  userId: string;
  controlador: playerController;
  dificultadBot?: dificultadBot;
  nombreEnPartida?: string;
}

export interface ConfiguracionInicioPartida {
  deckCount: number;
  enabledPowers: number[];
}

export const SIN_CARTAS_ERROR_MESSAGE =
  'No quedan cartas suficientes para continuar la partida';
export const HABILIDAD_DENEGADA_SIN_EFECTO_ERROR_MESSAGE =
  'La habilidad no tiene efecto porque hay una restriccion activa';
export const GUARDADO_INVALIDO_ERROR_MESSAGE =
  'No se puede guardar la partida en este momento';

type AccionTurno =
  | 'DRAW'
  | 'RESOLVE_PENDING'
  | 'RESOLVE_SKILL'
  | 'OWNER_TURN_ONLY'
  | 'WAIT_SKILL';

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
  private reaccionUserId = new Map<string, string>();

  // control de los requerimientos de habilidades pendientes por partida
  private readonly permisosHabilidad = new Map<string, PermisoHabilidad>();

  private countHabilidadesSinEfecto = new Map<string, number>();

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

  getActiveGames(): Game[] {
    return Array.from(this.games.values()).filter(
      (game) => game.estado === 'activo',
    );
  }

  cambiarControladorJugador(
    partida: Game,
    userId: string,
    controlador: playerController,
    dificultadBot?: dificultadBot,
    nombreEnPartida?: string,
  ): void {
    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const estadoJugador = partida.estadoGlobal.jugadores[idEnPartida];

    estadoJugador.controlador = controlador;
    if (controlador === 'bot') {
      estadoJugador.dificultadBot = dificultadBot;
      estadoJugador.nombreEnPartida = nombreEnPartida;
    } else {
      estadoJugador.dificultadBot = undefined;
      estadoJugador.nombreEnPartida = undefined;
    }

    partida.updatedAt = new Date();
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

  private obtenerUserIdPorIndice(partida: Game, idEnPartida: number): string {
    const userId = partida.estadoGlobal.turnoJugadores[idEnPartida];

    if (!userId) {
      throw new Error('No existe ningún jugador con ese id en la partida');
    }

    return userId;
  }

  private verificarHabilidadSinEfecto(gameId: string): boolean {
    let habilidadesSinEfecto = this.countHabilidadesSinEfecto.get(gameId);

    if (habilidadesSinEfecto != null && habilidadesSinEfecto > 0) {
      habilidadesSinEfecto -= 1;
      this.countHabilidadesSinEfecto.set(gameId, habilidadesSinEfecto);
      return true;
    } else {
      return false;
    }
  }

  private cancelarHabilidadInmediataSiCorresponde(partida: Game) {
    if (!this.verificarHabilidadSinEfecto(partida.gameId)) {
      return;
    }

    this.limpiarPermisoHabilidad(partida.gameId);
    this.avanzarTurno(partida);
    throw new Error(HABILIDAD_DENEGADA_SIN_EFECTO_ERROR_MESSAGE);
  }

  private cancelarHabilidadAlmacenadaSiCorresponde(partida: Game) {
    if (!this.verificarHabilidadSinEfecto(partida.gameId)) {
      return;
    }

    partida.updatedAt = new Date();
    throw new Error(HABILIDAD_DENEGADA_SIN_EFECTO_ERROR_MESSAGE);
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
    partida.estadoGlobal.turn =
      (partida.estadoGlobal.turn + 1) % totalJugadores;

    for (let i = 0; i < totalJugadores; i++) {
      const jugadorId = this.getTurnUserId(partida);
      const idEnPartida = this.obtenerIndiceJugador(partida, jugadorId);
      const estadoJugador = partida.estadoGlobal.jugadores[idEnPartida];

      if (!estadoJugador.saltarTurno) {
        break;
      }

      estadoJugador.saltarTurno = false;
      partida.estadoGlobal.turn =
        (partida.estadoGlobal.turn + 1) % totalJugadores;
    }

    this.limpiarPermisoHabilidad(partida.gameId);
    this.cambiarFase(partida, 'WAIT_DRAW');
    this.actualizarCuboTrasAvanceTurno(partida);
  }

  private actualizarCuboTrasAvanceTurno(partida: Game) {
    if (!partida.estadoGlobal.cuboActivado) {
      return;
    }

    const turnosRestantes = partida.estadoGlobal.cuboTurnosRestantes;
    if (turnosRestantes == null) {
      return;
    }

    const restantes = turnosRestantes - 1;
    partida.estadoGlobal.cuboTurnosRestantes = restantes;

    if (restantes <= 0) {
      this.finalizarPartida(partida, 'cubo');
    }
  }

  private validarAccionTurno(
    partida: Game,
    userId: string,
    accion: AccionTurno,
  ) {
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
      throw new Error(
        'Debes estar en fase de decision para resolver carta pendiente',
      );
    }

    if (
      accion === 'RESOLVE_SKILL' &&
      partida.estadoGlobal.phase !== 'WAIT_SKILL'
    ) {
      throw new Error(
        'Debes estar en fase de habilidad para ejecutar esta accion',
      );
    }
  }

  private abrirVentanaReaccionGlobal(partida: Game) {
    this.reaccionCarta.set(partida.gameId, true);
    this.reaccionUserId.delete(partida.gameId);
  }

  private limpiarPermisoHabilidad(gameId: string) {
    this.permisosHabilidad.delete(gameId);
  }

  private registrarPermisoHabilidad(partida: Game, permiso: PermisoHabilidad) {
    this.limpiarPermisoHabilidad(partida.gameId);
    this.permisosHabilidad.set(partida.gameId, permiso);
  }

  private obtenerPermisoHabilidadActiva(
    partida: Game,
    jugadorId: string,
    tiposPermitidos?: TipoPermisoHabilidad[],
  ): PermisoHabilidad {
    const permiso = this.permisosHabilidad.get(partida.gameId);
    const turno = partida.estadoGlobal.turn;

    if (
      !permiso ||
      permiso.jugadorId !== jugadorId ||
      permiso.turno !== turno
    ) {
      throw new Error(
        'No tienes permiso para usar esta habilidad en este momento',
      );
    }

    if (tiposPermitidos && !tiposPermitidos.includes(permiso.tipo)) {
      throw new Error('La habilidad pendiente no permite esta accion');
    }

    return permiso;
  }

  private registrarPermisoHabilidadPorCartaDescartada(
    partida: Game,
    jugadorId: string,
    cartaDescartada: Card,
  ): ResultadoRegistroHabilidad {
    this.limpiarPermisoHabilidad(partida.gameId);

    if (!this.estaHabilidadActiva(partida, cartaDescartada.carta)) {
      return { tipo: 'sin-efecto-inmediato', requiereResolverHabilidad: false };
    }

    if (cartaDescartada.carta === 10) {
      this.registrarPermisoHabilidad(partida, {
        jugadorId,
        tipo: 'ver-carta-propia',
        turno: partida.estadoGlobal.turn,
      });
      return { tipo: 'requiere-skill', requiereResolverHabilidad: true };
    }

    if (cartaDescartada.carta === 11) {
      this.registrarPermisoHabilidad(partida, {
        jugadorId,
        tipo: 'ver-carta-propia-y-rival',
        turno: partida.estadoGlobal.turn,
      });
      return { tipo: 'requiere-skill', requiereResolverHabilidad: true };
    }

    if (cartaDescartada.carta === 1) {
      this.registrarPermisoHabilidad(partida, {
        jugadorId,
        tipo: 'intercambiar-todas',
        turno: partida.estadoGlobal.turn,
      });
      return { tipo: 'requiere-skill', requiereResolverHabilidad: true };
    }

    if (cartaDescartada.carta === 2) {
      this.registrarPermisoHabilidad(partida, {
        jugadorId,
        tipo: 'hacer-robar-carta',
        turno: partida.estadoGlobal.turn,
      });
      return { tipo: 'requiere-skill', requiereResolverHabilidad: true };
    }

    if (cartaDescartada.carta === 3) {
      this.registrarPermisoHabilidad(partida, {
        jugadorId,
        tipo: 'proteger-carta',
        turno: partida.estadoGlobal.turn,
      });
      return { tipo: 'requiere-skill', requiereResolverHabilidad: true };
    }

    if (cartaDescartada.carta === 4) {
      this.registrarPermisoHabilidad(partida, {
        jugadorId,
        tipo: 'saltar-turno-jugador',
        turno: partida.estadoGlobal.turn,
      });
      return { tipo: 'requiere-skill', requiereResolverHabilidad: true };
    }

    if (cartaDescartada.carta === 6) {
      /*Esta acción se ejecuta directamente sobre el mismo jugador, no hace
        falta verificar ningún turno por lo que se puede realizar directamente
        la acción de robar aquí.*/

      const idEnPartida = this.obtenerIndiceJugador(partida, jugadorId);
      const estadoJugador = partida.estadoGlobal.jugadores[idEnPartida];

      const reshuffleInfo = this.intentarRebarajarDescartes(partida);

      const cartaRobada = partida.estadoGlobal.cartasVigentes.pop();

      if (!cartaRobada) {
        throw new Error(SIN_CARTAS_ERROR_MESSAGE);
      }

      estadoJugador.cartasMano[estadoJugador.cartasMano.length] = cartaRobada;

      reshuffleInfo.cantidadCartasMazo =
        partida.estadoGlobal.cartasVigentes.length;

      return {
        tipo: 'roba-y-sigue',
        requiereResolverHabilidad: false,
        cartaRobada,
        reshuffle: reshuffleInfo,
      };
    }

    if (cartaDescartada.carta === 7) {
      const idEnPartida = this.obtenerIndiceJugador(partida, jugadorId);
      partida.estadoGlobal.jugadores[idEnPartida].habilidadesActivadas.push(7);
      partida.updatedAt = new Date();
      return { tipo: 'sin-efecto-inmediato', requiereResolverHabilidad: false };
    }

    if (cartaDescartada.carta === 8) {
      const idEnPartida = this.obtenerIndiceJugador(partida, jugadorId);
      partida.estadoGlobal.jugadores[idEnPartida].habilidadesActivadas.push(8);
      partida.updatedAt = new Date();
      return { tipo: 'sin-efecto-inmediato', requiereResolverHabilidad: false };
    }

    if (cartaDescartada.carta === 9) {
      this.registrarPermisoHabilidad(partida, {
        tipo: 'intercambiar-carta',
        jugadorId,
        turno: partida.estadoGlobal.turn,
        estado: 'esperando-iniciador',
      });

      return { tipo: 'requiere-skill', requiereResolverHabilidad: true };
    }
    return { tipo: 'sin-efecto-inmediato', requiereResolverHabilidad: false };
  }

  private estaHabilidadActiva(partida: Game, carta: number): boolean {
    return partida.estadoGlobal.habilidadesActivadas.includes(carta);
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

    if (
      partida.estadoGlobal.phase === 'WAIT_DECISION' &&
      estadoJugador.cartaPendiente
    ) {
      // Se descarta la pendiente
      partida.estadoGlobal.cartasDescartadas.push(estadoJugador.cartaPendiente);
      estadoJugador.cartaPendiente = undefined;
      this.abrirVentanaReaccionGlobal(partida);
    }

    if (partida.estadoGlobal.phase === 'WAIT_SKILL') {
      // timeout cuando habilidad obligatoria: se pierde la accion y se pasa turno
      this.limpiarPermisoHabilidad(partida.gameId);
    }

    this.avanzarTurno(partida);
    return true;
  }

  private static crearCarta(
    carta: number,
    palo: PaloCarta,
    habilidad: Habilidad = 'ninguna',
    puntos: number,
    protegida: boolean = false,
  ): Card {
    return {
      carta,
      palo,
      habilidad,
      puntos,
      protegida,
    };
  }

  // función que crea la baraja inicial del juego
  private static rellenarBaraja(numBarajas: number = 1): Card[] {
    const baraja: Card[] = [];
    const vtipo: PaloCarta[] = ['corazones', 'picas', 'treboles', 'rombos'];

    for (let deck = 0; deck < numBarajas; deck++) {
      for (let tipo = 0; tipo < vtipo.length; tipo++) {
        for (let i = 1; i <= 13; i++) {
          let puntos = 0;
          if (
            i === 13 &&
            (vtipo[tipo] === 'corazones' || vtipo[tipo] === 'rombos')
          ) {
            puntos = 0;
          } else if (
            i === 13 &&
            (vtipo[tipo] === 'picas' || vtipo[tipo] === 'treboles')
          ) {
            puntos = 20;
          } else {
            puntos = i;
          }
          baraja.push(
            GameManager.crearCarta(i, vtipo[tipo], 'ninguna', puntos, false),
          );
        }
      }

      for (let i = 1; i <= 3; i++) {
        baraja.push(
          GameManager.crearCarta(52 + i, 'joker', 'ninguna', -1, false),
        );
      }
    }

    return baraja;
  }

  private static encodeCard(card: Card): number {
    const protectionFlag = card.protegida ? 100 : 0;

    if (card.palo === 'joker') {
      return card.carta + protectionFlag;
    }

    const base = {
      corazones: 0,
      picas: 13,
      treboles: 26,
      rombos: 39,
    }[card.palo];

    return base + card.carta + protectionFlag;
  }

  private static decodeCard(code: number): Card {
    const protegida = code >= 100;
    const normalizedCode = protegida ? code - 100 : code;

    if (normalizedCode >= 53 && normalizedCode <= 55) {
      return GameManager.crearCarta(
        normalizedCode,
        'joker',
        'ninguna',
        -1,
        protegida,
      );
    }

    if (normalizedCode < 1 || normalizedCode > 52) {
      throw new Error('Carta persistida inválida');
    }

    let palo: PaloCarta;
    let carta: number;

    if (normalizedCode <= 13) {
      palo = 'corazones';
      carta = normalizedCode;
    } else if (normalizedCode <= 26) {
      palo = 'picas';
      carta = normalizedCode - 13;
    } else if (normalizedCode <= 39) {
      palo = 'treboles';
      carta = normalizedCode - 26;
    } else {
      palo = 'rombos';
      carta = normalizedCode - 39;
    }

    let puntos = 0;
    if (carta === 13 && (palo === 'corazones' || palo === 'rombos')) {
      puntos = 0;
    } else if (carta === 13 && (palo === 'picas' || palo === 'treboles')) {
      puntos = 20;
    } else {
      puntos = carta;
    }

    return GameManager.crearCarta(carta, palo, 'ninguna', puntos, protegida);
  }

  private static normalizeEncodedCardForDeck(code: number): number {
    return code >= 100 ? code - 100 : code;
  }

  private normalizarEstadoParaGuardado(partida: Game) {
    let huboCambios = false;

    for (const estadoJugador of partida.estadoGlobal.jugadores) {
      if (!estadoJugador.cartaPendiente) {
        continue;
      }

      partida.estadoGlobal.cartasVigentes.push(estadoJugador.cartaPendiente);
      estadoJugador.cartaPendiente = undefined;
      huboCambios = true;
    }

    if (partida.estadoGlobal.phase !== 'WAIT_DRAW') {
      partida.estadoGlobal.phase = 'WAIT_DRAW';
      huboCambios = true;
    }

    this.actualizarDeadlineTurno(partida);

    if (huboCambios) {
      partida.updatedAt = new Date();
    }
  }

  private validarPersistenciaPermitida(partida: Game) {
    if (partida.estado !== 'activo') {
      throw new Error(
        `${GUARDADO_INVALIDO_ERROR_MESSAGE}: la partida no está activa`,
      );
    }

    if (partida.estadoGlobal.cuboActivado) {
      throw new Error(
        `${GUARDADO_INVALIDO_ERROR_MESSAGE}: no se puede guardar con cubo activo`,
      );
    }

    if (this.permisosHabilidad.has(partida.gameId)) {
      throw new Error(
        `${GUARDADO_INVALIDO_ERROR_MESSAGE}: hay una habilidad pendiente`,
      );
    }

    const habilidadesSinEfecto =
      this.countHabilidadesSinEfecto.get(partida.gameId) ?? 0;
    if (habilidadesSinEfecto > 0) {
      throw new Error(
        `${GUARDADO_INVALIDO_ERROR_MESSAGE}: hay efectos de habilidad pendientes`,
      );
    }
  }

  exportarEstadoPersistido(partida: Game): PersistedGameState {
    this.validarPersistenciaPermitida(partida);
    this.normalizarEstadoParaGuardado(partida);

    const players = partida.estadoGlobal.turnoJugadores.map(
      (userId, turnOrder) => {
        const playerState = partida.estadoGlobal.jugadores[turnOrder];
        return {
          userId,
          controlador: playerState.controlador,
          dificultadBot: playerState.dificultadBot,
          nombreEnPartida: playerState.nombreEnPartida,
          turnOrder,
          cards: playerState.cartasMano.map((card) =>
            GameManager.encodeCard(card),
          ),
          habilidades: [...playerState.habilidadesActivadas],
        };
      },
    );

    return {
      turn: partida.estadoGlobal.turn,
      deckCount: partida.estadoGlobal.numBarajas,
      habilidadesActivadas: [...partida.estadoGlobal.habilidadesActivadas],
      discardedCards: partida.estadoGlobal.cartasDescartadas.map((card) =>
        GameManager.encodeCard(card),
      ),
      players,
    };
  }

  cerrarPartidaActiva(gameId: string): void {
    const partida = this.getGameById(gameId);
    this.limpiarEstructurasPartida(partida);
  }

  private limpiarEstructurasPartida(partida: Game) {
    this.games.delete(partida.gameId);
    this.roomToGame.delete(partida.roomId);
    this.reaccionCarta.delete(partida.gameId);
    this.reaccionUserId.delete(partida.gameId);
    this.permisosHabilidad.delete(partida.gameId);
    this.countHabilidadesSinEfecto.delete(partida.gameId);
  }

  cargarEstadoPersistido(
    codigoSala: string,
    persisted: PersistedGameState,
  ): Game {
    if (this.roomToGame.has(codigoSala)) {
      throw new Error('Ya existe una partida activa para la sala');
    }

    const playersOrdered = [...persisted.players].sort(
      (a, b) => a.turnOrder - b.turnOrder,
    );

    //antes me ha pasado
    if (playersOrdered.length === 0) {
      throw new Error('No hay jugadores en la partida guardada');
    }

    const estadoJugadores: PlayerState[] = playersOrdered.map((player) => ({
      cartasMano: player.cards.map((code) => GameManager.decodeCard(code)),
      controlador: player.controlador,
      dificultadBot: player.dificultadBot,
      nombreEnPartida: player.nombreEnPartida,
      habilidadesActivadas: [...player.habilidades],
      saltarTurno: false,
    }));

    const deckCount = persisted.deckCount ?? DEFAULT_DECK_COUNT;
    const habilidadesActivadas = [...persisted.habilidadesActivadas];

    const encodedDeck = GameManager.rellenarBaraja(deckCount).map((card) =>
      GameManager.encodeCard(card),
    );

    //Lo hago con las cartas codificadas porque son un entero y supongo que sera mas rapido que con el tipo carta
    const usedCards = [
      ...persisted.discardedCards,
      //Se ha preguntado a chatgpt como sacar la lista de cartas teniendo las cartas separadas en varias componentes de un vector
      ...playersOrdered.flatMap((player) => player.cards),
    ];

    //Se hace asi para detectar inchoerencias como cartas invalidas o duplicadas
    for (const usedCard of usedCards) {
      const idx = encodedDeck.indexOf(
        GameManager.normalizeEncodedCardForDeck(usedCard),
      );
      if (idx === -1) {
        throw new Error('La partida guardada contiene cartas inválidas');
      }
      encodedDeck.splice(idx, 1);
    }

    const cartasVigentes = GameManager.mezclarArray(encodedDeck).map((code) =>
      GameManager.decodeCard(code),
    );

    if (persisted.turn < 0 || persisted.turn >= playersOrdered.length) {
      throw new Error('Turno persistido inválido');
    }

    const turn = persisted.turn;
    const gameCode = this.generateUniqueRoomCode();

    const estadoGlobal: GameState = {
      turn,
      phase: 'WAIT_DRAW',
      turnDeadlineAt: Date.now() + TURN_TIMEOUT_MS + EXTRA_TIME_FIRST_TURN,
      numBarajas: deckCount,
      cuboActivado: false,
      cuboTurnosRestantes: undefined,
      cuboSolicitanteId: null,
      cartasVigentes,
      cartasDescartadas: persisted.discardedCards.map((code) =>
        GameManager.decodeCard(code),
      ),
      habilidadesActivadas,
      turnoJugadores: playersOrdered.map((player) => player.userId),
      jugadores: estadoJugadores,
    };

    const partida: Game = {
      gameId: gameCode,
      roomId: codigoSala,
      estado: 'activo',
      estadoGlobal,
      updatedAt: new Date(),
    };

    this.games.set(partida.gameId, partida);
    this.roomToGame.set(codigoSala, partida.gameId);
    this.reaccionCarta.set(partida.gameId, true);
    this.reaccionUserId.delete(partida.gameId);
    this.permisosHabilidad.delete(partida.gameId);
    this.countHabilidadesSinEfecto.set(partida.gameId, 0);

    return partida;
  }

  private static mezclarArray<T>(array: T[]): T[] {
    const resultado = [...array];

    for (let i = resultado.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
    }

    return resultado;
  }

  private intentarRebarajarDescartes(partida: Game): ReshuffleInfo {
    if (partida.estadoGlobal.cartasVigentes.length > 0) {
      return {
        huboRebarajado: false,
        cantidadCartasMazo: partida.estadoGlobal.cartasVigentes.length,
      };
    }

    if (partida.estadoGlobal.cartasDescartadas.length <= 1) {
      this.finalizarPartida(partida, 'sinCartasMazo');
      throw new Error(SIN_CARTAS_ERROR_MESSAGE);
    }

    const cartaSuperior = partida.estadoGlobal.cartasDescartadas.pop();
    if (!cartaSuperior) {
      this.finalizarPartida(partida, 'sinCartasMazo');
      throw new Error(SIN_CARTAS_ERROR_MESSAGE);
    }

    const nuevasCartasMazo = GameManager.mezclarArray(
      partida.estadoGlobal.cartasDescartadas,
    );

    partida.estadoGlobal.cartasVigentes = nuevasCartasMazo;
    partida.estadoGlobal.cartasDescartadas = [cartaSuperior];
    partida.updatedAt = new Date();

    return {
      huboRebarajado: true,
      cantidadCartasMazo: partida.estadoGlobal.cartasVigentes.length,
    };
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

  private consumirProteccionSiCartaAjena(
    partida: Game,
    actorId: string,
    propietarioId: string,
    carta: Card,
    accion: 'intercambiar' | 'visualizar',
  ) {
    if (actorId === propietarioId || !carta.protegida) {
      return;
    }

    carta.protegida = false;
    partida.updatedAt = new Date();

    if (accion === 'intercambiar') {
      throw new Error(
        'La carta seleccionada está protegida y no puede intercambiarse',
      );
    }

    throw new Error(
      'La carta seleccionada está protegida y no puede visualizarse',
    );
  }

  inicioPartida(
    codigoSala: string,
    jugadoresIniciales: EstadoInicialJugador[],
    configuracion?: ConfiguracionInicioPartida,
  ): Game {
    if (this.roomToGame.has(codigoSala)) {
      throw new Error('Ya existe una partida activa para la sala');
    }

    const numJugadores = jugadoresIniciales.length;
    const numBarajas = (configuracion?.deckCount ?? DEFAULT_DECK_COUNT) as 1 | 2;
    const habilidadesActivadas = configuracion
      ? [...configuracion.enabledPowers]
      : [...AVAILABLE_POWERS];

    const aux: Card[] = GameManager.rellenarBaraja(numBarajas);
    const baraja: Card[] = GameManager.mezclarArray(aux);
    const gameCode = this.generateUniqueRoomCode();
    const estadoJugadores: PlayerState[] = jugadoresIniciales.map((jugador) => ({
        cartasMano: [],
        controlador: jugador.controlador,
        dificultadBot: jugador.dificultadBot,
        nombreEnPartida: jugador.nombreEnPartida,
        habilidadesActivadas: [],
        saltarTurno: false,
      }));

    GameManager.asignarCartasJugadores(baraja, estadoJugadores, numJugadores);
    const estadoGlobal: GameState = {
      turn: 0,
      phase: 'WAIT_DRAW',
      turnDeadlineAt: Date.now() + TURN_TIMEOUT_MS + EXTRA_TIME_FIRST_TURN, // se le da un tiempo extra en el primer turno
      numBarajas,
      cuboActivado: false,
      cuboTurnosRestantes: undefined,
      cuboSolicitanteId: null,
      cartasVigentes: baraja,
      cartasDescartadas: [],
      habilidadesActivadas,
      turnoJugadores: jugadoresIniciales.map((jugador) => jugador.userId),
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
    this.countHabilidadesSinEfecto.set(gameCode, 0);
    return partida;
  }

  robarCarta(partida: Game, userId: string): ResultadoRobarCarta {
    this.validarAccionTurno(partida, userId, 'DRAW');

    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const estadoJugador = partida.estadoGlobal.jugadores[idEnPartida];

    if (estadoJugador.cartaPendiente) {
      throw new Error('El jugador ya tiene una carta pendiente de resolver');
    }

    this.limpiarPermisoHabilidad(partida.gameId);

    const reshuffleInfo = this.intentarRebarajarDescartes(partida);

    const cartaRobada = partida.estadoGlobal.cartasVigentes.pop();
    if (!cartaRobada) {
      throw new Error(SIN_CARTAS_ERROR_MESSAGE);
    }

    estadoJugador.cartaPendiente = cartaRobada;
    this.cambiarFase(partida, 'WAIT_DECISION');

    reshuffleInfo.cantidadCartasMazo =
      partida.estadoGlobal.cartasVigentes.length;

    return {
      cartaRobada,
      reshuffle: reshuffleInfo,
    };
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

  descartarCartaPendiente(
    partida: Game,
    userId: string,
  ): ResultadoDescartarPendiente {
    this.validarAccionTurno(partida, userId, 'RESOLVE_PENDING');

    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const cartaPendiente =
      partida.estadoGlobal.jugadores[idEnPartida].cartaPendiente;
    if (!cartaPendiente) {
      throw new Error('No hay carta pendiente');
    }

    partida.estadoGlobal.cartasDescartadas.push(cartaPendiente);
    partida.estadoGlobal.jugadores[idEnPartida].cartaPendiente = undefined;

    const requiereResolverHabilidad =
      this.registrarPermisoHabilidadPorCartaDescartada(
        partida,
        userId,
        cartaPendiente,
      );

    this.abrirVentanaReaccionGlobal(partida);

    if (requiereResolverHabilidad.requiereResolverHabilidad) {
      this.cambiarFase(partida, 'WAIT_SKILL');
    } else {
      this.avanzarTurno(partida);
    }

    return {
      cartaDescartada: cartaPendiente,
      resultadoHabilidad: requiereResolverHabilidad,
    };
  }

  descartarCartaPorPendiente(
    partida: Game,
    numCarta: number,
    userId: string,
  ): Card {
    this.validarAccionTurno(partida, userId, 'RESOLVE_PENDING');

    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const cartaPendiente =
      partida.estadoGlobal.jugadores[idEnPartida].cartaPendiente;
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

    this.limpiarPermisoHabilidad(partida.gameId); //Porque aqui???

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
      partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano[
        numCartaRemitente
      ];
    if (!cartaRemitente) {
      throw new Error('No tienes en la mano la carta seleccionada');
    }

    const cartaDestinatario =
      partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano[
        numCartaDestinatario
      ];
    if (!cartaDestinatario) {
      throw new Error(
        'El destinatario no tiene en la mano la carta seleccionada',
      );
    }

    this.consumirProteccionSiCartaAjena(
      partida,
      remitenteId,
      destinatarioId,
      cartaDestinatario,
      'intercambiar',
    );

    partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano[
      numCartaDestinatario
    ] = cartaRemitente;
    partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano[numCartaRemitente] =
      cartaDestinatario;
  }

  intercambiarCartaBot(
    partida: Game,
    remitenteId: string,
    destinatarioId: string,
    numCartaRemitente: number,
    numCartaDestinatario: number,
  ): boolean {
    this.validarAccionTurno(partida, remitenteId, 'RESOLVE_SKILL');

    const permiso = this.obtenerPermisoHabilidadActiva(partida, remitenteId, [
      'intercambiar-carta',
    ]);

    if (permiso.tipo !== 'intercambiar-carta') {
      throw new Error('La habilidad pendiente no permite esta accion');
    }

    this.cancelarHabilidadInmediataSiCorresponde(partida);

    const idEnPartidaR = this.obtenerIndiceJugador(partida, remitenteId);
    const idEnPartidaD = this.obtenerIndiceJugador(partida, destinatarioId);

    const cartaRemitente =
      partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano[
        numCartaRemitente
      ];
    if (!cartaRemitente) {
      throw new Error('No tienes en la mano la carta seleccionada');
    }

    const cartaDestinatario =
      partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano[
        numCartaDestinatario
      ];
    if (!cartaDestinatario) {
      throw new Error(
        'El destinatario no tiene en la mano la carta seleccionada',
      );
    }

    this.consumirProteccionSiCartaAjena(
      partida,
      remitenteId,
      destinatarioId,
      cartaDestinatario,
      'intercambiar',
    );

    partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano[
      numCartaDestinatario
    ] = cartaRemitente;
    partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano[numCartaRemitente] =
      cartaDestinatario;

    this.limpiarPermisoHabilidad(partida.gameId);
    this.avanzarTurno(partida);

    return true;
  }

  verCarta(
    partida: Game,
    solicitanteId: string,
    indexCartaPropia: number,
    rivalId?: string,
    indexCartaRival?: number,
  ): ResultadoVerCarta {
    this.validarAccionTurno(partida, solicitanteId, 'RESOLVE_SKILL');

    const permiso = this.obtenerPermisoHabilidadActiva(partida, solicitanteId, [
      'ver-carta-propia',
      'ver-carta-propia-y-rival',
    ]);

    this.cancelarHabilidadInmediataSiCorresponde(partida);

    const quiereVerRival = rivalId != null || indexCartaRival != null;

    if (permiso.tipo === 'ver-carta-propia') {
      if (quiereVerRival) {
        throw new Error('La carta 10 solo permite ver una carta propia');
      }

      const cartaPropia = this.obtenerCartaDeJugador(
        partida,
        solicitanteId,
        indexCartaPropia,
      );

      this.limpiarPermisoHabilidad(partida.gameId);
      this.avanzarTurno(partida);
      return { cartaPropia };
    }

    if (rivalId == null || indexCartaRival == null) {
      throw new Error(
        'La carta 11 requiere indicar una carta propia y otra rival',
      );
    }

    if (rivalId === solicitanteId) {
      throw new Error('La segunda carta debe pertenecer a un rival');
    }

    const cartaPropia = this.obtenerCartaDeJugador(
      partida,
      solicitanteId,
      indexCartaPropia,
    );

    const cartaRival = this.obtenerCartaDeJugador(
      partida,
      rivalId,
      indexCartaRival,
    );

    this.consumirProteccionSiCartaAjena(
      partida,
      solicitanteId,
      rivalId,
      cartaRival,
      'visualizar',
    );

    this.limpiarPermisoHabilidad(partida.gameId);
    this.avanzarTurno(partida);

    return {
      cartaPropia,
      cartaRival,
    };
  }

  intercambiarTodasCartas(
    partida: Game,
    remitenteId: string,
    destinatarioId: string,
  ): boolean {
    this.validarAccionTurno(partida, remitenteId, 'WAIT_SKILL');

    const permiso = this.obtenerPermisoHabilidadActiva(partida, remitenteId, [
      'intercambiar-todas',
    ]);

    if (!permiso) {
      throw new Error('El jugador no tiene permiso para realizar esta acción');
    }

    this.cancelarHabilidadInmediataSiCorresponde(partida);

    const idEnPartidaR = this.obtenerIndiceJugador(partida, remitenteId);
    const idEnPartidaD = this.obtenerIndiceJugador(partida, destinatarioId);
    const cartaProtegidaDestinatario = partida.estadoGlobal.jugadores[
      idEnPartidaD
    ].cartasMano.find((carta) => carta.protegida);

    if (cartaProtegidaDestinatario) {
      this.consumirProteccionSiCartaAjena(
        partida,
        remitenteId,
        destinatarioId,
        cartaProtegidaDestinatario,
        'intercambiar',
      );
    }

    const cartasRemitente = [
      ...partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano,
    ];

    partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano = [
      ...partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano,
    ];

    partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano = cartasRemitente;

    this.limpiarPermisoHabilidad(partida.gameId);
    this.avanzarTurno(partida);
    return true;
  }

  calcularPuntosJugador(partida: Game, userId: string): number {
    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const cartasJugador =
      partida.estadoGlobal.jugadores[idEnPartida].cartasMano;

    const cartasNoJoker = cartasJugador.filter((carta) => carta.palo !== 'joker');
    const jokers = cartasJugador.filter((carta) => carta.palo === 'joker');

    const cartasPorNumero = new Map<number, Card[]>();

    for (const carta of cartasNoJoker) {
      const grupo = cartasPorNumero.get(carta.carta) ?? []; //agrupo por numeros
      grupo.push(carta);
      cartasPorNumero.set(carta.carta, grupo);
    }

    let puntosNoJoker = 0;

    for (const grupo of cartasPorNumero.values()) {
      if (grupo.length === 1) {
        puntosNoJoker += grupo[0].puntos;
        continue;
      }

      if (grupo.length === 2) {
        // En parejas solo cuenta una de las cartas
        puntosNoJoker += Math.min(grupo[0].puntos, grupo[1].puntos); //min por si hay pareja de reyes
        continue;
      }

      if (grupo.length === 3) {
        //puntosNoJoker += 0; 
        continue;
      }

      //si es grupo de 4 o mas
      puntosNoJoker += -8;
    }

    //Siempre -1 ya lo cambiaremos si cambiamos su puntuacion
    const puntosJoker = jokers.length * -1;

    return puntosNoJoker + puntosJoker;
  }

  solicitarCubo(partida: Game, userId: string): { activado: boolean } {
    this.obtenerIndiceJugador(partida, userId);

    if (partida.estado !== 'activo') {
      throw new Error('La partida no está activa');
    }

    if (partida.estadoGlobal.cuboActivado) {
      return { activado: false };
    }

    const totalJugadores = partida.estadoGlobal.turnoJugadores.length;
    partida.estadoGlobal.cuboActivado = true;
    partida.estadoGlobal.cuboSolicitanteId = userId;
    partida.estadoGlobal.cuboTurnosRestantes = totalJugadores + 1;
    partida.updatedAt = new Date();

    return { activado: true };
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
      throw new Error(
        'Ha habido algun error inicializando el estadoReaccion para esta partida',
      );
    }

    if (reaccionCarta === true) {
      this.reaccionCarta.set(idPartida, false);
      this.reaccionUserId.set(idPartida, userId);
      return true;
    }

    const userBloqueado = this.reaccionUserId.get(idPartida);
    return userBloqueado === userId;
  }

  /**
   * Calcula el ranking completo de todos los jugadores ordenados por puntuación
   * El ranking usa posiciones de competicion (1, 1, 3, 4...)
   * @returns Array de objetos {userId, puntaje, posicion} ordenados de menor a mayor puntaje
   */
  private calcularRanking(
    partida: Game,
  ): Array<{ userId: string; puntaje: number; posicion: number }> {
    const jugadores = partida.estadoGlobal.turnoJugadores;

    if (jugadores.length === 0) {
      throw new Error('No hay jugadores en la partida para calcular ranking');
    }

    // Crear array con userId y puntaje
    const ranking = jugadores.map((userId) => ({
      userId,
      puntaje: this.calcularPuntosJugador(partida, userId),
      posicion: 0,
    }));

    // Ordenar por puntaje (menor puntaje = mejor posición)
    ranking.sort((a, b) => a.puntaje - b.puntaje);

    //Asignar posiciones con empates (ranking de competicion: 1,1,3,4...)
    let posicionActual = 1;
    for (let i = 0; i < ranking.length; i++) {
      if (i > 0 && ranking[i].puntaje > ranking[i - 1].puntaje) {
        posicionActual = i + 1;
      }
      ranking[i].posicion = posicionActual;
    }

    return ranking;
  }

  private finalizarPartida(partida: Game, motivo: FinPartidaMotivo): void {
    // TODO: notificar a gateway/service con el resultado final y limpieza global.
    partida.ranking = this.calcularRanking(partida);
    partida.finPartidaMotivo = motivo;
    partida.estadoGlobal.cuboActivado = false;
    partida.estadoGlobal.cuboSolicitanteId = null;
    partida.estadoGlobal.cuboTurnosRestantes = undefined;
    partida.estado = 'terminado';
    partida.updatedAt = new Date();
    this.limpiarEstructurasPartida(partida);
  }

  private validarFinPartidaPorSinCartas(
    partida: Game,
    userId: string,
  ): boolean {
    const idEnPartida = partida.estadoGlobal.turnoJugadores.indexOf(userId);
    if (idEnPartida === -1) {
      return false;
    }

    const numCartas =
      partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;
    if (numCartas === 0) {
      this.finalizarPartida(partida, 'unJugadorSinCartas');
      return true;
    }

    return false;
  }

  ponerCartaSobreOtra(
    partida: Game,
    userId: string,
    numCarta: number,
  ): ResultadoPonerCartaSobreOtra {
    let accionCorrecta: boolean;
    let numCartas: number;
    let reshuffle: ReshuffleInfo = {
      huboRebarajado: false,
      cantidadCartasMazo: partida.estadoGlobal.cartasVigentes.length,
    };

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

    const carta =
      partida.estadoGlobal.jugadores[idEnPartida].cartasMano[numCarta];
    const ultimaCartaPendiente =
      partida.estadoGlobal.cartasDescartadas[
        partida.estadoGlobal.cartasDescartadas.length - 1
      ];

    if (!ultimaCartaPendiente) {
      throw new Error('No hay carta descartada sobre la que reaccionar');
    }

    //gestionar la excepción de que los reyes tienen distinta
    //puntuación en función del palo pero siguen siendo el mismo numero
    //No entiendo esto mucho la verdad... que tienen que ver los puntos??
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
      reshuffle = this.intentarRebarajarDescartes(partida);

      const cartaRobada = partida.estadoGlobal.cartasVigentes.pop();
      if (!cartaRobada) {
        throw new Error(SIN_CARTAS_ERROR_MESSAGE);
      }

      partida.estadoGlobal.jugadores[idEnPartida].cartasMano.push(cartaRobada);
      numCartas = partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;
      // si falla, libera el bloqueo para permitir nuevos intentos
      this.abrirVentanaReaccionGlobal(partida);
      accionCorrecta = false;
    }

    reshuffle.cantidadCartasMazo = partida.estadoGlobal.cartasVigentes.length;

    return {
      accionCorrecta,
      numCartas,
      reshuffle,
    };
  }

  hacerRobarCarta(
    partida: Game,
    userId: string,
    adversarioId: string,
  ): ResultadoRobarCarta {
    this.validarAccionTurno(partida, userId, 'RESOLVE_SKILL');

    //comprobar que el jugador puede activar la habilidad
    const permiso = this.obtenerPermisoHabilidadActiva(partida, userId, [
      'hacer-robar-carta',
    ]);

    if (permiso.tipo !== 'hacer-robar-carta') {
      throw new Error(
        'El permiso que se tiene no es para que otro jugador \
            robe una carta',
      );
    }

    this.cancelarHabilidadInmediataSiCorresponde(partida);

    const idEnPartida = this.obtenerIndiceJugador(partida, adversarioId);
    const estadoJugador = partida.estadoGlobal.jugadores[idEnPartida];

    const reshuffleInfo = this.intentarRebarajarDescartes(partida);

    const cartaRobada = partida.estadoGlobal.cartasVigentes.pop();

    if (!cartaRobada) {
      throw new Error(SIN_CARTAS_ERROR_MESSAGE);
    }

    estadoJugador.cartasMano[estadoJugador.cartasMano.length] = cartaRobada;

    reshuffleInfo.cantidadCartasMazo =
      partida.estadoGlobal.cartasVigentes.length;

    this.limpiarPermisoHabilidad(partida.gameId);
    this.avanzarTurno(partida);
    return {
      cartaRobada,
      reshuffle: reshuffleInfo,
    };
  }

  protegerCarta(partida: Game, userId: string, numCarta: number): boolean {
    this.validarAccionTurno(partida, userId, 'RESOLVE_SKILL');

    const permiso = this.obtenerPermisoHabilidadActiva(partida, userId, [
      'proteger-carta',
    ]);

    if (permiso.tipo !== 'proteger-carta') {
      throw new Error(
        'El permiso que se tiene no es para que otro jugador \
            robe una carta',
      );
    }

    this.cancelarHabilidadInmediataSiCorresponde(partida);

    const carta = this.obtenerCartaDeJugador(partida, userId, numCarta);
    carta.protegida = true;
    partida.updatedAt = new Date();

    this.limpiarPermisoHabilidad(partida.gameId);

    this.avanzarTurno(partida);

    return true;
  }

  saltarTurnoJugador(
    partida: Game,
    userId: string,
    adversarioId: string,
  ): boolean {
    this.validarAccionTurno(partida, userId, 'RESOLVE_SKILL');

    const permiso = this.obtenerPermisoHabilidadActiva(partida, userId, [
      'saltar-turno-jugador',
    ]);

    if (!permiso) {
      throw new Error('No se tienen permisos para realizar esta acción');
    }

    this.cancelarHabilidadInmediataSiCorresponde(partida);

    const idEnPartidaAdversario = this.obtenerIndiceJugador(
      partida,
      adversarioId,
    );
    const estadoJugador = partida.estadoGlobal.jugadores[idEnPartidaAdversario];

    estadoJugador.saltarTurno = true;

    this.limpiarPermisoHabilidad(partida.gameId);

    this.avanzarTurno(partida);

    return true;
  }

  jugadorMenosPuntuacion(partida: Game, userId: string): string {
    this.validarAccionTurno(partida, userId, 'OWNER_TURN_ONLY');

    if (partida.estadoGlobal.phase !== 'WAIT_DRAW') {
      throw new Error('Solo puedes usar esta habilidad al inicio de tu turno');
    }

    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const habilidades =
      partida.estadoGlobal.jugadores[idEnPartida].habilidadesActivadas;
    const index = habilidades.indexOf(7);

    if (index === -1) {
      throw new Error('No tienes esta habilidad almacenada');
    }

    habilidades.splice(index, 1);

    this.cancelarHabilidadAlmacenadaSiCorresponde(partida);

    let jugadorMinPuntuacion = this.obtenerUserIdPorIndice(partida, 0);
    let aux = this.calcularPuntosJugador(partida, jugadorMinPuntuacion);

    for (let i = 1; i < partida.estadoGlobal.jugadores.length; i++) {
      const userId = this.obtenerUserIdPorIndice(partida, i);

      const aux2 = this.calcularPuntosJugador(partida, userId);

      if (aux2 < aux) {
        aux = aux2;
        jugadorMinPuntuacion = userId;
      }
    }

    partida.updatedAt = new Date();

    return jugadorMinPuntuacion;
  }

  desactivarProximaHabilidad(partida: Game, userId: string): boolean {
    this.validarAccionTurno(partida, userId, 'OWNER_TURN_ONLY');

    if (partida.estadoGlobal.phase !== 'WAIT_DRAW') {
      throw new Error('Solo puedes usar esta habilidad al inicio de tu turno');
    }

    const idEnPartida = this.obtenerIndiceJugador(partida, userId);
    const habilidades =
      partida.estadoGlobal.jugadores[idEnPartida].habilidadesActivadas;
    const index = habilidades.indexOf(8);

    if (index === -1) {
      throw new Error('El jugador no tiene permiso para usar esta habilidad');
    }

    habilidades.splice(index, 1);

    let numHabilidadesSinEfecto =
      this.countHabilidadesSinEfecto.get(partida.gameId) ?? 0;

    numHabilidadesSinEfecto += 1;

    this.countHabilidadesSinEfecto.set(partida.gameId, numHabilidadesSinEfecto);
    partida.updatedAt = new Date();

    return true;
  }

  prepararIntercambioCarta(
    partida: Game,
    userId: string,
    rivalId: string,
    numCartaJugador: number,
  ): boolean {
    this.validarAccionTurno(partida, userId, 'RESOLVE_SKILL');

    const permiso = this.obtenerPermisoHabilidadActiva(partida, userId, [
      'intercambiar-carta',
    ]);

    if (
      permiso.tipo !== 'intercambiar-carta' ||
      permiso.estado !== 'esperando-iniciador'
    ) {
      throw new Error('No es el turno para realizar esta acción.');
    }

    permiso.indiceCartaIniciador = numCartaJugador;
    permiso.rivalId = rivalId;
    permiso.estado = 'esperando-rival';

    return true;
  }

  intercambiarCartaInteractivo(
    partida: Game,
    userId: string,
    rivalId: string,
    numCarta: number,
  ): boolean {
    this.validarAccionTurno(partida, userId, 'RESOLVE_SKILL');

    const permiso = this.obtenerPermisoHabilidadActiva(partida, rivalId, [
      'intercambiar-carta',
    ]);

    if (
      permiso.jugadorId !== userId ||
      permiso.tipo !== 'intercambiar-carta' ||
      permiso.turno != partida.estadoGlobal.turn ||
      permiso.rivalId !== userId
    ) {
      throw new Error(
        'Ha habido un error inesperado que provoca que la acción \
        sea inválida',
      );
    }

    const idEnPartidaIniciador = this.obtenerIndiceJugador(
      partida,
      permiso.jugadorId,
    );
    const idEnPartidaRival = this.obtenerIndiceJugador(partida, userId);

    const cartasManoIniciador =
      partida.estadoGlobal.jugadores[idEnPartidaIniciador].cartasMano;
    const cartasManoRival =
      partida.estadoGlobal.jugadores[idEnPartidaRival].cartasMano;

    if (permiso.indiceCartaIniciador == null) {
      throw new Error(
        'El jugador que ha iniciado la acción tiene que haber \
        seleccionado la carta que quiere intercambiar',
      );
    }

    const cartaIniciador = cartasManoIniciador[permiso.indiceCartaIniciador];
    cartasManoIniciador[permiso.indiceCartaIniciador] =
      cartasManoRival[numCarta];
    cartasManoRival[numCarta] = cartaIniciador;

    this.limpiarPermisoHabilidad(partida.gameId);
    //TODO: aquí hay que cambiar el estado?
    this.avanzarTurno(partida);

    return true;
  }
  // ----------------------------------------------------------
  // CÁLCULO DE RECOMPENSAS (ELO Y CUBITOS)
  // ----------------------------------------------------------

  /**
   * Calcula el multiplicador de escala según el tamaño de la sala
   * @param totalJugadores Número de jugadores en la partida
   * @returns M (0.5 para 2-3 jugadores, 0.8 para 4-5, 1.0 para 6+)
   */
  private calcularMultiplicadorSala(totalJugadores: number): number {
    if (totalJugadores <= 3) return 0.5;
    if (totalJugadores <= 5) return 0.8;
    return 1.0;
  }

  /**
   * Calcula el cambio de ELO para un jugador según su posición final
   * Fórmula: B = (M × 30) × (1 - (2 × (i - 1)) / (N - 1))
   * Si B > 0: puntos = B
   * Si B ≤ 0: puntos = B × 0.6 (amortiguación de pérdida)
   *
   * @param posicion Posición final del jugador (1 para ganador, N para último)
   * @param totalJugadores Número total de jugadores
   * @returns Cambio de ELO (positivo o negativo)
   */
  private eloChangeByPosition(
    posicion: number,
    totalJugadores: number,
  ): number {
    const M = this.calcularMultiplicadorSala(totalJugadores);
    const maxElo = M * 30;

    // Fórmula bruta: B = (M × 30) × (1 - (2 × (i - 1)) / (N - 1))
    const B = maxElo * (1 - (2 * (posicion - 1)) / (totalJugadores - 1));

    // Aplicar amortiguación si es pérdida
    const eloChange = B > 0 ? B : B * 0.6;

    return Math.round(eloChange);
  }

  /**
   * Calcula los cubitos ganados según la posición final
   * Usa la misma lógica que ELO pero con base de puntos diferente
   *
   * @param posicion Posición final del jugador (1 para ganador, N para último)
   * @param totalJugadores Número total de jugadores
   * @param baseCubitos Cantidad base de cubitos (default 100)
   * @returns Cubitos ganados/perdidos
   */
  private cubitosEarnedByPosition(
    eloChange: number,
    baseCubitos: number = 30,
    multiplicadorElo: number = 3,
  ): number {
    // Cubitos = base mínima + (cambio de ELO × multiplicador)
    // Esto asegura: siempre ganan cubitos, pero proporcional al desempeño
    const cubitos = baseCubitos + eloChange * multiplicadorElo;
    // Garantizar mínimo de `baseCubitos` (nunca negativo)
    return Math.max(baseCubitos, Math.round(cubitos));
  }

  /**
   * Aplica penalización adicional si el jugador activó cubo pero no ganó
   * La penalización reduce tanto ELO como cubitos en un 30%
   *
   * @param eloChange ELO a ganar/perder
   * @param cubitos Cubitos a ganar/perder
   * @param cuboSolicitanteId ID del jugador que solicitó cubo
   * @param ganadorId ID del jugador ganador (posición 1)
   * @returns Objeto con eloChange y cubitos ajustados
   */
  private aplicarPenalizacionCubo(
    eloChange: number,
    cubitos: number,
    cuboSolicitanteId: string | null,
    ganadoresIds: Set<string>,
  ): { eloChange: number; cubitos: number } {
    // Si no hay cubo activo o el solicitante quedó en primera posición, sin penalización
    if (!cuboSolicitanteId || ganadoresIds.has(cuboSolicitanteId)) {
      return { eloChange, cubitos };
    }

    // Penalización: reducir 30% si fue cubo y no ganó
    const penalizacion = 0.7; // Quedarse con 70% = reducción del 30%
    return {
      eloChange: Math.round(eloChange * penalizacion),
      cubitos: Math.round(cubitos * penalizacion),
    };
  }

  /**
   * Calcula las recompensas completas (ELO y cubitos) para todos los jugadores
   * Usa el ranking ya calculado en la partida
   *
   * @param partida Partida finalizada (debe tener ranking ya calculado)
   * @returns Array de {userId, posicion, eloChange, cubitosChange} con recompensas calculadas
   */
  calcularRecompensas(partida: Game): Array<{
    userId: string;
    posicion: number;
    eloChange: number;
    cubitosChange: number;
  }> {
    // Usar el ranking ya calculado en finalizarPartida
    const ranking = partida.ranking;
    if (!ranking || ranking.length === 0) {
      throw new Error('No hay ranking calculado para la partida');
    }

    const totalJugadores = ranking.length;
    const ganadoresIds = new Set(
      ranking.filter((jugador) => jugador.posicion === 1).map((jugador) => jugador.userId),
    );
    const cuboSolicitanteId = partida.estadoGlobal.cuboSolicitanteId;

    const recompensas = ranking.map((jugador) => {
      const posicion = jugador.posicion;
      let eloChange = this.eloChangeByPosition(posicion, totalJugadores);
      // Cubitos basados en el cambio de ELO (proporcional)
      let cubitosChange = this.cubitosEarnedByPosition(eloChange);

      // Aplicar penalización por cubo si corresponde
      const penalizado = this.aplicarPenalizacionCubo(
        eloChange,
        cubitosChange,
        cuboSolicitanteId,
        ganadoresIds,
      );
      eloChange = penalizado.eloChange;
      cubitosChange = penalizado.cubitos;

      return {
        userId: jugador.userId,
        posicion,
        eloChange,
        cubitosChange,
      };
    });

    return recompensas;
  }

  public getBotDecisionContext(gameId: string, botId: string): PermisoHabilidad 
    | null {
    const partida = this.getGameById(gameId);
    this.obtenerIndiceJugador(partida, botId);

    const permiso = this.permisosHabilidad.get(partida.gameId);

    if(!permiso || permiso.jugadorId !== botId) {
      return null;
    }

    return permiso;
  }
}
