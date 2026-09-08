import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Demo1234!", 10);

  const chef = await prisma.user.upsert({
    where: { email: "chef@poolgoma.test" },
    update: {},
    create: {
      name: "Ir Moise Salama",
      email: "chef@poolgoma.test",
      passwordHash: password,
      role: "CHEF_POOL",
    },
  });

  const inspecteur = await prisma.user.upsert({
    where: { email: "inspecteur@poolgoma.test" },
    update: {},
    create: {
      name: "Jean Mapenzi",
      email: "inspecteur@poolgoma.test",
      passwordHash: password,
      role: "INSPECTEUR",
    },
  });

  await prisma.user.upsert({
    where: { email: "exploitant@poolgoma.test" },
    update: {},
    create: {
      name: "Alice Kavira",
      email: "exploitant@poolgoma.test",
      passwordHash: password,
      role: "EXPLOITANT",
    },
  });

  const school1 = await prisma.school.upsert({
    where: { code: "EP-GOMA-001" },
    update: {},
    create: {
      name: "EP Les Volcans",
      code: "EP-GOMA-001",
      province: "Nord-Kivu",
      territoire: "Goma",
      director: "M. Bahati",
      type: "Primaire",
    },
  });

  const school2 = await prisma.school.upsert({
    where: { code: "INST-GOMA-002" },
    update: {},
    create: {
      name: "Institut La Paix",
      code: "INST-GOMA-002",
      province: "Nord-Kivu",
      territoire: "Goma",
      director: "Mme Furaha",
      type: "Secondaire",
    },
  });

  await prisma.assignment.upsert({
    where: { id: "seed-assignment-1" },
    update: {},
    create: {
      id: "seed-assignment-1",
      schoolId: school1.id,
      inspectorId: inspecteur.id,
      assignedById: chef.id,
    },
  });

  await prisma.assignment.upsert({
    where: { id: "seed-assignment-2" },
    update: {},
    create: {
      id: "seed-assignment-2",
      schoolId: school2.id,
      inspectorId: inspecteur.id,
      assignedById: chef.id,
    },
  });

  console.log("Seed terminé. Comptes de démo (mot de passe: Demo1234!):");
  console.log("- chef@poolgoma.test (Chef de POOL)");
  console.log("- inspecteur@poolgoma.test (Inspecteur)");
  console.log("- exploitant@poolgoma.test (Exploitant)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
