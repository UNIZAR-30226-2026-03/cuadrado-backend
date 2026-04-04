import { RoomManager } from './room.manager';

//TESTS DEL MODULO ROOMS

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  it('returns only public rooms that have not started', () => {
    const publicRoom = roomManager.createRoom('user-1', 'socket-1', {
      name: 'Public Room',
      rules: {
        maxPlayers: 4,
        turnTimeSeconds: 30,
        isPrivate: false,
        fillWithBots: false,
      },
    });

    roomManager.joinRoom('user-2', 'socket-2', publicRoom.code);

    const startedPublicRoom = roomManager.createRoom('user-4', 'socket-4', {
      name: 'Started Public Room',
      rules: {
        maxPlayers: 4,
        turnTimeSeconds: 30,
        isPrivate: false,
        fillWithBots: false,
      },
    });

    roomManager.joinRoom('user-5', 'socket-5', startedPublicRoom.code);
    roomManager.startRoom('user-4', startedPublicRoom.code);

    roomManager.createRoom('user-3', 'socket-3', {
      name: 'Private Room',
      rules: {
        maxPlayers: 4,
        turnTimeSeconds: 30,
        isPrivate: true,
        fillWithBots: false,
      },
    });

    expect(roomManager.getPublicRooms()).toEqual([
      {
        name: 'Public Room',
        code: publicRoom.code,
        playersCount: 2,
        rules: {
          maxPlayers: 4,
          turnTimeSeconds: 30,
          isPrivate: false,
          fillWithBots: false,
        },
        createdAt: publicRoom.createdAt,
      },
    ]);
  });
});