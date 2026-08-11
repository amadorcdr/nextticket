import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// El datasource del schema no trae url: Prisma 7 exige el driver adapter,
// igual que hace PrismaService. Sin esto el seed truena al construir el cliente.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no esta definida: revisa el .env');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ROLES = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'CLIENT',
    description: 'Cliente',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'ORGANIZER',
    description: 'Organizador',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'VALIDATOR',
    description: 'Validador',
  },
];

async function main() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log(`Roles sembrados: ${ROLES.map((role) => role.name).join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
