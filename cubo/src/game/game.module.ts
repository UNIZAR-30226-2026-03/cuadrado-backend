import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameManager } from './game.manager';
import { GameService } from './game.service';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [RoomsModule],
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
