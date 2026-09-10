import { prisma } from "../src/lib/prisma";
import { runDemoSeed } from "../src/lib/demo-seed";

runDemoSeed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
