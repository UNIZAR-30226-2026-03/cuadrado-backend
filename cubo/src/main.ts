import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { join } from 'path';
import { existsSync } from 'fs';
import * as express from 'express';
import { AppModule } from './app.module';
import { WebSocketAdapter } from './websocket/websocket.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const assetsDir = configService.get<string>('ASSETS_DIR') ?? join(process.cwd(), 'assets'); //por si acaso que use assets
  if (existsSync(assetsDir)) {
    app.use(
      '/assets',
      express.static(assetsDir, {
        immutable: true,
        maxAge: '365d',
        setHeaders: (res) => {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
  }
  
  // Prefijo global para todas las rutas
  app.setGlobalPrefix('api');

  // Habilitar CORS
  app.enableCors({
    origin: true,
    credentials: true, //por si empezamos a usar cookies en vez de local storage
  });

  // Registrar adaptador WebSocket con validación JWT
  const jwtService = app.get(JwtService);
  app.useWebSocketAdapter(new WebSocketAdapter(app, jwtService));

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

  const port = configService.get<number>('PORT') ?? 3000;

  await app.listen(port);
  console.log(`Servidor iniciado en puerto ${port}`);
}
bootstrap();
