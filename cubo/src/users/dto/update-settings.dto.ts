import { IsOptional, IsNumber, Min, Max } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  voiceChatVolume?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  gameMusicVolume?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  soundEffectsVolume?: number;
}
