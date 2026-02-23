import { Body, Controller, Post, UseGuards, Get, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtGuard } from './guards/jwt.guard';

//Recibe hhtp, valida los datos con DTO, llama al service y devuelve la respuesta
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Get('me')
  @UseGuards(JwtGuard) //Solo entra si el token es valido
  async getMe(@Request() req: any) {
    return {
      username: req.user.username,
      email: req.user.email,
    };
  }
}
