import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SkinsService {
    constructor(private readonly prisma: PrismaService) { }

    // 1. Obtener todas las skins disponibles en la tienda
    //    ordenadas por tipo y luego por nombre
    async getStoreSkins() {
        return this.prisma.skin.findMany({
            orderBy: {
                type: 'asc',
                name: 'asc'
            }
        });
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
        return this.prisma.$transaction(async (tx) => {
            // a) Verificamos la skin (dentro de la transacción)
            const skin = await tx.skin.findUnique({ where: { id: skinId } });
            if (!skin) throw new NotFoundException('La skin no existe');

            // b) Verificamos si ya la tiene
            const existingOwnership = await tx.userSkin.findUnique({
                where: { userId_skinId: { userId: username, skinId: skinId } },
            });
            if (existingOwnership) throw new ConflictException('Ya tienes esta skin');

            // c) Verificamos al usuario y su saldo (dentro de la transacción)
            const user = await tx.user.findUnique({ where: { username } });
            if (!user) throw new NotFoundException('Usuario no encontrado');

            if (user.cubitos < skin.price) {
                throw new BadRequestException('No tienes suficientes cubitos');
            }

            // d) Efectuar cobro y entrega
            await tx.user.update({
                where: { username },
                data: { cubitos: { decrement: skin.price } },
            });

            const userSkin = await tx.userSkin.create({
                data: { userId: username, skinId: skinId },
                include: { skin: true }
            });

            return {
                message: 'Skin comprada con éxito',
                skin: userSkin.skin,
                saldo_restante: user.cubitos - skin.price //Dato muy útil para el Frontend
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

        const skin = await this.prisma.skin.findUnique({
            where: { id: skinId },
        });

        if (!skin) {
            throw new NotFoundException('La skin no existe');
        }

        const skinType = skin.type;
        let updateData = {};

        // Actualizamos un campo u otro según el tipo
        if (skinType === 'Carta') updateData = { equippedCardId: skinId };
        else if (skinType === 'Avatar') updateData = { equippedAvatarId: skinId };
        else if (skinType === 'Tapete') updateData = { equippedTapeteId: skinId };
        else throw new BadRequestException('Tipo de skin desconocido');

        await this.prisma.user.update({
            where: { username },
            data: updateData,
        });

        return { message: `${skinType} equipado con éxito` };
    }

    // 5. Desequipar skin actual
    async unequipSkin(username: string, type: string) {
        let updateData = {};

        if (type === 'Carta') updateData = { equippedCardId: null };
        else if (type === 'Avatar') updateData = { equippedAvatarId: null };
        else if (type === 'Tapete') updateData = { equippedTapeteId: null };
        else throw new BadRequestException('Tipo inválido');

        await this.prisma.user.update({
            where: { username },
            data: updateData,
        });

        let message = '';
        if (type === 'Carta') message = 'Carta desequipada con éxito';
        else if (type === 'Avatar') message = 'Avatar desequipado con éxito';
        else if (type === 'Tapete') message = 'Tapete desequipado con éxito';
        else throw new BadRequestException('Tipo inválido');

        return { message };
    }


    // 6. Obtener las skins actualmente equipadas de un usuario
    async getEquippedSkins(username: string) {
        const user = await this.prisma.user.findUnique({
            where: { username },
            select: {
                equippedAvatarId: true,
                equippedCardId: true,
                equippedTapeteId: true,
            }
        });

        if (!user) throw new NotFoundException('Usuario no encontrado');

        const avatar = user.equippedAvatarId ? await this.prisma.skin.findUnique({
            where: { id: user.equippedAvatarId } }) : null;
        const carta = user.equippedCardId ? await this.prisma.skin.findUnique({
            where: { id: user.equippedCardId } }) : null;
        const tapete = user.equippedTapeteId ? await this.prisma.skin.findUnique({
            where: { id: user.equippedTapeteId } }) : null;


        // Devolver URL de la carta
        return {
            avatar: avatar?.url || null,
            carta: carta?.url || null,
            tapete: tapete?.url || null
        };
    }
}


