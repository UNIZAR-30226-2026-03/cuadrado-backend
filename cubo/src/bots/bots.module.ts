import { Module } from '@nestjs/common';
import { BotsService } from './bots.service';
import { EasyBotStrategy } from './strategies/easy.strategy';
import { MediumBotStrategy } from './strategies/medium.strategy';
import { HardBotStrategy } from './strategies/hard.strategy';

@Module({
  providers: [
    BotsService,
    {
      provide: 'BOT_EASY',
      useClass: EasyBotStrategy,
    },
    {
      provide: 'BOT_MEDIUM',
      useClass: MediumBotStrategy,
    },
    {
      provide: 'BOT_HARD',
      useClass: HardBotStrategy,
    },
  ],
  exports: [BotsService],
})
export class BotsModule {}
