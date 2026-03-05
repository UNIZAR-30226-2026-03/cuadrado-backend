import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log("ANTES de NestFactory.create: SMTP_PORT =", process.env.POSTGRES_USER);
  const app = await NestFactory.create(AppModule);
  // Prefijo global para todas las rutas
  app.setGlobalPrefix('api');

  // Habilitar CORS
  app.enableCors({
    origin: true,
    credentials: true, //por si empezamos a usar cookies en vez de local storage
  });

  // ValidationPipe global: valida DTOs y rechaza datos inválidos (Valida todos )
  // whitelist: true -> elimina campos no permitidos en los DTOs
  // forbidNonWhitelisted: true -> lanza error si hay campos extra
  // transform: true -> transforma tipos automáticamente (string -> number)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;

  await app.listen(port);
  console.log(`Servidor iniciado en puerto ${port}`);
}
bootstrap();
