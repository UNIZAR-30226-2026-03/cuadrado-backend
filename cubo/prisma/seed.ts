import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Crear pool de conexión
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Crear adapter
const adapter = new PrismaPg(pool);

// Pasarlo al cliente
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.skin.deleteMany({}); // Borrar para que no dé error el repoblar
  await prisma.skin.createMany({
    data: [
      // CARTAS
      {
        name: 'Cubo',
        type: 'Carta',
        price: 150,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoCubo.png',
      },
      {
        name: 'Cyberpunk',
        type: 'Carta',
        price: 500,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoCyberpunk.png',
      },
      {
        name: 'Fénix',
        type: 'Carta',
        price: 750,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoFenix.png',
      },
      {
        name: 'Dragón',
        type: 'Carta',
        price: 750,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoDragon.png',
      },
      {
        name: 'Default',
        type: 'Carta',
        price: 0,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoDefault.png',
      },
      {
        name: 'Flor Alienígena',
        type: 'Carta',
        price: 550,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoFlor.png',
      },
      {
        name: 'Saturno',
        type: 'Carta',
        price: 650,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoSaturno.png',
      },
      {
        name: 'Gruta de Cristal',
        type: 'Carta',
        price: 650,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoCristales.png',
      },
      {
        name: 'Forja de Magma',
        type: 'Carta',
        price: 550,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoForja.png',
      },
      {
        name: 'Elemental',
        type: 'Carta',
        price: 450,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoElementos.png',
      },
      {
        name: 'Galaxia',
        type: 'Carta',
        price: 850,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoGalaxia.png',
      },
      {
        name: 'Astral',
        type: 'Carta',
        price: 750,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoAstral.png',
      },
      {
        name: 'Bosque',
        type: 'Carta',
        price: 350,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoBosque.png',
      },
      {
        name: "Estilo 80's",
        type: 'Carta',
        price: 250,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/Reverso80s.png',
      },
      {
        name: 'Brújula',
        type: 'Carta',
        price: 450,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoBrujula.png',
      },
      {
        name: 'Candado del Cielo',
        type: 'Carta',
        price: 750,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoCandado.png',
      },
      {
        name: 'Chip',
        type: 'Carta',
        price: 600,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoChip.png',
      },
      {
        name: 'Cyborg',
        type: 'Carta',
        price: 300,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoCyborg.png',
      },
      {
        name: 'Día de Muertos',
        type: 'Carta',
        price: 800,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoDiaDeMuertos.png',
      },
      {
        name: 'Divinidad',
        type: 'Carta',
        price: 400,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoDivino.png',
      },
      {
        name: 'FerCarri',
        type: 'Carta',
        price: 800,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoFerrari.png',
      },
      {
        name: 'Láser',
        type: 'Carta',
        price: 650,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoLaser.png',
      },
      {
        name: 'Onda',
        type: 'Carta',
        price: 150,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoOnda.png',
      },
      // CC.AA.
      {
        name: 'Andalucía',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoAndalucia.png',
      },
      {
        name: 'Aragón',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoAragon.png',
      },
      {
        name: 'Asturias',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoAsturias.png',
      },
      {
        name: 'Islas Baleares',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoBaleares.png',
      },
      {
        name: 'Islas Canarias',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoCanarias.png',
      },
      {
        name: 'Cantabria',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoCantabria.png',
      },
      {
        name: 'Castilla-La Mancha',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoCastillaLaMancha.png',
      },
      {
        name: 'Castilla y León',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoCastillaLeon.png',
      },
      {
        name: 'Cataluña',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoCataluna.png',
      },
      {
        name: 'Extremadura',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoExtremadura.png',
      },
      {
        name: 'Galicia',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoGalicia.png',
      },
      {
        name: 'Comunidad de Madrid',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoMadrid.png',
      },
      {
        name: 'Región de Murcia',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoMurcia.png',
      },
      {
        name: 'Navarra',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoNavarra.png',
      },
      {
        name: 'País Vasco',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoPaisVasco.png',
      },
      {
        name: 'La Rioja',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoRioja.png',
      },
      {
        name: 'Comunidad Valenciana',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoValencia.png',
      },

      // AVATARES
      {
        name: 'User',
        type: 'Avatar',
        price: 0,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/user.png',
      },
      {
        name: 'Vi',
        type: 'Avatar',
        price: 400,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/vi.png',
      },
      {
        name: 'Virginia',
        type: 'Avatar',
        price: 200,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/virginia.png',
      },
      {
        name: 'Swiper',
        type: 'Avatar',
        price: 300,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/swiper.png',
      },
      {
        name: 'Sidu',
        type: 'Avatar',
        price: 700,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/sidu.png',
      },
      {
        name: 'Shakira',
        type: 'Avatar',
        price: 100,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/shakira.png',
      },
      {
        name: 'Samurai',
        type: 'Avatar',
        price: 800,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/samurai.png',
      },
      {
        name: 'Robotin',
        type: 'Avatar',
        price: 100,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/robotin.png',
      },
      {
        name: 'Robot Naranja',
        type: 'Avatar',
        price: 200,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/robot.png',
      },
      {
        name: 'Robot Amarillo',
        type: 'Avatar',
        price: 200,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/robot_gemelo.png',
      },
      {
        name: 'Policía',
        type: 'Avatar',
        price: 400,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/poli_bueno.png',
      },
      {
        name: 'Pirata',
        type: 'Avatar',
        price: 700,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/pirata.png',
      },
      {
        name: 'Balto',
        type: 'Avatar',
        price: 300,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/perro.png',
      },
      {
        name: 'Ollie',
        type: 'Avatar',
        price: 800,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/oso.png',
      },
      {
        name: 'Normie',
        type: 'Avatar',
        price: 200,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/normie.png',
      },
      {
        name: 'Mortimer',
        type: 'Avatar',
        price: 400,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/mortimer.png',
      },
      {
        name: 'Luna',
        type: 'Avatar',
        price: 500,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/luna.png',
      },
      {
        name: 'Lucía',
        type: 'Avatar',
        price: 600,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/lucia.png',
      },
      {
        name: 'Lupus',
        type: 'Avatar',
        price: 800,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/lobo.png',
      },
      {
        name: 'Mufasa',
        type: 'Avatar',
        price: 800,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/leon.png',
      },
      {
        name: 'Keops',
        type: 'Avatar',
        price: 500,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/keops.png',
      },
      {
        name: 'Juan',
        type: 'Avatar',
        price: 300,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/juan.png',
      },
      {
        name: 'Walker',
        type: 'Avatar',
        price: 600,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/walker.png',
      },
      {
        name: 'Dragon',
        type: 'Avatar',
        price: 600,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/dragon.png',
      },
      {
        name: 'Delia',
        type: 'Avatar',
        price: 300,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/delia.png',
      },
      {
        name: 'Cyborg',
        type: 'Avatar',
        price: 500,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/cyborg.png',
      },
      {
        name: 'Colom',
        type: 'Avatar',
        price: 800,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/colom.png',
      },
      {
        name: 'Carlos',
        type: 'Avatar',
        price: 200,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/carlos.png',
      },
      {
        name: 'Búho',
        type: 'Avatar',
        price: 500,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/buho.png',
      },
      {
        name: 'Ayla',
        type: 'Avatar',
        price: 200,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/ayla.png',
      },
      {
        name: 'Anonymous',
        type: 'Avatar',
        price: 400,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/anonymus.png',
      },
      {
        name: 'Ana',
        type: 'Avatar',
        price: 500,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/ana.png',
      },
      {
        name: 'Alien',
        type: 'Avatar',
        price: 400,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/alien.png',
      },
      {
        name: 'Alberto',
        type: 'Avatar',
        price: 600,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/alberto.png',
      },
      {
        name: 'Alba',
        type: 'Avatar',
        price: 700,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/alba.png',
      },
      {
        name: 'Zark',
        type: 'Avatar',
        price: 700,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/avatars/zark.png',
      },

      // TAPETES
      {
        name: 'Tapete Ámbar',
        type: 'Tapete',
        price: 600,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/ambar.png',
      },
      {
        name: 'Tapete Azul',
        type: 'Tapete',
        price: 400,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/azul.png',
      },
      {
        name: 'Tapete Gris',
        type: 'Tapete',
        price: 550,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/gris.png',
      },
      {
        name: 'Tapete Lila',
        type: 'Tapete',
        price: 500,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/lila.png',
      },
      {
        name: 'Tapete Mandarina',
        type: 'Tapete',
        price: 250,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/mandarina.png',
      },
      {
        name: 'Tapete Marrón',
        type: 'Tapete',
        price: 700,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/marron.png',
      },
      {
        name: 'Tapete Morado',
        type: 'Tapete',
        price: 500,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/morado.png',
      },
      {
        name: 'Tapete Naranja',
        type: 'Tapete',
        price: 300,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/naranja.png',
      },
      {
        name: 'Tapete Oro',
        type: 'Tapete',
        price: 600,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/oro.png',
      },
      {
        name: 'Tapete Rosa',
        type: 'Tapete',
        price: 400,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/rosa.png',
      },
      {
        name: 'Tapete Blanco',
        type: 'Tapete',
        price: 700,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/royal-white.png',
      },
      {
        name: 'Tapete Verde',
        type: 'Tapete',
        price: 200,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/mat-skins/verde.png',
      },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
