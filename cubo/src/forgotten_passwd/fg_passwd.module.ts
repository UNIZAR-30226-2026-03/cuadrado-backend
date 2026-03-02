import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { fg_passwdService } from './fg_passwd.service'

@Module({
    imports: [
        MailerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (ConfigService: ConfigService) => {
                const port = Number(ConfigService.getOrThrow<string>
                    ('SMTP_PORT'));
                    
                return{
                transport: {
                    host: ConfigService.getOrThrow<string>('SMTP_HOST'),
                    port,
                    secure: port === 465,
                    auth: {
                        user: ConfigService.getOrThrow<string>('SMTP_USER'),
                        pass: ConfigService.getOrThrow<string>('SMTP_PASS'),
                    },
                },
                defaults: {
                    from: ConfigService.getOrThrow<string>('SMTP_FROM'),
                },
            };
        },
    }),
    ],
    providers: [fg_passwdService],
    exports: [fg_passwdService],
    })
    export class FgPasswdModule {}
