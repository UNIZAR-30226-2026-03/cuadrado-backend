import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import {
  GameService,
  ValidatedGameContext,
  ValidatedStartContext,
} from './game.service';
import { GameGateway } from './game.gateway';
import { Game } from './interfaces/game.interface';
import { Card } from './interfaces/card.interface';
import { Player } from '../rooms/interfaces/player.interface';
import { Room } from '../rooms/interfaces/room.interface';
import { RulesConfig } from '../rooms/interfaces/rules-config.interface';

const createGame = (overrides: Partial<Game> = {}): Game => ({
  gameId: 'G1',
  roomId: 'ROOM1',
  estado: 'activo',
  estadoGlobal: {
    turn: 0,
    phase: 'WAIT_DRAW',
    turnDeadlineAt: Date.now() + 30_000,
    cuboActivado: false,
    cuboSolicitanteId: null,
    cuboTurnosRestantes: undefined,
    cartasVigentes: [],
    cartasDescartadas: [],
    habilidadesActivadas: [],
    turnoJugadores: ['u1', 'u2'],
    jugadores: [
      { cartasMano: [], habilidadesActivadas: [], saltarTurno: false },
      { cartasMano: [], habilidadesActivadas: [], saltarTurno: false },
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
};

const createPlayer = (overrides: Partial<Player> = {}): Player => ({
  userId: 'u1',
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
      resolverTimeoutsTurnoActivos: jest.fn().mockReturnValue([]),
      calcularRecompensas: jest.fn().mockReturnValue([]),
      aplicarRecompensas: jest.fn(),
      resetRoomAfterGameAndGetState: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<GameService>;

    gateway = new GameGateway(gameService);
    (gateway as any).server = {
      to: toMock,
      in: inMock.mockReturnValue({ socketsLeave: socketsLeaveMock }),
    };
  });

  it('inicia partida desde cero cuando no llega savedGameId', async () => {
    const room = createRoom({ code: 'ROOM1', hostId: 'u1', started: false });
    const game = createGame();

    gameService.validateStartContext.mockReturnValue(createStartContext({ room }));
    gameService.inicioPartida.mockReturnValue(game);

    const result = await gateway.iniciarPartida(client as Socket, undefined);

    expect(gameService.validateStartContext).toHaveBeenCalledWith('u1', 'socket-1');
    expect(gameService.inicioPartida).toHaveBeenCalledWith(room);
    expect(gameService.cargarPartidaGuardada).not.toHaveBeenCalled();
    expect(toMock).toHaveBeenCalledWith('ROOM1');
    expect(emitByTarget.ROOM1).toHaveBeenCalledWith('game:inicio-partida', {
      partidaId: 'G1',
    });
    expect(result).toEqual({
      success: true,
      gameId: 'G1',
      roomId: 'ROOM1',
      loadedFromSave: false,
    });
  });

  it('inicia partida cargando guardada cuando llega savedGameId', async () => {
    const room = createRoom({ code: 'ROOM1', hostId: 'u1', started: false });
    const game = createGame({ gameId: 'SAVE01' });

    gameService.validateStartContext.mockReturnValue(createStartContext({ room }));
    gameService.cargarPartidaGuardada.mockResolvedValue(game);

    const result = await gateway.iniciarPartida(client as Socket, {
      savedGameId: 'SAVE01',
    });

    expect(gameService.cargarPartidaGuardada).toHaveBeenCalledWith(
      'SAVE01',
      'u1',
      'socket-1',
    );
    expect(toMock).toHaveBeenCalledWith('ROOM1');
    expect(emitByTarget.ROOM1).toHaveBeenCalledWith('game:inicio-partida', {
      partidaId: 'SAVE01',
    });
    expect(result).toEqual({
      success: true,
      gameId: 'SAVE01',
      roomId: 'ROOM1',
      loadedFromSave: true,
    });
  });

  it('devuelve error websocket si la sala ya estaba iniciada', async () => {
    const room = createRoom({ code: 'ROOM1', hostId: 'u1', started: true });
    gameService.validateStartContext.mockReturnValue(createStartContext({ room }));

    await expect(
      gateway.iniciarPartida(client as Socket, undefined),
    ).rejects.toBeInstanceOf(WsException);
  });

  it('guardar-y-cerrar emite room:closed y expulsa sockets de la sala', async () => {
    const game = createGame();

    gameService.validateGameContext.mockReturnValue(createGameContext(game));
    gameService.guardarYcerrarPartida.mockResolvedValue({
      gameId: 'G1',
      roomCode: 'ROOM1',
    });

    const result = await gateway.guardarYCerrarPartida(client as Socket, { gameId: 'G1' });

    expect(result).toEqual({ success: true, gameId: 'G1', roomCode: 'ROOM1' });
    expect(toMock).toHaveBeenCalledWith('ROOM1');
    expect(emitByTarget.ROOM1).toHaveBeenCalledWith('room:closed', {
      reason: 'Host saved and closed the room',
      roomCode: 'ROOM1',
      savedGameId: 'G1',
    });
    expect(inMock).toHaveBeenCalledWith('ROOM1');
    expect(socketsLeaveMock).toHaveBeenCalledWith('ROOM1');
  });

  it('listar partidas guardadas devuelve la lista del service', async () => {
    gameService.listarPartidasGuardadas.mockResolvedValue([
      {
        gameId: 'SAVE1',
        creatorId: 'u1',
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
    expect(emitByTarget['socket-1']).toHaveBeenCalledWith('game:decision-requerida', {
      gameId: 'G1',
    });
  });

  it('robarCarta emite mazo-rebarajado cuando aplica', () => {
    const game = createGame();
    gameService.validateGameContext.mockReturnValue(createGameContext(game));
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
});
