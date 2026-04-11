import { Module, forwardRef } from '@nestjs/common';
import { BotsModule } from '../bots/bots.module';
import { GameModule } from '../game/game.module';
import { RoomManager } from './room.manager';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';

@Module({
  imports: [BotsModule, forwardRef(() => GameModule)],
  providers: [
    RoomsGateway,
    RoomsService,
    RoomManager,
  ],
  exports: [RoomsService],
})
export class RoomsModule {}
