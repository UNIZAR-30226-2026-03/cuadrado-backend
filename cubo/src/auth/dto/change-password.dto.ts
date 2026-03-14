import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  currentPassword!: string;

  @IsNotEmpty({ message: 'La contraseña nueva es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  newPassword!: string;
}