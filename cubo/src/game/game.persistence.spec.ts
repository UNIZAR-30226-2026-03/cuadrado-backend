import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GameManager } from './game.manager';
import { GameService } from './game.service';
import { RoomsService } from '../rooms/rooms.service';
import { RoomManager } from '../rooms/room.manager';
import { BotsService } from '../bots/bots.service';
import { AVAILABLE_POWERS } from '../rooms/interfaces/rules-config.interface';

const cardKey = (card: { carta: number; palo: string; protegida?: boolean }) =>
  `${card.palo}:${card.carta}:${card.protegida ? 1 : 0}`;

const makeUser = (username: string) => ({
  username,
  email: `${username}@example.com`,
  passwordHash: 'hash',
  cubitos: 0,
  eloRating: 1000,
  gamesPlayed: 0,
  gamesWon: 0,
  numPlayersPlayed: 0,
  numPlayersWon: 0,
  settings: null,
  auth_code: null,
  creationTime: null,
  expirationTime: null,
  equippedAvatarId: null,
  equippedCardId: null,
  equippedTapeteId: null,
});

const makeBaseRules = (fillWithBots = false) => ({
  maxPlayers: 4,
  turnTimeSeconds: 30,
  isPrivate: false,
  fillWithBots,
  deckCount: 2 as const,
  enabledPowers: [...AVAILABLE_POWERS],
});

const createGameHarness = () => {
  const botsService = {
    agregarBotsARoom: jest.fn(),
  } as unknown as BotsService;

  const roomManager = new RoomManager(botsService);
  const roomsService = new RoomsService(roomManager);
  const gameManager = new GameManager();
  const configService = new ConfigService();
  const prisma = new PrismaService(configService);

  const gameService = new GameService(gameManager, roomsService, prisma);

  return {
    botsService,
    roomManager,
    roomsService,
    gameManager,
    prisma,
    gameService,
  };
};

describe('GameService persistence integration', () => {
  let prisma: PrismaService;
  let roomsService: RoomsService;
  let gameService: GameService;

  beforeAll(async () => {
    const harness = createGameHarness();
    prisma = harness.prisma;
    roomsService = harness.roomsService;
    gameService = harness.gameService;

    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await (prisma as any).pool?.end?.();
  });

  beforeEach(async () => {
    await prisma.pausedGamePlayer.deleteMany();
    await prisma.gameState.deleteMany();
    await prisma.user.deleteMany({
      where: {
        username: { in: ['host-a', 'player-a', 'host-b', 'player-b'] },
      },
    });
  });

  afterEach(async () => {
    await prisma.pausedGamePlayer.deleteMany();
    await prisma.gameState.deleteMany();
    await prisma.user.deleteMany({
      where: {
        username: { in: ['host-a', 'player-a', 'host-b', 'player-b'] },
      },
    });
  });

  it('persiste y recupera una partida sin bots', async () => {
    await prisma.user.createMany({
      data: [makeUser('host-a'), makeUser('player-a')],
    });

    const room = roomsService.createRoom('host-a', 'socket-host-a', {
      name: 'Sala sin bots',
      rules: makeBaseRules(false),
    });

    roomsService.joinRoom('player-a', 'socket-player-a', room.code);

    const game = gameService.inicioPartida(room);
    game.estadoGlobal.turn = 1;
    game.estadoGlobal.habilidadesActivadas = [3];
    game.estadoGlobal.cartasDescartadas.push(game.estadoGlobal.cartasVigentes.pop()!);

    const saveResult = await gameService.guardarYcerrarPartida(game, 'host-a');

    const snapshots = await prisma.gameState.findMany({
      where: { creatorId: 'host-a', roomName: 'Sala sin bots' },
      include: { pausedGamePlayers: true },
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].roomName).toBe('Sala sin bots');
    expect(snapshots[0].pausedGamePlayers).toHaveLength(2);
    expect(saveResult.savedRoomName).toBe('Sala sin bots');

    const reloadedRoom = roomsService.createRoom('host-a', 'socket-host-a-2', {
      name: 'Sala sin bots',
      rules: makeBaseRules(false),
    });

    roomsService.joinRoom('player-a', 'socket-player-a-2', reloadedRoom.code);

    const loaded = await gameService.cargarPartidaGuardada(
      'Sala sin bots',
      'host-a',
      'socket-host-a-2',
    );

    expect(loaded.gameId).toBeDefined();
    expect(loaded.gameId).not.toBe(game.gameId);
    expect(loaded.estado).toBe('activo');
    expect(loaded.estadoGlobal.turn).toBe(1);
    expect(loaded.estadoGlobal.habilidadesActivadas).toContain(3);
    expect(loaded.estadoGlobal.jugadores).toHaveLength(2);
    expect(roomsService.getRoomByUserId('host-a')?.started).toBe(true);
  });

  it('persiste y recupera bots con la misma dificultad y nombre', async () => {
    await prisma.user.createMany({
      data: [makeUser('host-b')],
    });

    const room = roomsService.createRoom('host-b', 'socket-host-b', {
      name: 'Sala con bots',
      rules: makeBaseRules(false),
    });

    room.players.set('player-b', {
      userId: 'player-b',
      controlador: 'humano',
      idInRoom: 1,
      socketId: 'socket-player-b',
      isHost: false,
      joinedAt: new Date(),
      connected: true,
    });
    room.players.set('bot-alpha', {
      userId: 'bot-alpha',
      controlador: 'bot',
      dificultadBot: 'media',
      nombreEnPartida: 'bot2',
      idInRoom: 2,
      socketId: '',
      isHost: false,
      joinedAt: new Date(),
      connected: true,
    });
    room.players.set('bot-beta', {
      userId: 'bot-beta',
      controlador: 'bot',
      dificultadBot: 'media',
      nombreEnPartida: 'bot3',
      idInRoom: 3,
      socketId: '',
      isHost: false,
      joinedAt: new Date(),
      connected: true,
    });

    const game = gameService.inicioPartida(room);

    const saveResult = await gameService.guardarYcerrarPartida(game, 'host-b');

    const snapshot = await prisma.gameState.findUnique({
      where: {
        creatorId_roomName: {
          creatorId: 'host-b',
          roomName: 'Sala con bots',
        },
      },
      include: { pausedGamePlayers: true },
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.pausedGamePlayers).toHaveLength(4);
    expect(snapshot?.pausedGamePlayers.filter((player) => player.controlador === 'bot')).toHaveLength(2);
    expect(saveResult.savedRoomName).toBe('Sala con bots');

    const reloadedRoom = roomsService.createRoom('host-b', 'socket-host-b-2', {
      name: 'Sala con bots',
      rules: makeBaseRules(false),
    });

    reloadedRoom.players.set('player-b', {
      userId: 'player-b',
      controlador: 'humano',
      idInRoom: 1,
      socketId: 'socket-player-b-2',
      isHost: false,
      joinedAt: new Date(),
      connected: true,
    });

    const loaded = await gameService.cargarPartidaGuardada(
      'Sala con bots',
      'host-b',
      'socket-host-b-2',
    );

    const loadedBotPlayers = loaded.estadoGlobal.jugadores.filter(
      (player) => player.controlador === 'bot',
    );

    expect(loadedBotPlayers).toHaveLength(2);
    expect(loadedBotPlayers.every((player) => player.dificultadBot === 'media')).toBe(true);
    expect(loadedBotPlayers.map((player) => player.nombreEnPartida)).toEqual(['bot2', 'bot3']);
    expect(roomsService.getRoomByUserId('host-b')?.players.size).toBe(4);
  });

  it('sobrescribe la snapshot más reciente por roomName del mismo creador', async () => {
    await prisma.user.createMany({
      data: [makeUser('host-a')],
    });

    const createFreshServices = () => {
      const freshBotsService = {
        agregarBotsARoom: jest.fn(),
      } as unknown as BotsService;

      const freshRoomManager = new RoomManager(freshBotsService);
      const freshRoomsService = new RoomsService(freshRoomManager);
      const freshGameService = new GameService(
        new GameManager(),
        freshRoomsService,
        prisma,
      );

      return { freshRoomsService, freshGameService };
    };

    const firstHarness = createFreshServices();
    const roomA = firstHarness.freshRoomsService.createRoom('host-a', 'socket-host-a', {
      name: 'Sala repetida',
      rules: makeBaseRules(false),
    });
    const gameA = firstHarness.freshGameService.inicioPartida(roomA);
    gameA.estadoGlobal.turn = 0;
    await firstHarness.freshGameService.guardarYcerrarPartida(gameA, 'host-a');

    const firstSnapshot = await prisma.gameState.findUnique({
      where: {
        creatorId_roomName: {
          creatorId: 'host-a',
          roomName: 'Sala repetida',
        },
      },
    });

    expect(firstSnapshot).not.toBeNull();
    const firstId = firstSnapshot!.id;

    const secondHarness = createFreshServices();
    const roomB = secondHarness.freshRoomsService.createRoom('host-a', 'socket-host-a-2', {
      name: 'Sala repetida',
      rules: makeBaseRules(false),
    });
    const gameB = secondHarness.freshGameService.inicioPartida(roomB);
    gameB.estadoGlobal.turn = 1;
    gameB.estadoGlobal.habilidadesActivadas = [8];
    await secondHarness.freshGameService.guardarYcerrarPartida(gameB, 'host-a');

    const secondSnapshot = await prisma.gameState.findUnique({
      where: {
        creatorId_roomName: {
          creatorId: 'host-a',
          roomName: 'Sala repetida',
        },
      },
    });

    expect(secondSnapshot).not.toBeNull();
    expect(secondSnapshot!.id).toBe(firstId);
    expect(secondSnapshot!.turn).toBe(1);
    expect(secondSnapshot!.habilidadesActivadas).toEqual([8]);
  });

  it('carga reglas nuevas (deckCount y enabledPowers) al restaurar sala y partida', async () => {
    await prisma.user.createMany({
      data: [makeUser('host-a'), makeUser('player-a')],
    });

    const freshBotsService = {
      agregarBotsARoom: jest.fn(),
    } as unknown as BotsService;
    const freshRoomManager = new RoomManager(freshBotsService);
    const freshRoomsService = new RoomsService(freshRoomManager);
    const freshGameService = new GameService(
      new GameManager(),
      freshRoomsService,
      prisma,
    );

    const reglasPersonalizadas = {
      maxPlayers: 4,
      turnTimeSeconds: 20,
      isPrivate: false,
      fillWithBots: false,
      deckCount: 2 as const,
      enabledPowers: [1, 2, 10],
    };

    const room = freshRoomsService.createRoom('host-a', 'socket-host-a', {
      name: 'Sala reglas nuevas',
      rules: reglasPersonalizadas,
    });

    freshRoomsService.joinRoom('player-a', 'socket-player-a', room.code);

    const game = freshGameService.inicioPartida(room);
    expect(game.estadoGlobal.numBarajas).toBe(2);
    expect(game.estadoGlobal.habilidadesActivadas).toEqual([1, 2, 10]);

    await freshGameService.guardarYcerrarPartida(game, 'host-a');

    const reloadedRoom = freshRoomsService.createRoom('host-a', 'socket-host-a-2', {
      name: 'Sala reglas nuevas',
      rules: makeBaseRules(false),
    });

    freshRoomsService.joinRoom('player-a', 'socket-player-a-2', reloadedRoom.code);

    const loaded = await freshGameService.cargarPartidaGuardada(
      'Sala reglas nuevas',
      'host-a',
      'socket-host-a-2',
    );

    const hostRoom = freshRoomsService.getRoomByUserId('host-a');
    expect(hostRoom).not.toBeNull();
    expect(hostRoom!.rules.deckCount).toBe(2);
    expect(hostRoom!.rules.enabledPowers).toEqual([1, 2, 10]);
    expect(loaded.estadoGlobal.numBarajas).toBe(2);
    expect(loaded.estadoGlobal.habilidadesActivadas).toEqual([1, 2, 10]);

    const originalDiscarded = game.estadoGlobal.cartasDescartadas.map(cardKey).sort();
    const loadedDiscarded = loaded.estadoGlobal.cartasDescartadas.map(cardKey).sort();
    const originalDeck = game.estadoGlobal.cartasVigentes.map(cardKey).sort();
    const loadedDeck = loaded.estadoGlobal.cartasVigentes.map(cardKey).sort();

    expect(loadedDiscarded).toEqual(originalDiscarded);
    expect(loadedDeck).toEqual(originalDeck);
  });
});