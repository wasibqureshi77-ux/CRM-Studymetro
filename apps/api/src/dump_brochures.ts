import { PrismaService } from './prisma/prisma.service';

const prisma = new PrismaService();

async function dump() {
  const assignments = await prisma.brochureAssignment.findMany({
    include: {
      brochure: true,
    }
  });
  console.log(JSON.stringify(assignments, null, 2));
}

dump().finally(() => prisma.onModuleDestroy());
