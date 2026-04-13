import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersModule', () => {
  let service: UsersService;
  let controller: UsersController;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    controller = module.get<UsersController>(UsersController);
  });

  describe('UsersService', () => {
    describe('getMyProfile', () => {
      it('should return user profile with all fields', async () => {
        const mockUser = {
          username: 'testuser',
          email: 'test@example.com',
          cubitos: 100,
          eloRating: 1500,
          gamesPlayed: 10,
          gamesWon: 6,
          numPlayersPlayed: 40,
          numPlayersWon: 24,
          settings: { theme: 'dark' },
          equippedAvatarId: 'avatar_1',
          equippedCardId: 'card_1',
          equippedTapeteId: 'tapete_1',
        };

        prismaMock.user.findUnique.mockResolvedValue(mockUser);

        const result = await service.getMyProfile('testuser');

        expect(result).toEqual({
          username: 'testuser',
          email: 'test@example.com',
          cubitos: 100,
          eloRating: 1500,
          gamesPlayed: 10,
          gamesWon: 6,
          numPlayersPlayed: 40,
          numPlayersWon: 24,
          settings: { theme: 'dark' },
          equipado: {
            avatar: 'avatar_1',
            card: 'card_1',
            tapete: 'tapete_1',
          },
        });
      });

      it('should throw NotFoundException when user not found', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        await expect(service.getMyProfile('nonexistent')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should handle users with null settings', async () => {
        const mockUser = {
          username: 'testuser',
          email: 'test@example.com',
          cubitos: 0,
          eloRating: 1200,
          gamesPlayed: 0,
          gamesWon: 0,
          numPlayersPlayed: 0,
          numPlayersWon: 0,
          settings: null,
          equippedAvatarId: null,
          equippedCardId: null,
          equippedTapeteId: null,
        };

        prismaMock.user.findUnique.mockResolvedValue(mockUser);

        const result = await service.getMyProfile('testuser');

        expect(result.settings).toBeNull();
        expect(result.equipado).toEqual({
          avatar: null,
          card: null,
          tapete: null,
        });
      });
    });

    describe('getEloPosition', () => {
      it('should return correct position for user', async () => {
        const mockUser = {
          username: 'testuser',
          eloRating: 1500,
        };

        prismaMock.user.findUnique.mockResolvedValue(mockUser);
        prismaMock.user.count.mockResolvedValue(5);

        const result = await service.getEloPosition('testuser');

        expect(result).toEqual({
          username: 'testuser',
          eloRating: 1500,
          position: 6,
        });
      });

      it('should return position 1 for top player', async () => {
        const mockUser = {
          username: 'topplayer',
          eloRating: 2000,
        };

        prismaMock.user.findUnique.mockResolvedValue(mockUser);
        prismaMock.user.count.mockResolvedValue(0);

        const result = await service.getEloPosition('topplayer');

        expect(result.position).toBe(1);
      });

      it('should throw NotFoundException when user not found', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        await expect(service.getEloPosition('nonexistent')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('getTopUsers', () => {
      it('should return top users ordered by elo', async () => {
        const mockUsers = [
          { username: 'player1', eloRating: 2000 },
          { username: 'player2', eloRating: 1900 },
          { username: 'player3', eloRating: 1900 },
          { username: 'player4', eloRating: 1800 },
        ];

        prismaMock.user.findMany.mockResolvedValue(mockUsers);

        const result = await service.getTopUsers(10);

        expect(result).toEqual([
          { position: 1, username: 'player1', eloRating: 2000 },
          { position: 2, username: 'player2', eloRating: 1900 },
          { position: 2, username: 'player3', eloRating: 1900 },
          { position: 4, username: 'player4', eloRating: 1800 },
        ]);
      });

      it('should handle ties correctly', async () => {
        const mockUsers = [
          { username: 'a', eloRating: 1500 },
          { username: 'b', eloRating: 1500 },
          { username: 'c', eloRating: 1500 },
          { username: 'd', eloRating: 1400 },
        ];

        prismaMock.user.findMany.mockResolvedValue(mockUsers);

        const result = await service.getTopUsers(10);

        expect(result[0].position).toBe(1);
        expect(result[1].position).toBe(1);
        expect(result[2].position).toBe(1);
        expect(result[3].position).toBe(4);
      });

      it('should respect limit parameter', async () => {
        prismaMock.user.findMany.mockResolvedValue([]);

        await service.getTopUsers(25);

        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
          select: expect.any(Object),
          orderBy: expect.any(Array),
          take: 25,
        });
      });

      it('should cap limit at 101', async () => {
        prismaMock.user.findMany.mockResolvedValue([]);

        await service.getTopUsers(500);

        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
          select: expect.any(Object),
          orderBy: expect.any(Array),
          take: 101,
        });
      });

      it('should enforce minimum limit of 1', async () => {
        prismaMock.user.findMany.mockResolvedValue([]);

        await service.getTopUsers(0);

        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
          select: expect.any(Object),
          orderBy: expect.any(Array),
          take: 1,
        });
      });
    });

    describe('getMySettings', () => {
      it('should return user settings when they exist', async () => {
        const mockSettings = {
          voiceChatVolume: 75,
          gameMusicVolume: 60,
          soundEffectsVolume: 80,
        };

        prismaMock.user.findUnique.mockResolvedValue({
          settings: mockSettings,
        });

        const result = await service.getMySettings('testuser');

        expect(result).toEqual(mockSettings);
        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
          where: { username: 'testuser' },
          select: { settings: true },
        });
      });

      it('should return default settings when none exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
          settings: null,
        });

        const result = await service.getMySettings('testuser');

        expect(result).toEqual({
          voiceChatVolume: 50,
          gameMusicVolume: 50,
          soundEffectsVolume: 50,
        });
      });

      it('should throw NotFoundException when user not found', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        await expect(service.getMySettings('nonexistent')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('updateMySettings', () => {
      it('should update all settings successfully', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
          settings: {
            voiceChatVolume: 50,
            gameMusicVolume: 50,
            soundEffectsVolume: 50,
          },
        });

        prismaMock.user.update.mockResolvedValue({
          settings: {
            voiceChatVolume: 75,
            gameMusicVolume: 60,
            soundEffectsVolume: 80,
          },
        });

        const result = await service.updateMySettings('testuser', {
          voiceChatVolume: 75,
          gameMusicVolume: 60,
          soundEffectsVolume: 80,
        });

        expect(result).toEqual({
          voiceChatVolume: 75,
          gameMusicVolume: 60,
          soundEffectsVolume: 80,
        });

        expect(prismaMock.user.update).toHaveBeenCalledWith({
          where: { username: 'testuser' },
          data: {
            settings: {
              voiceChatVolume: 75,
              gameMusicVolume: 60,
              soundEffectsVolume: 80,
            },
          },
          select: { settings: true },
        });
      });

      it('should update partial settings and keep existing ones', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
          settings: {
            voiceChatVolume: 50,
            gameMusicVolume: 50,
            soundEffectsVolume: 50,
          },
        });

        prismaMock.user.update.mockResolvedValue({
          settings: {
            voiceChatVolume: 75,
            gameMusicVolume: 50,
            soundEffectsVolume: 50,
          },
        });

        const result = await service.updateMySettings('testuser', {
          voiceChatVolume: 75,
        });

        expect(prismaMock.user.update).toHaveBeenCalledWith({
          where: { username: 'testuser' },
          data: {
            settings: {
              voiceChatVolume: 75,
              gameMusicVolume: 50,
              soundEffectsVolume: 50,
            },
          },
          select: { settings: true },
        });
      });

      it('should use default settings if user has no settings', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
          settings: null,
        });

        prismaMock.user.update.mockResolvedValue({
          settings: {
            voiceChatVolume: 75,
            gameMusicVolume: 50,
            soundEffectsVolume: 50,
          },
        });

        const result = await service.updateMySettings('testuser', {
          voiceChatVolume: 75,
        });

        expect(prismaMock.user.update).toHaveBeenCalledWith({
          where: { username: 'testuser' },
          data: {
            settings: {
              voiceChatVolume: 75,
              gameMusicVolume: 50,
              soundEffectsVolume: 50,
            },
          },
          select: { settings: true },
        });
      });

      it('should throw BadRequestException for voiceChatVolume out of range', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
          settings: {
            voiceChatVolume: 50,
            gameMusicVolume: 50,
            soundEffectsVolume: 50,
          },
        });

        await expect(
          service.updateMySettings('testuser', {
            voiceChatVolume: 150,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for negative volume values', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
          settings: {
            voiceChatVolume: 50,
            gameMusicVolume: 50,
            soundEffectsVolume: 50,
          },
        });

        await expect(
          service.updateMySettings('testuser', {
            gameMusicVolume: -10,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw NotFoundException when user not found', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        await expect(
          service.updateMySettings('nonexistent', {
            voiceChatVolume: 50,
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('UsersController', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    describe('getMe', () => {
      it('should call getMyProfile with username from JWT', async () => {
        const mockProfile = {
          username: 'testuser',
          email: 'test@example.com',
          cubitos: 100,
          eloRating: 1500,
        };

        jest.spyOn(service, 'getMyProfile').mockResolvedValue(mockProfile);

        const req = { user: { username: 'testuser' } };
        const result = await controller.getMe(req);

        expect(service.getMyProfile).toHaveBeenCalledWith('testuser');
        expect(result).toEqual(mockProfile);
      });
    });

    describe('getMyPosition', () => {
      it('should call getEloPosition with username from JWT', async () => {
        const mockPosition = {
          username: 'testuser',
          eloRating: 1500,
          position: 5,
        };

        jest.spyOn(service, 'getEloPosition').mockResolvedValue(mockPosition);

        const req = { user: { username: 'testuser' } };
        const result = await controller.getMyPosition(req);

        expect(service.getEloPosition).toHaveBeenCalledWith('testuser');
        expect(result).toEqual(mockPosition);
      });
    });

    describe('getTopUsers', () => {
      it('should use default limit of 20 when not provided', async () => {
        const mockLeaderboard = [
          { position: 1, username: 'player1', eloRating: 2000 },
        ];

        jest.spyOn(service, 'getTopUsers').mockResolvedValue(mockLeaderboard);

        const result = await controller.getTopUsers(undefined);

        expect(service.getTopUsers).toHaveBeenCalledWith(20);
        expect(result).toEqual(mockLeaderboard);
      });

      it('should parse and use provided limit', async () => {
        const mockLeaderboard = [];
        jest.spyOn(service, 'getTopUsers').mockResolvedValue(mockLeaderboard);

        await controller.getTopUsers('50');

        expect(service.getTopUsers).toHaveBeenCalledWith(50);
      });

      it('should use default limit when provided limit is invalid', async () => {
        jest.spyOn(service, 'getTopUsers').mockResolvedValue([]);

        await controller.getTopUsers('invalid');

        expect(service.getTopUsers).toHaveBeenCalledWith(20);
      });
    });

    describe('getMySettings', () => {
      it('should call getMySettings with username from JWT', async () => {
        const mockSettings = {
          voiceChatVolume: 75,
          gameMusicVolume: 60,
          soundEffectsVolume: 80,
        };

        jest.spyOn(service, 'getMySettings').mockResolvedValue(mockSettings);

        const req = { user: { username: 'testuser' } };
        const result = await controller.getMySettings(req);

        expect(service.getMySettings).toHaveBeenCalledWith('testuser');
        expect(result).toEqual(mockSettings);
      });
    });

    describe('updateMySettings', () => {
      it('should call updateMySettings with username and DTO from JWT', async () => {
        const updateDto = { voiceChatVolume: 75 };
        const mockSettings = {
          voiceChatVolume: 75,
          gameMusicVolume: 50,
          soundEffectsVolume: 50,
        };

        jest
          .spyOn(service, 'updateMySettings')
          .mockResolvedValue(mockSettings);

        const req = { user: { username: 'testuser' } };
        const result = await controller.updateMySettings(req, updateDto);

        expect(service.updateMySettings).toHaveBeenCalledWith(
          'testuser',
          updateDto,
        );
        expect(result).toEqual(mockSettings);
      });
    });
  });
});