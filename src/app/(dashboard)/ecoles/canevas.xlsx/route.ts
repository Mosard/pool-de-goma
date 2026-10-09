// Canevas Excel vierge des écoles (docs/import-ecoles-excel.md, § 3.2) :
// réservé aux comptes qui gèrent les écoles d'au moins un POOL (droits relus
// en base) ; la feuille « Mode d'emploi » liste les codes de CES POOL.

import { auth } from "@/lib/auth";
import { manageablePools } from "@/lib/schools-import/server";
import { buildSchoolTemplate } from "@/lib/schools-import/workbook";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Connexion requise.", { status: 401 });
  // IPA ou exploitant de l'IPP sans cellule : aucun accès métier, même par appel direct.
  if (session.user.awaitingCell) return new Response("Compte en attente d'affectation à une cellule.", { status: 403 });

  const pools = await manageablePools(session.user.id);
  if (pools.length === 0) return new Response("Vous ne gérez les écoles d'aucun POOL.", { status: 403 });

  const body = await buildSchoolTemplate(pools);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="canevas-ecoles-ippnk1.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
