import { IsNotEmpty } from "class-validator";
import { IsEmail

 } from "class-validator";
export class codeAuthDto {
    @IsEmail ({}, {message: 'el e-mail no puede ser vacío'})
    email!:string
    @IsNotEmpty ({message: 'el código de verificación no puede ser vacío'})
    authCode!: string
}