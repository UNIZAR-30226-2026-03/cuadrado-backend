import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.skin.createMany({
    data: [
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
        name: 'Fenix',
        type: 'Carta',
        price: 750,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoFenix.png',
      },
      {
        name: 'Dragon',
        type: 'Carta',
        price: 750,
        url: 'https://gtelrtcunhznrrapfjbj.supabase.co/storage/v1/object/public/cubo-assets/card-skins/ReversoDragon.png',
      },
      {
        name: 'Dragon',
        type: 'Carta',
        price: 750,
        url: '',
      },
      {
        name: 'Onda',
        type: 'Carta',
        price: 250,
        url: '',
      },
      {
        name: 'Geométrico',
        type: 'Carta',
        price: 350,
        url: '',
      },
      {
        name: 'Hexágono',
        type: 'Carta',
        price: 250,
        url: '',
      },
      {
        name: 'Círculo',
        type: 'Carta',
        price: 250,
        url: '',
      },
      {
        name: 'Brújula',
        type: 'Carta',
        price: 300,
        url: '',
      },
      {
        name: 'Degradado',
        type: 'Carta',
        price: 200,
        url: '',
      },
      {
        name: 'Cyborg',
        type: 'Carta',
        price: 350,
        url: '',
      },
      {
        name: 'Cubito',
        type: 'Carta',
        price: 250,
        url: '',
      },
      {
        name: 'Flor',
        type: 'Carta',
        price: 550,
        url: '',
      },
      {
        name: 'Saturno',
        type: 'Carta',
        price: 650,
        url: '',
      },
      {
        name: 'Cristales',
        type: 'Carta',
        price: 650,
        url: '',
      },
      {
        name: 'Lava',
        type: 'Carta',
        price: 550,
        url: '',
      },
      {
        name: 'Elementos',
        type: 'Carta',
        price: 450,
        url: '',
      },
      {
        name: 'Galaxia',
        type: 'Carta',
        price: 850,
        url: '',
      },
      {
        name: 'Chip',
        type: 'Carta',
        price: 450,
        url: '',
      },
      {
        name: 'Benja',
        type: 'Carta',
        price: 750,
        url: '',
      },

      {
        name: 'Azul',
        type: 'Tapete',
        price: 100,
        url: '',
      },

      {
        name: 'User',
        type: 'Avatar',
        price: 0,
        url: '',
      },
      {
        name: 'Vi',
        type: 'Avatar',
        price: 400,
        url: '',
      },
      {
        name: 'Virginia',
        type: 'Avatar',
        price: 200,
        url: '',
      },
      {
        name: 'Swiper',
        type: 'Avatar',
        price: 300,
        url: '',
      },
      {
        name: 'Sidu',
        type: 'Avatar',
        price: 700,
        url: '',
      },
      {
        name: 'Shakira',
        type: 'Avatar',
        price: 100,
        url: '',
      },
      {
        name: 'Samurai',
        type: 'Avatar',
        price: 800,
        url: '',
      },
      {
        name: 'Robotin',
        type: 'Avatar',
        price: 100,
        url: '',
      },
      {
        name: 'Robot Naranja',
        type: 'Avatar',
        price: 200,
        url: '',
      },
      {
        name: 'Robot Amarillo',
        type: 'Avatar',
        price: 200,
        url: '',
      },
      {
        name: 'Policía',
        type: 'Avatar',
        price: 400,
        url: '',
      },
      {
        name: 'Pirata',
        type: 'Avatar',
        price: 700,
        url: '',
      },
      {
        name: 'Usnavy',
        type: 'Avatar',
        price: 300,
        url: '',
      },
      {
        name: 'Ollie',
        type: 'Avatar',
        price: 0,
        url: '',
      },
      {
        name: 'Normie',
        type: 'Avatar',
        price: 200,
        url: '',
      },
      {
        name: 'Mortimer',
        type: 'Avatar',
        price: 400,
        url: '',
      },
      {
        name: 'Luna',
        type: 'Avatar',
        price: 500,
        url: '',
      },
      {
        name: 'Lucía',
        type: 'Avatar',
        price: 600,
        url: '',
      },
      {
        name: 'Lupus',
        type: 'Avatar',
        price: 800,
        url: '',
      },
      {
        name: 'Mufasa',
        type: 'Avatar',
        price: 800,
        url: '',
      },
      {
        name: 'Keops',
        type: 'Avatar',
        price: 500,
        url: '',
      },
      {
        name: 'Juan',
        type: 'Avatar',
        price: 300,
        url: '',
      },
      {
        name: 'Jeffrey',
        type: 'Avatar',
        price: 600,
        url: '',
      },
      {
        name: 'Holt',
        type: 'Avatar',
        price: 600,
        url: '',
      },
      {
        name: 'Dragon',
        type: 'Avatar',
        price: 600,
        url: '',
      },
      {
        name: 'Delia',
        type: 'Avatar',
        price: 300,
        url: '',
      },
      {
        name: 'Cyborg',
        type: 'Avatar',
        price: 500,
        url: '',
      },
      {
        name: 'Colom',
        type: 'Avatar',
        price: 800,
        url: '',
      },
      {
        name: 'Carlos',
        type: 'Avatar',
        price: 200,
        url: '',
      },
      {
        name: 'Búho',
        type: 'Avatar',
        price: 500,
        url: '',
      },
      {
        name: 'Ayla',
        type: 'Avatar',
        price: 200,
        url: '',
      },
      {
        name: 'Anonymous',
        type: 'Avatar',
        price: 400,
        url: '',
      },
      {
        name: 'Ana',
        type: 'Avatar',
        price: 500,
        url: '',
      },
      {
        name: 'Alien',
        type: 'Avatar',
        price: 400,
        url: '',
      },
      {
        name: 'Alberto',
        type: 'Avatar',
        price: 600,
        url: '',
      },
      {
        name: 'Alba',
        type: 'Avatar',
        price: 700,
        url: '',
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
