import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class resetPasswordDto {
  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email!: string;

  @IsNotEmpty({ message: 'El código de verificación es requerido' })
  authCode!: string;

  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  newPassword!: string;
}
