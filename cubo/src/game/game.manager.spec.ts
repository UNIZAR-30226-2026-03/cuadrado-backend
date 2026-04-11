import {
  GameManager,
  GUARDADO_INVALIDO_ERROR_MESSAGE,
  EstadoInicialJugador,
} from './game.manager';
import { Game } from './interfaces/game.interface';
import { Card } from './interfaces/card.interface';

const makeCard = (
  carta: number,
  palo: Card['palo'] = 'corazones',
  protegida = false,
): Card => ({
  carta,
  palo,
  habilidad: 'ninguna',
  puntos: carta,
  protegida,
});

describe('GameManager', () => {
  let manager: GameManager;
  let game: Game;
  const roomId = 'ROOM01';
  const jugadoresIniciales: EstadoInicialJugador[] = [
    { userId: 'u1' },
    { userId: 'u2' },
  ];

  beforeEach(() => {
    manager = new GameManager();
    game = manager.inicioPartida(roomId, jugadoresIniciales);
  });

  it('inicia partida con 4 cartas por jugador y fase WAIT_DRAW', () => {
    expect(game.estado).toBe('activo');
    expect(game.estadoGlobal.phase).toBe('WAIT_DRAW');
    expect(game.estadoGlobal.turn).toBe(0);
    expect(game.estadoGlobal.jugadores[0].cartasMano).toHaveLength(4);
    expect(game.estadoGlobal.jugadores[1].cartasMano).toHaveLength(4);
  });

  it('robarCarta deja carta pendiente y pasa a WAIT_DECISION', () => {
    const result = manager.robarCarta(game, 'u1');

    expect(result.cartaRobada).toBeDefined();
    expect(game.estadoGlobal.phase).toBe('WAIT_DECISION');
    expect(game.estadoGlobal.jugadores[0].cartaPendiente).toBeDefined();
  });

  it('no permite robar fuera de turno', () => {
    expect(() => manager.robarCarta(game, 'u2')).toThrow(
      'No es el turno del jugador que intenta jugar',
    );
  });

  it('descartar carta pendiente avanza turno y vuelve a WAIT_DRAW', () => {
    game.estadoGlobal.phase = 'WAIT_DECISION';
    game.estadoGlobal.jugadores[0].cartaPendiente = makeCard(5);

    const cartaDescartada = manager.descartarCartaPendiente(game, 'u1');

    expect(cartaDescartada).toBeDefined();
    expect(game.estadoGlobal.turn).toBe(1);
    expect(game.estadoGlobal.phase).toBe('WAIT_DRAW');
    expect(game.estadoGlobal.jugadores[0].cartaPendiente).toBeUndefined();
    expect(game.estadoGlobal.cartasDescartadas.length).toBeGreaterThan(0);
  });

  it('descartar por pendiente sustituye carta en mano y avanza turno', () => {
    manager.robarCarta(game, 'u1');
    const manoAntes = [...game.estadoGlobal.jugadores[0].cartasMano];

    const cartaDescartada = manager.descartarCartaPorPendiente(game, 0, 'u1');

    expect(cartaDescartada).toEqual(manoAntes[0]);
    expect(game.estadoGlobal.turn).toBe(1);
    expect(game.estadoGlobal.phase).toBe('WAIT_DRAW');
    expect(game.estadoGlobal.jugadores[0].cartaPendiente).toBeUndefined();
  });

  it('timeout en WAIT_DECISION descarta pendiente y avanza turno', () => {
    manager.robarCarta(game, 'u1');
    game.estadoGlobal.turnDeadlineAt = Date.now() - 1;

    const huboTimeout = manager.resolverTimeoutTurno(game);

    expect(huboTimeout).toBe(true);
    expect(game.estadoGlobal.turn).toBe(1);
    expect(game.estadoGlobal.jugadores[0].cartaPendiente).toBeUndefined();
    expect(game.estadoGlobal.phase).toBe('WAIT_DRAW');
  });

  it('cubo solo se activa una vez y calcula turnos restantes', () => {
    const primerIntento = manager.solicitarCubo(game, 'u1');
    const segundoIntento = manager.solicitarCubo(game, 'u2');

    expect(primerIntento.activado).toBe(true);
    expect(segundoIntento.activado).toBe(false);
    expect(game.estadoGlobal.cuboActivado).toBe(true);
    expect(game.estadoGlobal.cuboTurnosRestantes).toBe(3);
  });

  it('reacción carta-sobre-otra bloquea por primer solicitante', () => {
    const aceptadoU1 = manager.solicitarColocarCartaSobreOtra(game.gameId, 'u1');
    const rechazadoU2 = manager.solicitarColocarCartaSobreOtra(game.gameId, 'u2');
    const reintentoU1 = manager.solicitarColocarCartaSobreOtra(game.gameId, 'u1');

    expect(aceptadoU1).toBe(true);
    expect(rechazadoU2).toBe(false);
    expect(reintentoU1).toBe(true);
  });

  it('ponerCartaSobreOtra acierto descarta carta y mantiene cadena', () => {
    game.estadoGlobal.jugadores[0].cartasMano = [makeCard(5), makeCard(7)];
    game.estadoGlobal.cartasDescartadas = [makeCard(5, 'picas')];
    (manager as any).reaccionCarta.set(game.gameId, false);
    (manager as any).reaccionUserId.set(game.gameId, 'u1');

    const result = manager.ponerCartaSobreOtra(game, 'u1', 0);

    expect(result.accionCorrecta).toBe(true);
    expect(result.numCartas).toBe(1);
    expect(game.estadoGlobal.cartasDescartadas.length).toBe(2);
  });

  it('ponerCartaSobreOtra fallo roba carta y abre ventana de reacción', () => {
    game.estadoGlobal.jugadores[0].cartasMano = [makeCard(7), makeCard(9)];
    game.estadoGlobal.cartasDescartadas = [makeCard(5, 'picas')];
    game.estadoGlobal.cartasVigentes = [makeCard(3, 'treboles')];
    (manager as any).reaccionCarta.set(game.gameId, false);
    (manager as any).reaccionUserId.set(game.gameId, 'u1');

    const result = manager.ponerCartaSobreOtra(game, 'u1', 0);

    expect(result.accionCorrecta).toBe(false);
    expect(result.numCartas).toBe(3);
    expect((manager as any).reaccionCarta.get(game.gameId)).toBe(true);
  });

  it('exportarEstadoPersistido normaliza carta pendiente y fase a inicio de turno', () => {
    manager.robarCarta(game, 'u1');

    expect(game.estadoGlobal.phase).toBe('WAIT_DECISION');
    expect(game.estadoGlobal.jugadores[0].cartaPendiente).toBeDefined();

    const persisted = manager.exportarEstadoPersistido(game);

    expect(game.estadoGlobal.phase).toBe('WAIT_DRAW');
    expect(game.estadoGlobal.jugadores[0].cartaPendiente).toBeUndefined();
  });

  it('bloquea guardar si hay efecto de habilidad pendiente', () => {
    (manager as any).countHabilidadesSinEfecto.set(game.gameId, 1);

    expect(() => manager.exportarEstadoPersistido(game)).toThrow(
      GUARDADO_INVALIDO_ERROR_MESSAGE,
    );
  });

  it('bloquea guardar si cubo está activo', () => {
    manager.solicitarCubo(game, 'u1');

    expect(() => manager.exportarEstadoPersistido(game)).toThrow(
      GUARDADO_INVALIDO_ERROR_MESSAGE,
    );
  });

  it('carga estado persistido restaurando cartas protegidas y habilidades almacenadas', () => {
    const persisted = {
      turn: 1,
      habilidadesActivadas: [],
      discardedCards: [12],
      players: [
        {
          userId: 'u1',
          controlador: 'humano',
          dificultadBot: undefined,
          nombreEnPartida: undefined,
          turnOrder: 0,
          cards: [101, 14, 27, 40],
          habilidades: [7],
        },
        {
          userId: 'u2',
          controlador: 'humano',
          dificultadBot: undefined,
          nombreEnPartida: undefined,
          turnOrder: 1,
          cards: [2, 15, 28, 41],
          habilidades: [8],
        },
      ],
    };

    const loaded = manager.cargarEstadoPersistido('ROOM02', persisted);

    expect(loaded.estadoGlobal.turn).toBe(1);
    expect(loaded.estadoGlobal.phase).toBe('WAIT_DRAW');
    expect(loaded.estadoGlobal.jugadores[0].cartasMano[0].protegida).toBe(true);
    expect(loaded.estadoGlobal.jugadores[0].habilidadesActivadas).toContain(7);
    expect(loaded.estadoGlobal.jugadores[1].habilidadesActivadas).toContain(8);
    expect(loaded.estadoGlobal.turnDeadlineAt).toBeGreaterThan(Date.now());
  });

  it('rechaza carga con cartas duplicadas en snapshot', () => {
    const persisted = {
      turn: 0,
      habilidadesActivadas: [],
      discardedCards: [1],
      players: [
        {
          userId: 'u1',
          controlador: 'humano',
          dificultadBot: undefined,
          nombreEnPartida: undefined,
          turnOrder: 0,
          cards: [1, 14, 27, 40],
          habilidades: [],
        },
        {
          userId: 'u2',
          controlador: 'humano',
          dificultadBot: undefined,
          nombreEnPartida: undefined,
          turnOrder: 1,
          cards: [2, 15, 28, 41],
          habilidades: [],
        },
      ],
    };

    expect(() => manager.cargarEstadoPersistido('ROOM-DUP', persisted)).toThrow(
      'La partida guardada contiene cartas inválidas',
    );
  });

  it('rechaza carga con turno persistido fuera de rango', () => {
    const persisted = {
      turn: 2,
      habilidadesActivadas: [],
      discardedCards: [10],
      players: [
        {
          userId: 'u1',
          controlador: 'humano',
          dificultadBot: undefined,
          nombreEnPartida: undefined,
          turnOrder: 0,
          cards: [1, 14, 27, 40],
          habilidades: [],
        },
        {
          userId: 'u2',
          controlador: 'humano',
          dificultadBot: undefined,
          nombreEnPartida: undefined,
          turnOrder: 1,
          cards: [2, 15, 28, 41],
          habilidades: [],
        },
      ],
    };

    expect(() => manager.cargarEstadoPersistido('ROOM03', persisted)).toThrow(
      'Turno persistido inválido',
    );
  });
});
