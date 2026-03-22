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
        name: 'Carta Cubo',
        type: 'Carta',
        price: 150,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/cubo.png',
      },
      {
        name: 'Carta Cyberpunk',
        type: 'Carta',
        price: 500,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/cyberpunk.png',
      },
      {
        name: 'Carta Fénix',
        type: 'Carta',
        price: 750,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/fenix.png',
      },
      {
        name: 'Carta Dragón',
        type: 'Carta',
        price: 750,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/dragon.png',
      },
      {
        name: 'Carta Default',
        type: 'Carta',
        price: 0,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/default.png',
      },
      {
        name: 'Carta Flor',
        type: 'Carta',
        price: 550,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/flor.png',
      },
      {
        name: 'Carta Saturno',
        type: 'Carta',
        price: 650,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/saturno.png',
      },
      {
        name: 'Carta Cristales',
        type: 'Carta',
        price: 650,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/cristales.png',
      },
      {
        name: 'Carta Lava',
        type: 'Carta',
        price: 550,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/lava.png',
      },
      {
        name: 'Carta Elementos',
        type: 'Carta',
        price: 450,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/elementos.png',
      },
      {
        name: 'Carta Galaxia',
        type: 'Carta',
        price: 850,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/galaxia.png',
      },
      {
        name: 'Carta Astral',
        type: 'Carta',
        price: 750,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/astral.png',
      },
      {
        name: 'Carta Bosque',
        type: 'Carta',
        price: 350,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/bosque%20.png',
      },
      {
        name: "Carta 80's",
        type: 'Carta',
        price: 250,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/80s.png',
      },
      {
        name: 'Carta Brújula',
        type: 'Carta',
        price: 450,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/brujula.png',
      },
      {
        name: 'Carta Candado',
        type: 'Carta',
        price: 750,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/candado.png',
      },
      {
        name: 'Carta Chip',
        type: 'Carta',
        price: 600,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/chip.png',
      },
      {
        name: 'Carta Cyborg',
        type: 'Carta',
        price: 300,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/cyborg.png',
      },
      {
        name: 'Carta Día de muertos',
        type: 'Carta',
        price: 800,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/dia-de-muertos.png',
      },
      {
        name: 'Carta Escudo',
        type: 'Carta',
        price: 400,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/escudo.png',
      },
      {
        name: 'Carta Ferrari',
        type: 'Carta',
        price: 800,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ferrari.png',
      },
      {
        name: 'Carta Láser',
        type: 'Carta',
        price: 650,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/laser.png',
      },
      {
        name: 'Carta Onda',
        type: 'Carta',
        price: 150,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/onda.png',
      },
      // CC.AA.
      {
        name: 'Andalucía',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/andalucia.png',
      },
      {
        name: 'Aragón',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/aragon.png',
      },
      {
        name: 'Asturias',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/asturias.png',
      },
      {
        name: 'Islas Baleares',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/baleares.png',
      },
      {
        name: 'Islas Canarias',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/canarias.png',
      },
      {
        name: 'Cantabria',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/cantabria.png',
      },
      {
        name: 'Castilla-La Mancha',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/castilla-la-mancha.png',
      },
      {
        name: 'Castilla y León',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/castilla-leon.png',
      },
      {
        name: 'Cataluña',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/cataluna.png',
      },
      {
        name: 'Extremadura',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/extremadura.png',
      },
      {
        name: 'Galicia',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/galicia.png',
      },
      {
        name: 'Comunidad de Madrid',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/madrid.png',
      },
      {
        name: 'Región de Murcia',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/murcia.png',
      },
      {
        name: 'Navarra',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/navarra.png',
      },
      {
        name: 'País Vasco',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/pais-vasco.png',
      },
      {
        name: 'La Rioja',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/rioja.png',
      },
      {
        name: 'Comunidad Valenciana',
        type: 'Carta',
        price: 900,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/valencia.png',
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
