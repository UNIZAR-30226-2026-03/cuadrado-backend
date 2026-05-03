import {
  AccionProtegidaCanceladaError,
  GameManager,
  GUARDADO_INVALIDO_ERROR_MESSAGE,
  EstadoInicialJugador,
} from './game.manager';
import { Game } from './interfaces/game.interface';
import { Card } from './interfaces/card.interface';
import { AVAILABLE_POWERS } from '../rooms/interfaces/rules-config.interface';

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
    { userId: 'u1', controlador: 'humano' },
    { userId: 'u2', controlador: 'humano' },
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

  it('si una habilidad está desactivada, descartar esa carta no dispara skill', () => {
    const gameConPoderesParciales = manager.inicioPartida('ROOM-PARTIAL', jugadoresIniciales, {
      deckCount: 1,
      enabledPowers: [1, 2],
    });

    gameConPoderesParciales.estadoGlobal.phase = 'WAIT_DECISION';
    gameConPoderesParciales.estadoGlobal.jugadores[0].cartaPendiente = makeCard(10);

    const resultado = manager.descartarCartaPendiente(gameConPoderesParciales, 'u1');

    expect(resultado.resultadoHabilidad.requiereResolverHabilidad).toBe(false);
    expect(gameConPoderesParciales.estadoGlobal.phase).toBe('WAIT_DRAW');
    expect(gameConPoderesParciales.estadoGlobal.turn).toBe(1);
  });

  it('inicia con 2 barajas y deja el tamaño esperado de mazo', () => {
    const gameDosBarajas = manager.inicioPartida('ROOM-2D', jugadoresIniciales, {
      deckCount: 2,
      enabledPowers: [...AVAILABLE_POWERS],
    });

    // 2 barajas: 110 cartas totales. Con 2 jugadores se reparten 8 cartas (4 por jugador).
    expect(gameDosBarajas.estadoGlobal.numBarajas).toBe(2);
    expect(gameDosBarajas.estadoGlobal.cartasVigentes).toHaveLength(102);
  });

  it('respeta enabledPowers vacio al crear partida', () => {
    const gameSinPoderes = manager.inicioPartida('ROOM-NO-POWERS', jugadoresIniciales, {
      deckCount: 1,
      enabledPowers: [],
    });

    expect(gameSinPoderes.estadoGlobal.habilidadesActivadas).toEqual([]);
  });

  it('descartar carta pendiente avanza turno y vuelve a WAIT_DRAW', () => {
    game.estadoGlobal.phase = 'WAIT_DECISION';
    game.estadoGlobal.jugadores[0].cartaPendiente = makeCard(12);

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

  it('en pareja solo cuenta una carta del mismo numero', () => {
    game.estadoGlobal.jugadores[0].cartasMano = [
      makeCard(7, 'corazones'),
      makeCard(7, 'picas'),
    ];

    expect(manager.calcularPuntosJugador(game, 'u1')).toBe(7);
  });

  it('en trio la suma del grupo pasa a 0 puntos', () => {
    game.estadoGlobal.jugadores[0].cartasMano = [
      makeCard(9, 'corazones'),
      makeCard(9, 'picas'),
      makeCard(9, 'rombos'),
    ];

    expect(manager.calcularPuntosJugador(game, 'u1')).toBe(0);
  });

  it('con 4 cartas o mas del mismo numero el grupo suma -8 puntos', () => {
    game.estadoGlobal.jugadores[0].cartasMano = [
      makeCard(5, 'corazones'),
      makeCard(5, 'picas'),
      makeCard(5, 'treboles'),
      makeCard(5, 'rombos'),
    ];

    expect(manager.calcularPuntosJugador(game, 'u1')).toBe(-8);
  });

  it('las reducciones de grupo no se aplican a jokers', () => {
    game.estadoGlobal.jugadores[0].cartasMano = [
      makeCard(8, 'corazones'),
      makeCard(8, 'picas'),
      {
        carta: 53,
        palo: 'joker',
        habilidad: 'ninguna',
        puntos: -1,
        protegida: false,
      },
    ];

    // Pareja de 8 -> 8 puntos. Joker mantiene su valor (-1).
    expect(manager.calcularPuntosJugador(game, 'u1')).toBe(7);
  });

  it('en pareja de reyes cuenta la carta de menor puntaje', () => {
    game.estadoGlobal.jugadores[0].cartasMano = [
      {
        carta: 13,
        palo: 'picas',
        habilidad: 'ninguna',
        puntos: 20,
        protegida: false,
      },
      {
        carta: 13,
        palo: 'corazones',
        habilidad: 'ninguna',
        puntos: 0,
        protegida: false,
      },
    ];

    expect(manager.calcularPuntosJugador(game, 'u1')).toBe(0);
  });

  it('intercambiar carta propia protegida conserva la proteccion en la posicion del remitente', () => {
    const cartaPropia = makeCard(9, 'corazones', true);
    const cartaRival = makeCard(2, 'picas', false);
    game.estadoGlobal.jugadores[0].cartasMano = [cartaPropia];
    game.estadoGlobal.jugadores[1].cartasMano = [cartaRival];

    manager.intercambiarCarta(game, 'u1', 'u2', 0, 0);

    expect(game.estadoGlobal.jugadores[0].cartasMano[0]).toBe(cartaRival);
    expect(game.estadoGlobal.jugadores[0].cartasMano[0].protegida).toBe(true);
    expect(game.estadoGlobal.jugadores[1].cartasMano[0]).toBe(cartaPropia);
    expect(game.estadoGlobal.jugadores[1].cartasMano[0].protegida).toBe(false);
  });

  it('intercambiar carta protegida de rival cancela accion y consume la proteccion', () => {
    const cartaPropia = makeCard(9, 'corazones', false);
    const cartaRival = makeCard(2, 'picas', true);
    game.estadoGlobal.jugadores[0].cartasMano = [cartaPropia];
    game.estadoGlobal.jugadores[1].cartasMano = [cartaRival];

    expect(() => manager.intercambiarCarta(game, 'u1', 'u2', 0, 0)).toThrow(
      AccionProtegidaCanceladaError,
    );
    expect(game.estadoGlobal.jugadores[0].cartasMano[0]).toBe(cartaPropia);
    expect(game.estadoGlobal.jugadores[1].cartasMano[0]).toBe(cartaRival);
    expect(cartaRival.protegida).toBe(false);
  });

  it('resolver intercambio J mantiene la proteccion de la carta propia seleccionada', () => {
    const cartaPropia = makeCard(11, 'corazones', true);
    const cartaRival = makeCard(2, 'picas', false);
    game.estadoGlobal.jugadores[0].cartasMano = [cartaPropia];
    game.estadoGlobal.jugadores[1].cartasMano = [cartaRival];
    game.estadoGlobal.phase = 'WAIT_SKILL';
    (manager as any).permisosHabilidad.set(game.gameId, {
      jugadorId: 'u1',
      tipo: 'decidir-intercambio-j',
      turno: game.estadoGlobal.turn,
      indexCartaPropia: 0,
      rivalId: 'u2',
      indexCartaRival: 0,
    });

    manager.resolverDecisionJ(game, 'u1', true);

    expect(game.estadoGlobal.jugadores[0].cartasMano[0]).toBe(cartaRival);
    expect(game.estadoGlobal.jugadores[0].cartasMano[0].protegida).toBe(true);
    expect(game.estadoGlobal.jugadores[1].cartasMano[0]).toBe(cartaPropia);
    expect(game.estadoGlobal.jugadores[1].cartasMano[0].protegida).toBe(false);
  });

  it('intercambiar todas: las posiciones con alguna carta protegida no se intercambian', () => {
    const cartasU1 = [makeCard(1, 'corazones'), makeCard(2, 'corazones')];
    const cartasU2 = [makeCard(3, 'picas', true), makeCard(4, 'picas')];
    game.estadoGlobal.jugadores[0].cartasMano = cartasU1;
    game.estadoGlobal.jugadores[1].cartasMano = cartasU2;
    game.estadoGlobal.phase = 'WAIT_SKILL';
    (manager as any).permisosHabilidad.set(game.gameId, {
      jugadorId: 'u1',
      tipo: 'intercambiar-todas',
      turno: game.estadoGlobal.turn,
    });

    manager.intercambiarTodasCartas(game, 'u1', 'u2');

    // Posición 0: u2 tiene carta protegida → ambas se quedan en su sitio.
    expect(game.estadoGlobal.jugadores[0].cartasMano[0].carta).toBe(1);
    expect(game.estadoGlobal.jugadores[1].cartasMano[0].carta).toBe(3);
    expect(game.estadoGlobal.jugadores[1].cartasMano[0].protegida).toBe(true);
    // Posición 1: ninguna protegida → se intercambian.
    expect(game.estadoGlobal.jugadores[0].cartasMano[1].carta).toBe(4);
    expect(game.estadoGlobal.jugadores[1].cartasMano[1].carta).toBe(2);
    expect(game.estadoGlobal.phase).toBe('WAIT_DRAW');
    expect(game.estadoGlobal.turn).toBe(1);
  });

  it('intercambiar todas: la carta protegida del remitente se queda con su dueño', () => {
    const cartaProtegida = makeCard(1, 'corazones', true);
    const cartaNormal = makeCard(2, 'corazones', false);
    const cartaRivalA = makeCard(3, 'picas', false);
    const cartaRivalB = makeCard(4, 'picas', false);
    game.estadoGlobal.jugadores[0].cartasMano = [cartaProtegida, cartaNormal];
    game.estadoGlobal.jugadores[1].cartasMano = [cartaRivalA, cartaRivalB];
    game.estadoGlobal.phase = 'WAIT_SKILL';
    (manager as any).permisosHabilidad.set(game.gameId, {
      jugadorId: 'u1',
      tipo: 'intercambiar-todas',
      turno: game.estadoGlobal.turn,
    });

    manager.intercambiarTodasCartas(game, 'u1', 'u2');

    // Posición 0: u1 tiene carta protegida → ambas posiciones inalteradas.
    expect(game.estadoGlobal.jugadores[0].cartasMano[0]).toBe(cartaProtegida);
    expect(game.estadoGlobal.jugadores[0].cartasMano[0].protegida).toBe(true);
    expect(game.estadoGlobal.jugadores[1].cartasMano[0]).toBe(cartaRivalA);
    // Posición 1: ninguna protegida → se intercambian.
    expect(game.estadoGlobal.jugadores[0].cartasMano[1]).toBe(cartaRivalB);
    expect(game.estadoGlobal.jugadores[1].cartasMano[1]).toBe(cartaNormal);
  });

  it('protegerCarta rechaza si la carta ya está protegida y conserva el permiso para reintentar', () => {
    const cartaProtegida = makeCard(1, 'corazones', true);
    const cartaNormal = makeCard(2, 'corazones', false);
    game.estadoGlobal.jugadores[0].cartasMano = [cartaProtegida, cartaNormal];
    game.estadoGlobal.phase = 'WAIT_SKILL';
    (manager as any).permisosHabilidad.set(game.gameId, {
      jugadorId: 'u1',
      tipo: 'proteger-carta',
      turno: game.estadoGlobal.turn,
    });

    expect(() => manager.protegerCarta(game, 'u1', 0)).toThrow(
      'Esta carta ya está protegida, escoge otra',
    );
    // Permiso intacto: el jugador puede reintentar con otra carta.
    expect(game.estadoGlobal.phase).toBe('WAIT_SKILL');
    expect((manager as any).permisosHabilidad.has(game.gameId)).toBe(true);

    manager.protegerCarta(game, 'u1', 1);
    expect(cartaNormal.protegida).toBe(true);
    expect(game.estadoGlobal.phase).toBe('WAIT_DRAW');
  });

  it('verCartaRival revela la carta elegida del rival y avanza turno', () => {
    const cartaObjetivo = makeCard(7, 'rombos');
    game.estadoGlobal.jugadores[0].cartasMano = [makeCard(1)];
    game.estadoGlobal.jugadores[1].cartasMano = [makeCard(2, 'picas'), cartaObjetivo];
    game.estadoGlobal.phase = 'WAIT_SKILL';
    (manager as any).permisosHabilidad.set(game.gameId, {
      jugadorId: 'u1',
      tipo: 'ver-carta-rival',
      turno: game.estadoGlobal.turn,
    });

    const revelada = manager.verCartaRival(game, 'u1', 'u2', 1);

    expect(revelada.jugadorId).toBe('u2');
    expect(revelada.indexCarta).toBe(1);
    expect(revelada.carta).toBe(cartaObjetivo);
    expect(game.estadoGlobal.phase).toBe('WAIT_DRAW');
    expect(game.estadoGlobal.turn).toBe(1);
  });

  it('verCartaRival cancela la acción si la carta elegida está protegida', () => {
    const cartaProtegida = makeCard(7, 'rombos', true);
    game.estadoGlobal.jugadores[0].cartasMano = [makeCard(1)];
    game.estadoGlobal.jugadores[1].cartasMano = [makeCard(2, 'picas'), cartaProtegida];
    game.estadoGlobal.phase = 'WAIT_SKILL';
    (manager as any).permisosHabilidad.set(game.gameId, {
      jugadorId: 'u1',
      tipo: 'ver-carta-rival',
      turno: game.estadoGlobal.turn,
    });

    expect(() => manager.verCartaRival(game, 'u1', 'u2', 1)).toThrow(
      AccionProtegidaCanceladaError,
    );
    // La protección se consume y el turno avanza.
    expect(cartaProtegida.protegida).toBe(false);
    expect(game.estadoGlobal.phase).toBe('WAIT_DRAW');
    expect(game.estadoGlobal.turn).toBe(1);
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
      deckCount: 1,
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

  it('calcula recompensas por posicion con empates (1,1,3)', () => {
    const gameEmpate = manager.inicioPartida('ROOM-TIE', [
      { userId: 'u1', controlador: 'humano' },
      { userId: 'u2', controlador: 'humano' },
      { userId: 'u3', controlador: 'humano' },
    ]);

    gameEmpate.ranking = [
      { userId: 'u1', puntaje: 5, posicion: 1 },
      { userId: 'u2', puntaje: 5, posicion: 1 },
      { userId: 'u3', puntaje: 7, posicion: 3 },
    ];

    const recompensas = manager.calcularRecompensas(gameEmpate);
    const recompensaU1 = recompensas.find((r) => r.userId === 'u1');
    const recompensaU2 = recompensas.find((r) => r.userId === 'u2');
    const recompensaU3 = recompensas.find((r) => r.userId === 'u3');

    expect(recompensas.map((r) => r.posicion)).toEqual([1, 1, 3]);
    expect(recompensaU1).toBeDefined();
    expect(recompensaU2).toBeDefined();
    expect(recompensaU3).toBeDefined();
    expect(recompensaU1?.eloChange).toBe(recompensaU2?.eloChange);
    expect(recompensaU1?.cubitosChange).toBe(recompensaU2?.cubitosChange);
    expect(recompensaU3?.eloChange).toBeLessThan(recompensaU1?.eloChange ?? 0);
    expect(recompensaU3?.cubitosChange).toBeLessThan(
      recompensaU1?.cubitosChange ?? 0,
    );
  });
});
