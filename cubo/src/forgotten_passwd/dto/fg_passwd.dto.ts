import { IsEmail, IsNotEmpty }   from 'class-validator';
export class forgotten_passwdDto {
    @IsEmail({},{message: 'El email debe ser válido'})
    @IsNotEmpty({message: 'El e-mail es requerido'})
    email!: string;
}