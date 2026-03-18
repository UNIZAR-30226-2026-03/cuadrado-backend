import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameManager } from './game.manager';
import { GameService } from './game.service';

@Module({
  providers: [
    GameGateway,
    GameService,
    {
      provide: GameManager,
      useFactory: () => new GameManager(),
    },
  ],
  exports: [GameService],
})
export class GameModule {}
