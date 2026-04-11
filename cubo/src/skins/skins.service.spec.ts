import { Test, TestingModule } from '@nestjs/testing';
import { SkinsService } from './skins.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SkinsService', () => {
  let service: SkinsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkinsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SkinsService>(SkinsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
