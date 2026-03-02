import { Injectable, BadRequestException, UnauthorizedException } from 
    "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { forgotten_passwdDto } from "./dto/fg_passwd.dto";
import * as bcrypt from 'bcrypt';
import { codeAuthDto } from "./dto/codeAuth.dto";
import { MailerService } from "@nestjs-modules/mailer";
import { randomBytes } from "crypto";


//logica de recuperación de contraseña
@Injectable()
export class fg_passwdService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailer: MailerService,
    ){}

    private static codeGen(len: number): string {
        return randomBytes(Math.ceil(len/2))
            .toString('hex')
            .slice(0,len);
    }

    async notify(playload: forgotten_passwdDto){
        //verificar que existe un usuario con ese mail
        const existingUser = await this.prisma.user.findUnique(
            {where: { email: playload.email}}
        )

        if(existingUser){
            let authCode: string = fg_passwdService.codeGen(9)
            //mandarle un mail con el código de validación del usuario
            
            //HAY QUE AÑADIR EL CÓDIGO DE RECUPERACIÓN EN LA TABLA USUARIO
            // await this.prisma.user.update({
            //     where:{username: existingUser.username},
            //     data: {code: authCode},
            // });
            
            await this.mailer.sendMail({
                        to: playload.email, 
                        subject: "Codigo Verificacion",
                        text: authCode
                        })
            }
        //redirigir a ventana de introducción de código de verificación
        }

        async response(playload: codeAuthDto){
            const correctCode = await this.prisma.user.findUnique({
                    where: {code: playload.authCode, email: playload.email }});
            if(!correctCode){
                throw new UnauthorizedException
                            ("El código de verificación es incorrecto");
            } else {
                //reidirigir a la ventana de cambio de contraseña
            }
            
        }
}

