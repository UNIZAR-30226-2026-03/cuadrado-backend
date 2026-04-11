import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameManager } from './game.manager';
import { GameService } from './game.service';
import { RoomsModule } from '../rooms/rooms.module';
import { BotsModule } from '../bots/bots.module';

@Module({
  imports: [RoomsModule, BotsModule],
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
