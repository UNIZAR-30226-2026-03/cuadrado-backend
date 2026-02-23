import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

//Toda la logica
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(payload: RegisterDto) {
    // Verificar si el usuario ya existe por username
    const existingUser = await this.prisma.user.findUnique({
      where: { username: payload.username },
    });

    if (existingUser) {
      throw new BadRequestException('El nombre de usuario ya está en uso');
    }

    // Verificar si el email ya existe
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (existingEmail) {
      throw new BadRequestException('El email ya está registrado');
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(payload.password, 10);

    // Crear usuario con valores por defecto
    const user = await this.prisma.user.create({
      data: {
        username: payload.username,
        email: payload.email,
        passwordHash,
        cubitos: 0,
        eloRating: 1200,
        rankPlacement: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        numPlayersPlayed: 0,
        numPlayersWon: 0,
      },
    });

    return {
      id: user.username,
      username: user.username,
      email: user.email,
    };
  }

  async login(payload: LoginDto) {
    // Buscar usuario
    const user = await this.prisma.user.findUnique({
      where: { username: payload.username },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(payload.password, user.passwordHash);

    if (!passwordMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generar JWT token
    const accessToken = this.jwtService.sign({
      sub: user.username,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        username: user.username,
        eloRating: user.eloRating,
        cubitos: user.cubitos,
      },
    };
    
    // TODO: Implementar refresh token cuando sea necesario
    // accessToken: ...
    // refreshToken: ...
  }
}
