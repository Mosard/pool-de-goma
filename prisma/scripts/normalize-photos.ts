// Réduit les photos de profil déjà stockées (data URL) au format appliqué
// désormais à chaque envoi : WebP, 512 px de côté au plus.
//
// PAR DÉFAUT : SIMULATION (aucune écriture), affiche le gain estimé.
// Écriture seulement avec --apply, après accord explicite.
//
//   POSTGRES_URL=<url> npx tsx prisma/scripts/normalize-photos.ts
//   POSTGRES_URL=<url> npx tsx prisma/scripts/normalize-photos.ts --apply
//
// Seul photoUrl change : l'image reste la même (réduite), donc
// photoUpdatedAt, l'accord et l'autorisation de publication sont conservés.
// Aucune donnée personnelle n'est affichée (compteurs uniquement).

import { PrismaClient } from "@prisma/client";
import { decodePhotoDataUrl, normalizeProfilePhoto } from "../../src/lib/profile-photo";

const APPLY = process.argv.includes("--apply");
const THRESHOLD_BYTES = 120 * 1024; // en dessous, la photo est déjà légère

const prisma = new PrismaClient();

async function main() {
  const ids = await prisma.user.findMany({ where: { photoUrl: { not: null } }, select: { id: true } });
  let heavy = 0;
  let unreadable = 0;
  let before = 0;
  let after = 0;
  let written = 0;

  for (const { id } of ids) {
    const user = await prisma.user.findUnique({ where: { id }, select: { photoUrl: true } });
    const current = user?.photoUrl;
    if (!current || current.length < THRESHOLD_BYTES) continue;
    heavy++;
    const decoded = decodePhotoDataUrl(current);
    const normalized = decoded ? await normalizeProfilePhoto(decoded.buffer) : null;
    if (!normalized) {
      unreadable++;
      continue;
    }
    before += current.length;
    after += normalized.length;
    if (APPLY && normalized.length < current.length) {
      await prisma.user.update({ where: { id }, data: { photoUrl: normalized } });
      written++;
    }
  }

  console.log(`Photos : ${ids.length} ; à réduire (> ${THRESHOLD_BYTES / 1024} Ko) : ${heavy} ; illisibles : ${unreadable}`);
  console.log(`Volume des photos concernées : ${(before / 1024).toFixed(0)} Ko → ${(after / 1024).toFixed(0)} Ko`);
  console.log(APPLY ? `Écrites : ${written}` : "Simulation : rien n'a été écrit (ajouter --apply pour écrire).");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
