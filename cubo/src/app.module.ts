import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { FgPasswdModule } from './forgotten_passwd/fg_passwd.module';
import { BotsModule } from './bots/bots.module';
import { RoomsModule } from './rooms/rooms.module';
import { SkinsModule } from './skins/skins.module';
import { GameModule } from './game/game.module';
import { UsersModule } from './users/users.module';
import { VoiceModule } from './voice/voice.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    FgPasswdModule,
    BotsModule,
    RoomsModule,
    GameModule,
    UsersModule,
    SkinsModule,
    VoiceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
