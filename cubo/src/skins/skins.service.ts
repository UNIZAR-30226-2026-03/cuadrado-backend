import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SkinsService {
    constructor(private readonly prisma: PrismaService) { }

    // 1. Obtener todas las skins disponibles en la tienda
    async getStoreSkins() {
        return this.prisma.skin.findMany();
    }

    // 2. Obtener el inventario de skins de un usuario
    async getMyInventory(username: string) {
        const userSkins = await this.prisma.userSkin.findMany({
            where: { userId: username },
            include: {
                skin: true, // Incluye los detalles de la skin
            },
            orderBy: {
                skin: {
                    name: 'asc'
                }
            }
        });

        // Mapeamos para devolver solo el array de skins limpias
        return userSkins.map(us => us.skin);
    }

    // 3. Comprar una skin
    async buySkin(username: string, skinId: string) {
        // a) Verificar que la skin existe
        const skin = await this.prisma.skin.findUnique({
            where: { name: skinId },
        });

        if (!skin) {
            throw new NotFoundException('La skin no existe');
        }

        // b) Verificar que el usuario no la tenga ya
        const existingOwnership = await this.prisma.userSkin.findUnique({
            where: {
                userId_skinId: {
                    userId: username,
                    skinId: skinId,
                },
            },
        });

        if (existingOwnership) {
            throw new ConflictException('Ya posees esta skin');
        }

        // c) Obtener usuario para comprobar saldo
        const user = await this.prisma.user.findUnique({
            where: { username },
        });

        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        if (user.cubitos < skin.price) {
            throw new BadRequestException('No tienes suficientes cubitos para comprar esta skin');
        }

        // d) Realizar la transacción segura (restar cubitos y añadir al inventario)
        return this.prisma.$transaction(async (tx) => {
            // Descontar saldo
            await tx.user.update({
                where: { username },
                data: { cubitos: { decrement: skin.price } },
            });

            // Añadir al inventario
            const userSkin = await tx.userSkin.create({
                data: {
                    userId: username,
                    skinId: skinId,
                },
                include: { skin: true }
            });

            return {
                message: 'Skin comprada con éxito',
                skin: userSkin.skin,
            };
        });
    }

    // 4. Equipar una skin
    async equipSkin(username: string, skinId: string) {
        // a) Verificar que el usuario posee la skin
        const ownership = await this.prisma.userSkin.findUnique({
            where: {
                userId_skinId: {
                    userId: username,
                    skinId: skinId,
                },
            },
        });

        if (!ownership) {
            throw new BadRequestException('No puedes equipar una skin que no posees');
        }

        // b) Actualizar el usuario
        await this.prisma.user.update({
            where: { username },
            data: { equippedSkinID: skinId },
        });

        return { message: 'Skin equipada con éxito' };
    }

    // 5. Desequipar skin actual
    async unequipSkin(username: string) {
        await this.prisma.user.update({
            where: { username },
            data: { equippedSkinID: null },
        });

        return { message: 'Skin desequipada con éxito' };
    }
}
