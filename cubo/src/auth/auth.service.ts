import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  async login(payload: LoginDto) {
    return {
      accessToken: 'todo',
      user: { email: payload.email },
    };
  }

  async register(payload: RegisterDto) {
    return {
      id: 'todo',
      email: payload.email,
    };
  }
}
