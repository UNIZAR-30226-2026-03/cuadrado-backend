import { Module } from '@nestjs/common';
import { RoomManager } from './room.manager';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';

@Module({
  providers: [
    RoomsGateway,
    RoomsService,
    {
      provide: RoomManager,
      useFactory: () => new RoomManager(),
    },
  ],
  exports: [RoomsService],
})
export class RoomsModule {}
