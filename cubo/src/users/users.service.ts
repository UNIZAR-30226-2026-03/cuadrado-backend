import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

//Por ahora devolvemos todo, se puede cambiar
const userProfileSelect = {
  username: true,
  email: true,
  cubitos: true,
  eloRating: true,
  gamesPlayed: true,
  gamesWon: true,
  numPlayersPlayed: true,
  numPlayersWon: true,
  settings: true,
  equippedAvatarId: true,
  equippedCardId: true,
  equippedTapeteId: true,
} as const;

type UserProfileRow = Prisma.UserGetPayload<{ select: typeof userProfileSelect }>;
type LeaderboardRow = Pick<UserProfileRow, 'username' | 'eloRating'>;

export interface UserSettings {
  voiceChatVolume: number;
  gameMusicVolume: number;
  soundEffectsVolume: number;
  [key: string]: any; //para que prisma lo acepte para Json
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private toProfileResponse(user: UserProfileRow) {
    return {
      username: user.username,
      email: user.email,
      cubitos: user.cubitos,
      eloRating: user.eloRating,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      numPlayersPlayed: user.numPlayersPlayed,
      numPlayersWon: user.numPlayersWon,
      settings: user.settings,
      equipado: {
        avatar: user.equippedAvatarId,
        card: user.equippedCardId,
        tapete: user.equippedTapeteId,
      },
    };
  }

  async getMyProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: userProfileSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.toProfileResponse(user);
  }

  async getEloPosition(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { username: true, eloRating: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const usersAhead = await this.prisma.user.count({
      where: { eloRating: { gt: user.eloRating } },
    }); //en caso de empate, los empatados tienen el mismo rango (ambos tienen la mejor posicion)

    return {
      username: user.username,
      eloRating: user.eloRating,
      position: usersAhead + 1,
    };
  }

  async getTopUsers(limit: number) {
    const safeLimit = Math.min(Math.max(limit, 1), 101); //no puede mandar más de 101 usuarios

    const users: LeaderboardRow[] = await this.prisma.user.findMany({
      select: {
        username: true,
        eloRating: true,
      },
      orderBy: [
        { eloRating: 'desc' }, 
        { username: 'asc' },
      ],
      take: safeLimit,
    });

    let lastElo: number | null = null;
    let currentPosition = 0;

    return users.map((user, index) => {
      if (lastElo !== user.eloRating) {
        currentPosition = index + 1; //index+1 para que se quede bien tras los empates
        lastElo = user.eloRating;
      }

      return {
        position: currentPosition,
        username: user.username,
        eloRating: user.eloRating,
      };
    });
  }

  async getMySettings(username: string): Promise<UserSettings> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { settings: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    //valores por defecto
    if (!user.settings) {
      return {
        voiceChatVolume: 50,
        gameMusicVolume: 50,
        soundEffectsVolume: 50,
      };
    }

    return user.settings as UserSettings;
  }

  async updateMySettings(username: string, updateSettingsDto: UpdateSettingsDto): Promise<UserSettings> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { settings: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    //valores por defecto
    const currentSettings: UserSettings = user.settings as UserSettings || {
      voiceChatVolume: 50,
      gameMusicVolume: 50,
      soundEffectsVolume: 50,
    };

    //si existe el nuevo, lo pongo. sino dejo el antiguo
    const voiceChatVolume = updateSettingsDto.voiceChatVolume ?? currentSettings.voiceChatVolume;
    const gameMusicVolume = updateSettingsDto.gameMusicVolume ?? currentSettings.gameMusicVolume;
    const soundEffectsVolume = updateSettingsDto.soundEffectsVolume ?? currentSettings.soundEffectsVolume;

    // Validate all values are within range
    if (voiceChatVolume < 0 || voiceChatVolume > 100) {
      throw new BadRequestException('voiceChatVolume debe estar entre 0 y 100');
    }
    if (gameMusicVolume < 0 || gameMusicVolume > 100) {
      throw new BadRequestException('gameMusicVolume debe estar entre 0 y 100');
    }
    if (soundEffectsVolume < 0 || soundEffectsVolume > 100) {
      throw new BadRequestException('soundEffectsVolume debe estar entre 0 y 100');
    }

    const updatedSettings: UserSettings = {
      voiceChatVolume,
      gameMusicVolume,
      soundEffectsVolume,
    };

    // Update in database
    const result = await this.prisma.user.update({
      where: { username },
      data: { settings: updatedSettings },
      select: { settings: true },
    });

    return result.settings as UserSettings;
  }
}