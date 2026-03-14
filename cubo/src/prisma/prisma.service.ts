import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const databaseUrl = config.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL esta faltante');
    }

    //uso adapter de postgres de prisma para establecer la configuracion
    //Otras formas como databases o databaseUrl no las detecta bien
    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);

    super({ adapter });
  }

  async onModuleInit() {
    // Forzamos la conexión al levantar el servidor. 
    // Si la base de datos está caída, NestJS avisa inmediatamente en la terminal.
    await this.$connect();
  }

  async onModuleDestroy() {
    // Se cierra la conexión al apagar el servidor para no dejar zombies en Postgres
    await this.$disconnect();
  }
}