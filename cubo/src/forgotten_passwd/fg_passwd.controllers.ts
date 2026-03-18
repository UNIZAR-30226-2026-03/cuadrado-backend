import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { fg_passwdService } from './fg_passwd.service';
import { forgotten_passwdDto } from './dto/fg_passwd.dto';
import { codeAuthDto } from './dto/codeAuth.dto';

@Controller('forgotten_passwd')
export class FgPasswdController {
  constructor(private readonly fgPasswdService: fg_passwdService) {}

  // 1) Solicitar recuperación: envía el código por email si el usuario existe
  @Post('notify')
  @HttpCode(200)
  async notify(@Body() payload: forgotten_passwdDto) {
    await this.fgPasswdService.notify(payload);

    return {
      ok: true,
      message: 'Si el email existe, se ha enviado un código de verificación.',
    };
  }

  // 2) Verificar código: valida email + authCode
  @Post('verify')
  @HttpCode(200)
  async verify(@Body() payload: codeAuthDto) {
    await this.fgPasswdService.response(payload);
    return { ok: true, message: 'Código verificado correctamente.' };
  }
}
