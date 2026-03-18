import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshDto } from './dto/refresh.dto';
import * as bcrypt from 'bcrypt';

//Toda la logica
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) { }

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

    // Generar refresh token
    const refreshToken = this.jwtService.sign(
      { sub: user.username },
      { expiresIn: '30d' }
    );

    // Guardar refresh token en BD
    await this.prisma.refreshToken.create({
      data: {
        userId: user.username,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      },
    });

    return {
      accessToken,
      user: {
        username: user.username,
        eloRating: user.eloRating,
        cubitos: user.cubitos,
      },
    };

  }

  async changePassword(username: string, payload: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Verificar contraseña actual
    const passwordMatch = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    // Hash de la nueva contraseña
    const newPasswordHash = await bcrypt.hash(payload.newPassword, 10);

    // Actualizar en BD
    await this.prisma.user.update({
      where: { username },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  async refreshAccessToken(refreshToken: string) {
    // Validar que el refresh token exista en BD y no esté expirado
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Verificar firma del JWT
    try {
      this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const user = storedToken.user;

    // Generar nuevo access token
    const newAccessToken = this.jwtService.sign({
      sub: user.username,
      email: user.email,
    });

    // Opcionalmente: generar nuevo refresh token
    const newRefreshToken = this.jwtService.sign(
      { sub: user.username },
      { expiresIn: '30d' }
    );

    // Guardar el nuevo refresh token
    await this.prisma.refreshToken.create({
      data: {
        userId: user.username,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.delete({
      where: { token: refreshToken },
    });

    return { message: 'Sesión cerrada' };
  }

}
