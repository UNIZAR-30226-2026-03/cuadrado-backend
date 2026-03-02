import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { FgPasswdModule } from './forgotten_passwd/fg_passwd.module';

@Module({
  imports: [AppConfigModule, PrismaModule, AuthModule, FgPasswdModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}