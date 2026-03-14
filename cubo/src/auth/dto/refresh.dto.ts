import { IsNotEmpty } from 'class-validator';

export class RefreshDto {
  @IsNotEmpty({ message: 'El refresh token es requerido' })
  refreshToken!: string;
}