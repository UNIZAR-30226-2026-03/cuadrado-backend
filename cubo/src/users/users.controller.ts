import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    return this.usersService.getMyProfile(req.user.username);
  }

  @UseGuards(JwtGuard)
  @Get('me/position')
  async getMyPosition(@Request() req: any) {
    return this.usersService.getEloPosition(req.user.username);
  }

  @Get('top')
  async getTopUsers(@Query('limit') limit?: string) {
    const parsedLimit = Number.parseInt(limit ?? '20', 10); //por defecto top 20 
    const safeLimit = Number.isNaN(parsedLimit) ? 20 : parsedLimit; //Por si acaso no se reconoce

    return this.usersService.getTopUsers(safeLimit);
  }
}