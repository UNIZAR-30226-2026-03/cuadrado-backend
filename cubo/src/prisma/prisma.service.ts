import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Forzamos la conexión al levantar el servidor. 
    // Si la base de datos está caída, NestJS te avisará inmediatamente en la terminal.
    await this.$connect();
  }

  async onModuleDestroy() {
    // Es vital cerrar la conexión al apagar el servidor para no dejar zombies en Postgres
    await this.$disconnect();
  }
}