import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const name = process.argv[2] || 'Ojas';

async function main() {
  const s = await prisma.appSettings.update({
    where: { id: 'singleton' },
    data: { appName: name },
  });
  console.log('appName =', s.appName);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
