import { BotsService } from './bots.service';
import { BotStrategy } from './interfaces/bot-strategy.interface';
import { Room } from '../rooms/interfaces/room.interface';

const createRoom = (overrides: Partial<Room> = {}): Room => ({
  name: 'Room bots',
  code: 'ROOM-BOT',
  hostId: 'u1',
  players: new Map(),
  rules: {
    maxPlayers: 4,
    turnTimeSeconds: 30,
    isPrivate: false,
    fillWithBots: true,
    dificultadBots: 'media',
  },
  started: false,
  createdAt: new Date(),
  ...overrides,
});

describe('BotsService', () => {
  let easyStrategy: jest.Mocked<BotStrategy>;
  let mediumStrategy: jest.Mocked<BotStrategy>;
  let hardStrategy: jest.Mocked<BotStrategy>;
  let service: BotsService;

  beforeEach(() => {
    easyStrategy = { decidir: jest.fn() };
    mediumStrategy = { decidir: jest.fn() };
    hardStrategy = { decidir: jest.fn() };

    service = new BotsService(
      easyStrategy as unknown as BotStrategy,
      mediumStrategy as unknown as BotStrategy,
      hardStrategy as unknown as BotStrategy,
    );
  });

  it('usa la estrategia de dificultad correcta', () => {
    const partida = {} as any;
    easyStrategy.decidir.mockReturnValue({ accion: 'esperar' });
    mediumStrategy.decidir.mockReturnValue({ accion: 'robar' });
    hardStrategy.decidir.mockReturnValue({ accion: 'descartar-pendiente' });

    service.decidirAccion(partida, 'bot-1', 'facil', null);
    service.decidirAccion(partida, 'bot-1', 'media', null);
    service.decidirAccion(partida, 'bot-1', 'dificil', null);

    expect(easyStrategy.decidir).toHaveBeenCalledTimes(1);
    expect(mediumStrategy.decidir).toHaveBeenCalledTimes(1);
    expect(hardStrategy.decidir).toHaveBeenCalledTimes(1);
  });

  it('devuelve fallback seguro si la estrategia lanza error', () => {
    const partida = {} as any;
    easyStrategy.decidir.mockImplementation(() => {
      throw new Error('strategy boom');
    });

    const accion = service.decidirAccion(partida, 'bot-1', 'facil', null);

    expect(accion).toEqual({ accion: 'descartar-pendiente' });
  });

  it('agrega bots para completar el maximo de jugadores cuando fillWithBots esta activo', () => {
    const room = createRoom();
    room.players.set('u1', {
      userId: 'u1',
      idInRoom: 0,
      socketId: 'socket-1',
      isHost: true,
      joinedAt: new Date(),
      connected: true,
      controlador: 'humano',
    });

    service.agregarBotsARoom(room, 'media');

    expect(room.players.size).toBe(4);
    const bots = Array.from(room.players.values()).filter(
      (p) => p.controlador === 'bot',
    );
    expect(bots).toHaveLength(3);
    for (const bot of bots) {
      expect(bot.dificultadBot).toBe('media');
      expect(bot.connected).toBe(true);
      expect(bot.socketId).toBe('');
    }
  });

  it('no agrega bots cuando fillWithBots esta desactivado', () => {
    const room = createRoom({
      rules: {
        maxPlayers: 4,
        turnTimeSeconds: 30,
        isPrivate: false,
        fillWithBots: false,
        dificultadBots: 'media',
      },
    });

    room.players.set('u1', {
      userId: 'u1',
      idInRoom: 0,
      socketId: 'socket-1',
      isHost: true,
      joinedAt: new Date(),
      connected: true,
      controlador: 'humano',
    });

    service.agregarBotsARoom(room, 'facil');

    expect(room.players.size).toBe(1);
  });
});
