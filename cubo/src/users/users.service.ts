import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
}