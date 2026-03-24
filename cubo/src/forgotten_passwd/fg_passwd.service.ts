import { Injectable, Logger, UnauthorizedException, InternalServerErrorException } from 
    "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { forgotten_passwdDto } from "./dto/fg_passwd.dto";
import { codeAuthDto } from "./dto/codeAuth.dto";
import { resetPasswordDto } from "./dto/reset-password.dto";
import { MailerService } from "@nestjs-modules/mailer";
import { randomBytes } from "crypto";
import * as bcrypt from "bcrypt";


//logica de recuperación de contraseña
@Injectable()
export class fg_passwdService {
    private readonly logger = new Logger(fg_passwdService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mailer: MailerService,
    ){}

    private static codeGen(len: number): string {
        return randomBytes(Math.ceil(len/2))
            .toString('hex')
            .slice(0,len);
    }

    private async clearRecoveryCode(email: string) {
        await this.prisma.user.update({
            where: { email },
            data: { auth_code: null, expirationTime: null, creationTime: null },
        });
    }

    async notify(payload: forgotten_passwdDto){
        //verificar que existe un usuario con ese mail
        const existingUser = await this.prisma.user.findUnique(
            {where: { email: payload.email}}
        )

        if(existingUser){
            let authCode: string = fg_passwdService.codeGen(9)
            //mandarle un mail con el código de validación del usuario
            //crear el tiempo de creación y expiración del token.
            //TTL del token de 10 mins
            const fechaInicio = new Date();
            const fechaFin = new Date(fechaInicio.getTime()+ 10*60000);

            //HAY QUE AÑADIR EL CÓDIGO DE RECUPERACIÓN EN LA TABLA USUARIO
            await this.prisma.user.update({
                 where:{username: existingUser.username},
                 data: {auth_code: authCode, creationTime: fechaInicio,
                        expirationTime: fechaFin},
             });
            
            try {
                await this.mailer.sendMail({
                            to: payload.email, 
                            subject: "Codigo Verificacion",
                            text: authCode
                            })
            } catch (error) {
                const mailError = error instanceof Error ? error.message : String(error);
                this.logger.error(`Fallo al enviar email de recuperacion a ${payload.email}: ${mailError}`);
                throw new InternalServerErrorException(
                    "No se pudo enviar el correo de recuperación. Revisa la configuración SMTP."
                );
            }
            return true;

            } else {
                throw new UnauthorizedException("El mail no está registrado");
            }
        
        }

    async response(payload: codeAuthDto){

        const user = await this.prisma.user.findUnique({
                where: {email: payload.email}});

        // Se oculta la existencia de usuarios tratando cualquier caso invalido con el mismo mensaje.
        if (!user) {
            throw new UnauthorizedException("El código de verificación ha expirado");
        }

        if (!user.expirationTime || user.expirationTime < new Date()) {
            await this.clearRecoveryCode(payload.email);
            throw new UnauthorizedException("El código de verificación ha expirado");
        }

        if (user.auth_code !== payload.authCode) {
            throw new UnauthorizedException
                            ("El código de verificación es incorrecto");
        }

        await this.clearRecoveryCode(payload.email);
        return true;
    }

    async resetPassword(payload: resetPasswordDto) {
        await this.response({
            email: payload.email,
            authCode: payload.authCode,
        });

        const newPasswordHash = await bcrypt.hash(payload.newPassword, 10);

        await this.prisma.user.update({
            where: { email: payload.email },
            data: {
                passwordHash: newPasswordHash,
            },
        });

        return { message: "Contraseña restablecida correctamente" };
    }
}
