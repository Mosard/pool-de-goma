import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, EmptyState, Notice, PageHeader, SectionTitle, SubHeading } from "@/components/ui";
import { loadUserAccess } from "@/lib/permissions";
import { PERMISSIONS, ROLE_KEYS } from "@/lib/rbac-data";
import { CELL_MANDATE_LABELS } from "@/lib/cells/rules";
import { holdsPersonnelCellManage } from "@/lib/cells/personnel";
import { CellForm } from "./cell-form";
import { MandateForm, PersonnelIpaForm } from "./personnel-forms";
import { setCellActiveAction } from "./actions";

// Cellules de l'IPP : saisies par l'équipe métier. Chaque cellule a au plus
// un IPA responsable (chef de cellule, signataire), qui n'en dirige qu'une.
// Les exploitants s'y rattachent depuis « Gérer les accès ».
export default async function CellulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { permissions } = await loadUserAccess(session.user.id);
  const org = session.user.organizationId;
  // Gestion des cellules (pools.manage) ; vocation et responsable de la cellule
  // du personnel (cells.personnel.manage, décision Q-A du 2026-10-10).
  const canManageCells = permissions.some((p) => p.permissionKey === PERMISSIONS.POOLS_MANAGE && p.poolId === null && !p.cellId);
  const canManagePersonnel = holdsPersonnelCellManage(permissions, org);
  if (!canManageCells && !canManagePersonnel) redirect("/dashboard");

  const [cells, ipas, unattached] = await Promise.all([
    prisma.cell.findMany({
      where: { organizationId: org },
      orderBy: [{ active: "desc" }, { code: "asc" }],
      include: {
        ipa: { select: { id: true, name: true, status: true, roles: { where: { role: { key: ROLE_KEYS.IPA } }, select: { id: true } } } },
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
  const personnelCells = cells.filter((c) => c.active && c.mandate === "PERSONNEL");
  const ipasWithoutCell = ipas.filter((i) => !i.cellLed);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cellules de l'IPP"
        description="Chaque cellule est rattachée à un IPA ; ses exploitants ne voient que les rapports que le secrétariat lui envoie."
      />

      {unattached.length > 0 && (
        <Notice tone="warning" title={`Exploitants de l'IPP à rattacher à une cellule (${unattached.length})`}>
          <p className="text-xs">Sans cellule, ces comptes ne voient aucun rapport de l&apos;IPP : c&apos;est voulu. Rattachez-les depuis « Gérer les accès ».</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {unattached.map((u) => (
              <li key={u.id}>
                <Link href={`/parametres/acces/${u.id}`} className="font-medium underline underline-offset-2">
                  {u.name}
                </Link>
                {u.isDemo && <span className="text-xs"> (démonstration)</span>}
              </li>
            ))}
          </ul>
        </Notice>
      )}
      {ipasWithoutCell.length > 0 && (
        <Notice tone="warning" title="IPA sans cellule (aucun rapport de l'IPP visible)">
          <p>{ipasWithoutCell.map((i) => i.name).join(", ")}.</p>
        </Notice>
      )}

      {personnelCells.length > 1 && (
        <Notice tone="danger" title="Plusieurs cellules « Gestion du personnel » actives">
          <p>
            {personnelCells.map((c) => c.code).join(", ")} : aucun responsable ne reçoit les pouvoirs de gestion du personnel tant qu&apos;il en reste plus d&apos;une.
          </p>
        </Notice>
      )}

      {canManageCells && (
        <Card>
          <SectionTitle title="Nouvelle cellule" description="Sigle, intitulé et IPA responsable ; un IPA ne dirige qu'une cellule." />
          <CellForm ipas={ipaOptions} allowPersonnelMandate={canManagePersonnel} />
        </Card>
      )}

      {cells.length === 0 ? (
        <EmptyState message="Aucune cellule saisie pour le moment." />
      ) : (
        cells.map((c) => (
          <Card key={c.id} className={c.active ? "space-y-4" : "space-y-4 bg-gray-50/60"}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900">
                  <span className="mr-2 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-800">{c.code}</span>
                  {c.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                  <Badge color={c.mandate === "PERSONNEL" ? "blue" : "gray"}>{CELL_MANDATE_LABELS[c.mandate]}</Badge>
                  {!c.active && <Badge color="gray">Archivée</Badge>}
                </div>
              </div>
              {canManageCells && (
                <form action={setCellActiveAction.bind(null, c.id, !c.active)}>
                  <Button type="submit" variant={c.active ? "danger" : "outline"} size="sm">
                    {c.active ? "Archiver" : "Réactiver"}
                  </Button>
                </form>
              )}
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">IPA responsable</dt>
                <dd className={c.ipa ? "font-medium text-gray-900" : "text-amber-700"}>{c.ipa?.name ?? "À désigner"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Exploitants ({c.userRoles.length})</dt>
                <dd className="text-gray-900">
                  {c.userRoles.length === 0 ? (
                    <span className="text-gray-400">Aucun</span>
                  ) : (
                    c.userRoles.map((ur) => ur.user.name + (ur.user.status === "ACTIVE" ? "" : " (inactif)")).join(", ")
                  )}
                </dd>
              </div>
            </dl>

            {c.active && c.mandate === "PERSONNEL" && c.ipa && (c.ipa.status !== "ACTIVE" || c.ipa.roles.length === 0) && (
              <Notice tone="danger">
                <p>Responsable enregistré sans compte actif ou sans fonction d&apos;IPA : il n&apos;exerce aucun pouvoir du personnel.</p>
              </Notice>
            )}

            {c.active && canManageCells && (
              <div className="border-t border-gray-100 pt-4">
                <SubHeading className="mb-3">Modifier la cellule</SubHeading>
                <CellForm cell={{ id: c.id, code: c.code, name: c.name, ipaId: c.ipaId }} ipas={ipaOptions} />
              </div>
            )}
            {c.active && canManagePersonnel && (
              <div className="space-y-3 rounded-xl border border-gray-200 p-4">
                <SubHeading>Gestion du personnel</SubHeading>
                <MandateForm cellId={c.id} mandate={c.mandate} />
                {c.mandate === "PERSONNEL" && !canManageCells && <PersonnelIpaForm cellId={c.id} cellCode={c.code} ipaId={c.ipaId} ipas={ipaOptions} />}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
