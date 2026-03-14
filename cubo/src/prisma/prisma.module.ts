import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() //Se hace el modulo global para no tener que importarlo desde todos lados
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Esto permite que otros módulos lo usen
})
export class PrismaModule {}