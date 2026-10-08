import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { loadUserAccess } from "@/lib/permissions";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { CellForm } from "./cell-form";
import { setCellActiveAction } from "./actions";

// Cellules de l'IPP : saisies par l'équipe métier. Chaque cellule a au plus
// un IPA responsable (chef de cellule, signataire), qui n'en dirige qu'une.
// Les exploitants s'y rattachent depuis « Gérer les accès ».
export default async function CellulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { permissions } = await loadUserAccess(session.user.id);
  if (!permissions.some((p) => p.permissionKey === PERMISSIONS.POOLS_MANAGE && p.poolId === null && !p.cellId)) redirect("/dashboard");
  const org = session.user.organizationId;

  const [cells, ipas, unattached] = await Promise.all([
    prisma.cell.findMany({
      where: { organizationId: org },
      orderBy: [{ active: "desc" }, { code: "asc" }],
      include: {
        ipa: { select: { id: true, name: true } },
        userRoles: { where: { role: { key: ROLE_KEYS.EXPLOITANT_IPP } }, select: { user: { select: { id: true, name: true, status: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { organizationId: org, isDemo: false, roles: { some: { role: { key: ROLE_KEYS.IPA } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, cellLed: { select: { code: true } } },
    }),
    // Exploitants de l'IPP sans cellule : AUCUN accès aux rapports de l'IPP tant qu'ils ne sont pas rattachés.
    prisma.user.findMany({
      where: { organizationId: org, roles: { some: { role: { key: ROLE_KEYS.EXPLOITANT_IPP }, cellId: null } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isDemo: true },
    }),
  ]);
  const ipaOptions = ipas.map((i) => ({ id: i.id, name: i.name, busyWith: i.cellLed?.code ?? null }));
  const ipasWithoutCell = ipas.filter((i) => !i.cellLed);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cellules de l'IPP"
        description="Chaque cellule est rattachée à un IPA ; ses exploitants ne voient que les rapports que le secrétariat lui envoie."
        actions={
          <Link href="/parametres">
            <Button type="button" variant="secondary">
              Retour aux paramètres
            </Button>
          </Link>
        }
      />

      {(unattached.length > 0 || ipasWithoutCell.length > 0) && (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
          {unattached.length > 0 && (
            <div>
              <p className="font-semibold">Exploitants de l&apos;IPP à rattacher à une cellule ({unattached.length})</p>
              <p className="mb-2 text-xs">Sans cellule, ces comptes ne voient aucun rapport de l&apos;IPP : c&apos;est voulu. Rattachez-les depuis « Gérer les accès ».</p>
              <ul className="space-y-1">
                {unattached.map((u) => (
                  <li key={u.id}>
                    <Link href={`/parametres/acces/${u.id}`} className="font-medium underline">
                      {u.name}
                    </Link>
                    {u.isDemo && <span className="text-xs"> (démonstration)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ipasWithoutCell.length > 0 && (
            <p className={unattached.length > 0 ? "mt-3" : ""}>
              IPA sans cellule (aucun rapport de l&apos;IPP visible) : {ipasWithoutCell.map((i) => i.name).join(", ")}.
            </p>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Nouvelle cellule</h2>
        <CellForm ipas={ipaOptions} />
      </Card>

      {cells.length === 0 ? (
        <EmptyState message="Aucune cellule saisie pour le moment." />
      ) : (
        cells.map((c) => (
          <Card key={c.id} className={c.active ? "" : "opacity-70"}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">
                {c.code} — {c.name} {!c.active && <Badge color="gray">Archivée</Badge>}
              </h2>
              <form action={setCellActiveAction.bind(null, c.id, !c.active)}>
                <Button type="submit" variant={c.active ? "danger" : "secondary"} className="!min-h-0 !px-3 !py-1 text-xs">
                  {c.active ? "Archiver" : "Réactiver"}
                </Button>
              </form>
            </div>
            {c.active && <CellForm cell={{ id: c.id, code: c.code, name: c.name, ipaId: c.ipaId }} ipas={ipaOptions} />}
            <p className="mt-3 text-xs text-gray-600">
              IPA : {c.ipa?.name ?? "à désigner"} · Exploitants :{" "}
              {c.userRoles.length === 0 ? "aucun" : c.userRoles.map((ur) => ur.user.name + (ur.user.status === "ACTIVE" ? "" : " (inactif)")).join(", ")}
            </p>
          </Card>
        ))
      )}
    </div>
  );
}
