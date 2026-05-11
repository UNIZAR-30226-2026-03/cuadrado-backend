import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import {
  GameService,
  ValidatedGameContext,
  ValidatedStartContext,
} from './game.service';
import { AccionProtegidaCanceladaError } from './game.manager';
import { GameGateway } from './game.gateway';
import { Game } from './interfaces/game.interface';
import { Card } from './interfaces/card.interface';
import { BotsService } from '../bots/bots.service';
import { Player } from '../rooms/interfaces/player.interface';
import { Room } from '../rooms/interfaces/room.interface';
import { RulesConfig } from '../rooms/interfaces/rules-config.interface';

const createCard = (
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

const createGame = (overrides: Partial<Game> = {}): Game => ({
  gameId: 'G1',
  roomId: 'ROOM1',
  estado: 'activo',
  estadoGlobal: {
    turn: 0,
    phase: 'WAIT_DRAW',
    turnDeadlineAt: Date.now() + 30_000,
    turnTimeoutMs: 30_000,
    cuboActivado: false,
    cuboSolicitanteId: null,
    cuboTurnosRestantes: undefined,
    numBarajas: 1,
    cartasVigentes: [],
    cartasDescartadas: [],
    habilidadesActivadas: [],
    turnoJugadores: ['u1', 'u2'],
    jugadores: [
      {
        cartasMano: [],
        controlador: 'humano',
        habilidadesActivadas: [],
        saltarTurno: false,
      },
      {
        cartasMano: [],
        controlador: 'humano',
        habilidadesActivadas: [],
        saltarTurno: false,
      },
    ],
  },
  updatedAt: new Date(),
  ...overrides,
});

const baseRules: RulesConfig = {
  maxPlayers: 4,
  turnTimeSeconds: 30,
  isPrivate: false,
  fillWithBots: false,
  dificultadBots: 'media',
};

const createPlayer = (overrides: Partial<Player> = {}): Player => ({
  userId: 'u1',
  controlador: 'humano',
  idInRoom: 0,
  socketId: 'socket-1',
  isHost: true,
  joinedAt: new Date(),
  connected: true,
  ...overrides,
});

const createRoom = (overrides: Partial<Room> = {}): Room => ({
  name: 'Test room',
  code: 'ROOM1',
  hostId: 'u1',
  players: new Map([['u1', createPlayer()]]),
  rules: baseRules,
  started: false,
  createdAt: new Date(),
  ...overrides,
});

const createStartContext = (
  overrides: Partial<ValidatedStartContext> = {},
): ValidatedStartContext => ({
  room: createRoom(),
  player: createPlayer(),
  ...overrides,
});

const createGameContext = (
  game: Game,
  overrides: Partial<ValidatedGameContext> = {},
): ValidatedGameContext => ({
  game,
  room: createRoom({ code: game.roomId, started: true }),
  player: createPlayer(),
  ...overrides,
});

type TestClientSocket = Pick<Socket, 'id' | 'data' | 'rooms'>;

describe('GameGateway', () => {
  let gateway: GameGateway;
  let gameService: jest.Mocked<GameService>;
  let botsService: jest.Mocked<BotsService>;
  let toMock: jest.Mock;
  let inMock: jest.Mock;
  let socketsLeaveMock: jest.Mock;
  let emitByTarget: Record<string, jest.Mock>;

  const client: TestClientSocket = {
    id: 'socket-1',
    data: { userId: 'u1' },
    rooms: new Set(['socket-1', 'ROOM1']),
  };

  beforeEach(() => {
    emitByTarget = {};
    toMock = jest.fn((target: string) => {
      if (!emitByTarget[target]) {
        emitByTarget[target] = jest.fn();
      }

      return { emit: emitByTarget[target] };
    });

    inMock = jest.fn();
    socketsLeaveMock = jest.fn();

    gameService = {
      validateStartContext: jest.fn(),
      inicioPartida: jest.fn(),
      cargarPartidaGuardada: jest.fn(),
      validateGameContext: jest.fn(),
      guardarYcerrarPartida: jest.fn(),
      listarPartidasGuardadas: jest.fn(),
      robarCarta: jest.fn(),
      descartarPendiente: jest.fn(),
      verCarta: jest.fn(),
      getGameById: jest.fn(),
      getBotDecisionContext: jest.fn(),
      resolverTimeoutsTurnoActivos: jest.fn().mockReturnValue([]),
      getHabilidadesSinEfectoRestantes: jest.fn().mockReturnValue(0),
      getHabilidadesSinEfectoDiferidasRestantes: jest.fn().mockReturnValue(0),
      calcularRecompensas: jest.fn().mockReturnValue([]),
      aplicarRecompensas: jest.fn(),
      resetRoomAfterGameAndGetState: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<GameService>;

    gameService.getGameById.mockImplementation(() => createGame());

    botsService = {
      decidirAccion: jest.fn(),
    } as unknown as jest.Mocked<BotsService>;

    gateway = new GameGateway(gameService, botsService);
    (gateway as any).server = {
      to: toMock,
      in: inMock.mockReturnValue({ socketsLeave: socketsLeaveMock }),
    };
  });

  it('inicia partida desde cero cuando no llega savedRoomName', async () => {
    const room = createRoom({ code: 'ROOM1', hostId: 'u1', started: false });
    const game = createGame();

    gameService.validateStartContext.mockReturnValue(createStartContext({ room }));
    gameService.inicioPartida.mockReturnValue(game);
    gameService.getGameById.mockReturnValue(game);

    const result = await gateway.iniciarPartida(client as Socket, undefined);

    expect(gameService.validateStartContext).toHaveBeenCalledWith('u1', 'socket-1');
    expect(gameService.inicioPartida).toHaveBeenCalledWith(room);
    expect(gameService.cargarPartidaGuardada).not.toHaveBeenCalled();
    expect(toMock).toHaveBeenCalledWith('ROOM1');
    expect(emitByTarget.ROOM1).toHaveBeenCalledWith(
      'game:inicio-partida',
      expect.objectContaining({
        partidaId: 'G1',
        gameId: 'G1',
        roomId: 'ROOM1',
        loadedFromSave: false,
        jugadores: ['u1', 'u2'],
        estado: expect.objectContaining({
          turn: 0,
          turnoActualUserId: 'u1',
          phase: 'WAIT_DRAW',
          numBarajas: 1,
          cartasRestantes: 0,
          ultimaCartaDescartada: null,
        }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({
      success: true,
      gameId: 'G1',
      roomId: 'ROOM1',
      loadedFromSave: false,
      estado: expect.objectContaining({
        turn: 0,
        turnoActualUserId: 'u1',
        phase: 'WAIT_DRAW',
      }),
    }));
  });

  it('inicia partida cargando guardada cuando llega savedRoomName', async () => {
    const room = createRoom({ code: 'ROOM1', hostId: 'u1', started: false });
    const game = createGame({ gameId: 'SAVE01' });
    const cartaDescarte = createCard(9, 'picas');

    game.estadoGlobal.turn = 1;
    game.estadoGlobal.numBarajas = 2;
    game.estadoGlobal.cartasVigentes = [createCard(4), createCard(5)];
    game.estadoGlobal.cartasDescartadas = [cartaDescarte];
    game.estadoGlobal.habilidadesActivadas = [3, 8];
    game.estadoGlobal.jugadores[0].cartasMano = [
      createCard(1, 'corazones', true),
      createCard(2),
    ];
    game.estadoGlobal.jugadores[0].habilidadesActivadas = [7];
    game.estadoGlobal.jugadores[1].cartasMano = [createCard(6)];

    gameService.validateStartContext.mockReturnValue(createStartContext({ room }));
    gameService.cargarPartidaGuardada.mockResolvedValue(game);
    gameService.getGameById.mockReturnValue(game);

    const result = await gateway.iniciarPartida(client as Socket, {
      savedRoomName: 'Sala Test',
    });

    expect(gameService.cargarPartidaGuardada).toHaveBeenCalledWith(
      'Sala Test',
      'u1',
      'socket-1',
    );
    expect(toMock).toHaveBeenCalledWith('ROOM1');
    expect(emitByTarget.ROOM1).toHaveBeenCalledWith(
      'game:inicio-partida',
      expect.objectContaining({
        partidaId: 'SAVE01',
        gameId: 'SAVE01',
        roomId: 'ROOM1',
        loadedFromSave: true,
        jugadores: ['u1', 'u2'],
        estado: expect.objectContaining({
          turn: 1,
          turnoActualUserId: 'u2',
          phase: 'WAIT_DRAW',
          numBarajas: 2,
          cartasRestantes: 2,
          cartasDescartadas: [cartaDescarte],
          ultimaCartaDescartada: cartaDescarte,
          habilidadesActivadas: [3, 8],
        }),
      }),
    );
    const inicioPayload = emitByTarget.ROOM1.mock.calls.find(
      ([event]) => event === 'game:inicio-partida',
    )?.[1];

    expect(inicioPayload.estado.jugadores[0]).toEqual(
      expect.objectContaining({
        userId: 'u1',
        numCartas: 2,
        cartasProtegidas: [0],
        habilidadesActivadas: [7],
      }),
    );
    expect(inicioPayload.estado.jugadores[1]).toEqual(
      expect.objectContaining({
        userId: 'u2',
        numCartas: 1,
        cartasProtegidas: [],
      }),
    );
    expect(inicioPayload.estado).not.toHaveProperty('cartasVigentes');
    expect(inicioPayload.estado.jugadores[0]).not.toHaveProperty('cartasMano');

    expect(result).toEqual(expect.objectContaining({
      success: true,
      gameId: 'SAVE01',
      roomId: 'ROOM1',
      loadedFromSave: true,
      estado: expect.objectContaining({
        turn: 1,
        turnoActualUserId: 'u2',
        cartasRestantes: 2,
      }),
    }));
  });

  it('permite iniciar partida aunque la sala llegue marcada como iniciada', async () => {
    const room = createRoom({ code: 'ROOM1', hostId: 'u1', started: true });
    const game = createGame();

    gameService.validateStartContext.mockReturnValue(createStartContext({ room }));
    gameService.inicioPartida.mockReturnValue(game);
    gameService.getGameById.mockReturnValue(game);

    const result = await gateway.iniciarPartida(client as Socket, undefined);

    expect(result).toEqual(expect.objectContaining({
      success: true,
      gameId: 'G1',
      roomId: 'ROOM1',
      loadedFromSave: false,
    }));
  });

  it('guardar-y-cerrar emite room:closed y expulsa sockets de la sala', async () => {
    const game = createGame();

    gameService.validateGameContext.mockReturnValue(createGameContext(game));
    gameService.guardarYcerrarPartida.mockResolvedValue({
      gameId: 'G1',
      roomCode: 'ROOM1',
      savedRoomName: 'Sala Test',
    });

    const result = await gateway.guardarYCerrarPartida(client as Socket, { gameId: 'G1' });

    expect(result).toEqual({ success: true, gameId: 'G1', roomCode: 'ROOM1' });
    expect(toMock).toHaveBeenCalledWith('ROOM1');
    expect(emitByTarget.ROOM1).toHaveBeenCalledWith('room:closed', {
      reason: 'Host saved and closed the room',
      roomCode: 'ROOM1',
      savedRoomName: 'Sala Test',
    });
    expect(inMock).toHaveBeenCalledWith('ROOM1');
    expect(socketsLeaveMock).toHaveBeenCalledWith('ROOM1');
  });

  it('listar partidas guardadas devuelve la lista del service', async () => {
    gameService.listarPartidasGuardadas.mockResolvedValue([
      {
        gameId: 'SAVE1',
        creatorId: 'u1',
        roomName: 'Sala Test',
        updatedAt: new Date(),
        players: ['u1', 'u2'],
      },
    ]);

    const result = await gateway.listarPartidasGuardadas(client as Socket);

    expect(result).toEqual({
      success: true,
      partidas: expect.any(Array),
    });
    expect(gameService.listarPartidasGuardadas).toHaveBeenCalledWith('u1');
  });

  it('robarCarta emite decision al jugador y broadcast a sala', () => {
    const game = createGame();
    gameService.validateGameContext.mockReturnValue(createGameContext(game));
    gameService.getGameById.mockReturnValue(game);
    gameService.robarCarta.mockReturnValue({
      cartaRobada: {
        carta: 4,
        palo: 'corazones',
        habilidad: 'ninguna',
        puntos: 4,
        protegida: false,
      },
      reshuffle: { huboRebarajado: false, cantidadCartasMazo: 20 },
    });

    const result = gateway.robarCarta(client as Socket, { gameId: 'G1' });

    expect(result).toEqual({ success: true });
    expect(emitByTarget.ROOM1).toHaveBeenCalledWith(
      'game:carta-robada',
      expect.objectContaining({ partidaId: 'G1' }),
    );
    expect(emitByTarget['socket-1']).toHaveBeenCalledWith(
      'game:decision-requerida',
      expect.objectContaining({
        gameId: 'G1',
        carta: expect.objectContaining({ carta: 4 }),
      }),
    );
  });

  it('robarCarta emite mazo-rebarajado cuando aplica', () => {
    const game = createGame();
    gameService.validateGameContext.mockReturnValue(createGameContext(game));
    gameService.getGameById.mockReturnValue(game);
    gameService.robarCarta.mockReturnValue({
      cartaRobada: {
        carta: 4,
        palo: 'corazones',
        habilidad: 'ninguna',
        puntos: 4,
        protegida: false,
      },
      reshuffle: { huboRebarajado: true, cantidadCartasMazo: 20 },
    });

    gateway.robarCarta(client as Socket, { gameId: 'G1' });

    expect(emitByTarget.ROOM1).toHaveBeenCalledWith(
      'game:mazo-rebarajado',
      expect.objectContaining({ gameId: 'G1' }),
    );
  });

  it('descartarPendiente emite broadcast con la carta descartada', () => {
    const game = createGame();
    const carta: Card = {
      carta: 9,
      palo: 'picas',
      habilidad: 'ninguna',
      puntos: 9,
      protegida: false,
    };

    gameService.validateGameContext.mockReturnValue(createGameContext(game));
    gameService.descartarPendiente.mockReturnValue({
      cartaDescartada: carta,
      resultadoHabilidad: {
        tipo: 'ninguna',
      },
    } as any);

    const result = gateway.descartarPendiente(client as Socket, { gameId: 'G1' });

    expect(result).toEqual({ success: true, gameId: 'G1' });
    expect(emitByTarget.ROOM1).toHaveBeenCalledWith(
      'game:descartar-pendiente',
      expect.objectContaining({ carta }),
    );
  });

  it('verCarta emite cancelacion cuando una proteccion bloquea la accion', () => {
    const game = createGame();
    const error = new AccionProtegidaCanceladaError(
      'visualizar',
      'u1',
      'u2',
      [{ jugadorId: 'u2', indexCarta: 1 }],
    );

    gameService.validateGameContext.mockReturnValue(createGameContext(game));
    gameService.verCarta.mockImplementation(() => {
      throw error;
    });

    const result = gateway.verCarta(client as Socket, {
      gameId: 'G1',
      indexCarta: 0,
      playerId: 'u2',
      indexCartaPlayer: 1,
    });

    expect(result).toEqual({
      success: true,
      gameId: 'G1',
      accionCancelada: true,
    });
    expect(emitByTarget.ROOM1).toHaveBeenCalledWith(
      'game:accion-protegida-cancelada',
      {
        gameId: 'G1',
        accion: 'visualizar',
        actorId: 'u1',
        propietarioId: 'u2',
        proteccionesConsumidas: [{ jugadorId: 'u2', indexCarta: 1 }],
        message: error.message,
      },
    );
  });

  it('procesarTimeoutsTurno emite turno-expirado para partidas afectadas', () => {
    const timedOutGame = createGame();
    gameService.resolverTimeoutsTurnoActivos.mockReturnValue([timedOutGame]);

    (gateway as any).procesarTimeoutsTurno();

    expect(emitByTarget.ROOM1).toHaveBeenCalledWith(
      'game:turno-expirado',
      expect.objectContaining({ gameId: 'G1' }),
    );
  });

  it('lanza WsException si el socket no está unido a la sala esperada', async () => {
    const badClient: TestClientSocket = {
      ...client,
      rooms: new Set(['socket-1']),
    };

    gameService.validateStartContext.mockReturnValue(
      createStartContext({
        room: createRoom({ code: 'ROOM1', hostId: 'u1', started: false }),
      }),
    );

    await expect(
      gateway.iniciarPartida(badClient as Socket, undefined),
    ).rejects.toBeInstanceOf(WsException);
  });

  it('propaga WsException en guardar-y-cerrar cuando falla service', async () => {
    const game = createGame();

    gameService.validateGameContext.mockReturnValue(createGameContext(game));
    gameService.guardarYcerrarPartida.mockRejectedValue(new Error('fallo guardado'));

    await expect(
      gateway.guardarYCerrarPartida(client as Socket, { gameId: 'G1' }),
    ).rejects.toBeInstanceOf(WsException);
  });

  it('flushBotActions ejecuta accion de bot cuando el turno actual es bot', () => {
    const game = createGame();
    game.estadoGlobal.turn = 0;
    game.estadoGlobal.turnoJugadores = ['bot-1', 'u2'];
    game.estadoGlobal.jugadores[0] = {
      cartasMano: [],
      habilidadesActivadas: [],
      saltarTurno: false,
      controlador: 'bot',
      dificultadBot: 'facil',
    } as any;
    game.estadoGlobal.jugadores[1] = {
      cartasMano: [],
      habilidadesActivadas: [],
      saltarTurno: false,
      controlador: 'humano',
    } as any;

    gameService.getGameById.mockReturnValue(game);
    gameService.getBotDecisionContext.mockReturnValue(null);
    gameService.robarCarta.mockReturnValue({
      cartaRobada: {
        carta: 4,
        palo: 'corazones',
        habilidad: 'ninguna',
        puntos: 4,
        protegida: false,
      },
      reshuffle: { huboRebarajado: false, cantidadCartasMazo: 20 },
    });
    botsService.decidirAccion
      .mockReturnValueOnce({ accion: 'robar' } as any)
      .mockReturnValueOnce({ accion: 'esperar' } as any);

    (gateway as any).flushBotActions('G1');

    expect(botsService.decidirAccion).toHaveBeenCalledWith(
      game,
      'bot-1',
      'facil',
      null,
    );
    expect(gameService.robarCarta).toHaveBeenCalledWith(game, 'bot-1');
    expect(emitByTarget.ROOM1).toHaveBeenCalledWith('game:bot-roba-carta', {
      gameId: 'G1',
      botId: 'bot-1',
    });
  });

  it('scheduleBotProcessing agenda un unico flush por partida aunque se invoque varias veces', () => {
    jest.useFakeTimers();

    const game = createGame();
    const flushSpy = jest.spyOn(gateway as any, 'flushBotActions').mockImplementation(() => {});

    (gateway as any).scheduleBotProcessing(game);
    (gateway as any).scheduleBotProcessing(game);
    (gateway as any).scheduleBotProcessing(game);

    jest.runOnlyPendingTimers();

    expect(flushSpy).toHaveBeenCalledTimes(1);

    flushSpy.mockRestore();
    jest.useRealTimers();
  });

  it('integracion bot: encadena turnos bot y se detiene al llegar a humano', () => {
    jest.useFakeTimers();

    const game = createGame();
    game.estadoGlobal.turn = 0;
    game.estadoGlobal.phase = 'WAIT_DRAW';
    game.estadoGlobal.turnoJugadores = ['bot-1', 'bot-2', 'u1'];
    game.estadoGlobal.jugadores = [
      {
        cartasMano: [],
        habilidadesActivadas: [],
        saltarTurno: false,
        controlador: 'bot',
        dificultadBot: 'facil',
      } as any,
      {
        cartasMano: [],
        habilidadesActivadas: [],
        saltarTurno: false,
        controlador: 'bot',
        dificultadBot: 'media',
      } as any,
      {
        cartasMano: [],
        habilidadesActivadas: [],
        saltarTurno: false,
        controlador: 'humano',
      } as any,
    ];

    gameService.getGameById.mockImplementation(() => game);
    gameService.getBotDecisionContext.mockReturnValue(null);

    gameService.robarCarta.mockImplementation((partida: Game) => {
      const idx = partida.estadoGlobal.turn;
      (partida.estadoGlobal.jugadores[idx] as any).cartaPendiente = {
        carta: 4,
        palo: 'corazones',
        habilidad: 'ninguna',
        puntos: 4,
        protegida: false,
      };
      partida.estadoGlobal.phase = 'WAIT_DECISION';
      return {
        cartaRobada: {
          carta: 4,
          palo: 'corazones',
          habilidad: 'ninguna',
          puntos: 4,
          protegida: false,
        },
        reshuffle: { huboRebarajado: false, cantidadCartasMazo: 20 },
      };
    });

    gameService.descartarPendiente.mockImplementation((partida: Game) => {
      const idx = partida.estadoGlobal.turn;
      delete (partida.estadoGlobal.jugadores[idx] as any).cartaPendiente;
      partida.estadoGlobal.phase = 'WAIT_DRAW';
      partida.estadoGlobal.turn =
        (partida.estadoGlobal.turn + 1) % partida.estadoGlobal.turnoJugadores.length;
      return {
        cartaDescartada: {
          carta: 4,
          palo: 'corazones',
          habilidad: 'ninguna',
          puntos: 4,
          protegida: false,
        },
        resultadoHabilidad: { tipo: 'ninguna' },
      } as any;
    });

    botsService.decidirAccion.mockImplementation((partida: Game) => {
      return partida.estadoGlobal.phase === 'WAIT_DRAW'
        ? ({ accion: 'robar' } as any)
        : ({ accion: 'descartar-pendiente' } as any);
    });

    (gateway as any).scheduleBotProcessing(game);

    let guard = 0;
    while (jest.getTimerCount() > 0 && guard < 10) {
      jest.runOnlyPendingTimers();
      guard++;
    }

    expect(guard).toBeGreaterThan(0);
    expect(gameService.robarCarta.mock.calls.map((c) => c[1])).toEqual([
      'bot-1',
      'bot-2',
    ]);
    expect(gameService.descartarPendiente.mock.calls.map((c) => c[1])).toEqual([
      'bot-1',
      'bot-2',
    ]);
    expect(game.estadoGlobal.turn).toBe(2);
    expect(game.estadoGlobal.turnoJugadores[game.estadoGlobal.turn]).toBe('u1');

    jest.useRealTimers();
  });

  it('flushBotActions no ejecuta acciones cuando el turno es de humano', () => {
    const game = createGame();
    game.estadoGlobal.turn = 0;
    game.estadoGlobal.turnoJugadores = ['u1', 'u2'];
    game.estadoGlobal.jugadores[0] = {
      cartasMano: [],
      habilidadesActivadas: [],
      saltarTurno: false,
      controlador: 'humano',
    } as any;

    gameService.getGameById.mockReturnValue(game);

    (gateway as any).flushBotActions('G1');

    expect(botsService.decidirAccion).not.toHaveBeenCalled();
    expect(gameService.robarCarta).not.toHaveBeenCalled();
  });
});
