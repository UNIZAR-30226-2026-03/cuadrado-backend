import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { fg_passwdService } from './fg_passwd.service';
import { FgPasswdController } from './fg_passwd.controllers';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (ConfigService: ConfigService) => {
        const port = Number(ConfigService.getOrThrow<string>('SMTP_PORT'));
        const smtpUser = ConfigService.getOrThrow<string>('SMTP_USER');
        const smtpFrom = ConfigService.get<string>('SMTP_FROM') || smtpUser;

        return {
          transport: {
            host: ConfigService.getOrThrow<string>('SMTP_HOST'),
            port,
            secure: port === 465,
            auth: {
              user: smtpUser,
              pass: ConfigService.getOrThrow<string>('SMTP_PASS'),
            },
          },
          defaults: {
            from: smtpFrom,
          },
        };
      },
    }),
  ],
  providers: [fg_passwdService],
  exports: [fg_passwdService],
  controllers: [FgPasswdController],
})
export class FgPasswdModule {}
