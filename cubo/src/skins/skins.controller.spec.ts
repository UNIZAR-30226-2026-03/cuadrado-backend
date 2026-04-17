import { Test, TestingModule } from '@nestjs/testing';
import { SkinsController } from './skins.controller';
import { SkinsService } from './skins.service';

describe('SkinsController', () => {
  let controller: SkinsController;
  let skinsService: { getEquippedSkins: jest.Mock };

  beforeEach(async () => {
    skinsService = {
      getEquippedSkins: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SkinsController],
      providers: [
        {
          provide: SkinsService,
          useValue: skinsService,
        },
      ],
    }).compile();

    controller = module.get<SkinsController>(SkinsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getEquippedSkins', () => {
    it('should use username from query when provided', async () => {
      const expected = { avatar: 'a.png', carta: null, tapete: null };
      skinsService.getEquippedSkins.mockResolvedValue(expected);

      const req = { user: { username: 'requestUser' } };
      const result = await controller.getEquippedSkins(req, 'targetUser');

      expect(skinsService.getEquippedSkins).toHaveBeenCalledWith('targetUser');
      expect(result).toEqual(expected);
    });

    it('should fallback to authenticated user when query is missing', async () => {
      const expected = { avatar: null, carta: 'c.png', tapete: null };
      skinsService.getEquippedSkins.mockResolvedValue(expected);

      const req = { user: { username: 'requestUser' } };
      const result = await controller.getEquippedSkins(req, undefined);

      expect(skinsService.getEquippedSkins).toHaveBeenCalledWith('requestUser');
      expect(result).toEqual(expected);
    });

    it('should fallback to authenticated user when query is blank', async () => {
      const expected = { avatar: null, carta: null, tapete: 't.png' };
      skinsService.getEquippedSkins.mockResolvedValue(expected);

      const req = { user: { username: 'requestUser' } };
      const result = await controller.getEquippedSkins(req, '   ');

      expect(skinsService.getEquippedSkins).toHaveBeenCalledWith('requestUser');
      expect(result).toEqual(expected);
    });
  });
});
