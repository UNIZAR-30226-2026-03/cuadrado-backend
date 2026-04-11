import { Test, TestingModule } from '@nestjs/testing';
import { SkinsController } from './skins.controller';
import { SkinsService } from './skins.service';

describe('SkinsController', () => {
  let controller: SkinsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SkinsController],
      providers: [
        {
          provide: SkinsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<SkinsController>(SkinsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
