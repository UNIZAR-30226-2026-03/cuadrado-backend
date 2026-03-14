import { Controller, Get, Post, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { SkinsService } from './skins.service';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@Controller('skins')
export class SkinsController {
    constructor(private readonly skinsService: SkinsService) { }

    // 1. Obtener todas las skins disponibles en la tienda
    @Get('store')
    async getStoreSkins() {
        return this.skinsService.getStoreSkins();
    }

    // 2. Obtener el inventario de skins de un usuario logueado
    @UseGuards(JwtGuard)
    @Get('inventory')
    async getMyInventory(@Request() req: any) {
        return this.skinsService.getMyInventory(req.user.username);
    }

    // 3. Comprar una skin
    @UseGuards(JwtGuard)
    @Post('buy/:skinId')
    async buySkin(@Param('skinId') skinId: string, @Request() req: any) {
        return this.skinsService.buySkin(req.user.username, skinId);
    }

    // 4. Equipar una skin específica
    @UseGuards(JwtGuard)
    @Patch('equip/:skinId')
    async equipSkin(@Param('skinId') skinId: string, @Request() req: any) {
        return this.skinsService.equipSkin(req.user.username, skinId);
    }

    // 5. Desequipar skin actual
    @UseGuards(JwtGuard)
    @Patch('unequip/:type')
    async unequipSkin(@Param('type') type: string, @Request() req: any) {
        return this.skinsService.unequipSkin(req.user.username, type);
    }

    // 6. Obtener skins equipadas
    @UseGuards(JwtGuard)
    @Get('equipped')
    async getEquippedSkins(@Request() req: any) {
        return this.skinsService.getEquippedSkins(req.user.username);
    }
}
