import { Module } from '@nestjs/common';
import { BotsModule } from '../bots/bots.module';
import { RoomManager } from './room.manager';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';

@Module({
  imports: [BotsModule],
  providers: [
    RoomsGateway,
    RoomsService,
    RoomManager,
  ],
  exports: [RoomsService],
})
export class RoomsModule {}
