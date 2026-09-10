import Link from "next/link";
import { clsx } from "clsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge } from "@/components/ui";
import { School, Users, ClipboardList, FileCheck2, AlertTriangle } from "lucide-react";
import { PERMISSIONS, ROLE_KEYS, WORKFLOW_STATUS_KEYS } from "@/lib/rbac-data";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { PoolActivityChart } from "@/components/pool-activity-chart";

const PENDING_KEYS: string[] = [
  WORKFLOW_STATUS_KEYS.SOUMIS,
  WORKFLOW_STATUS_KEYS.RECU,
  WORKFLOW_STATUS_KEYS.EN_EXPLOITATION,
  WORKFLOW_STATUS_KEYS.A_CORRIGER,
  WORKFLOW_STATUS_KEYS.TRANSMIS,
  WORKFLOW_STATUS_KEYS.EN_ATTENTE_VALIDATION,
];
const VALIDATED_KEYS: string[] = [WORKFLOW_STATUS_KEYS.VALIDE, WORKFLOW_STATUS_KEYS.CLOTURE];

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ poolId?: string; inspecteurId?: string }>;
}) {
  const session = await auth();
  const user = session!.user;
  const { poolId: selectedPoolId, inspecteurId: selectedInspectorId } = await searchParams;

  const isProvinceScoped = user.permissions.some((p) => p.poolId === null);

  if (isProvinceScoped) {
    const [schools, activeUsers, realizedInspections, pendingReports, toValidateReports, validatedReports, alertsCount, pools] =
      await Promise.all([
        prisma.school.count(),
        prisma.user.count({ where: { status: "ACTIVE" } }),
        prisma.inspection.count({ where: { completedAt: { not: null } } }),
        prisma.report.count({ where: { status: { key: { in: PENDING_KEYS } } } }),
        prisma.report.count({ where: { status: { key: WORKFLOW_STATUS_KEYS.EN_ATTENTE_VALIDATION } } }),
        prisma.report.count({ where: { status: { key: { in: VALIDATED_KEYS } } } }),
        prisma.report.count({ where: { status: { key: WORKFLOW_STATUS_KEYS.A_CORRIGER } } }),
        prisma.pool.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      ]);

    const poolStats = await Promise.all(
      pools.map(async (pool) => {
        const [schoolCount, reportCount, pendingCount] = await Promise.all([
          prisma.school.count({ where: { poolId: pool.id } }),
          prisma.report.count({ where: { inspection: { school: { poolId: pool.id } } } }),
          prisma.report.count({
            where: { inspection: { school: { poolId: pool.id } }, status: { key: { in: PENDING_KEYS } } },
          }),
        ]);
        return { pool, schoolCount, reportCount, pendingCount };
      })
    );

    return (
      <div className="space-y-6">
        <PageHeader
          title="Tableau de bord provincial"
          description="Vue d'ensemble de l'Inspection Principale Provinciale — Nord-Kivu 1"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={School} label="Écoles enregistrées" value={schools} />
          <StatCard icon={Users} label="Utilisateurs actifs" value={activeUsers} />
          <StatCard icon={ClipboardList} label="Inspections réalisées" value={realizedInspections} />
          <StatCard icon={FileCheck2} label="Rapports en attente" value={pendingReports} />
          <StatCard icon={FileCheck2} label="Rapports à valider" value={toValidateReports} />
          <StatCard icon={FileCheck2} label="Rapports validés" value={validatedReports} />
        </div>

        {alertsCount > 0 && (
          <Card className="mt-4 flex items-center gap-3 border-amber-200 bg-amber-50">
            <AlertTriangle size={20} className="text-amber-600" strokeWidth={1.75} />
            <p className="text-sm text-amber-800">
              {alertsCount} rapport{alertsCount > 1 ? "s" : ""} en attente de correction par un inspecteur.
            </p>
          </Card>
        )}

        <Card className="mt-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Activité par pool</h2>
          {poolStats.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun pool actif pour le moment.</p>
          ) : (
            <PoolActivityChart
              data={poolStats.map(({ pool, reportCount, pendingCount }) => ({
                pool: pool.name,
                rapports: reportCount,
                aTraiter: pendingCount,
              }))}
            />
          )}
        </Card>

        <Card className="mt-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Comparaison par pool</h2>
          {poolStats.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun pool actif pour le moment.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                <tr>
                  <th className="py-2">Pool</th>
                  <th className="py-2">Écoles</th>
                  <th className="py-2">Rapports</th>
                  <th className="py-2">À traiter</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {poolStats.map(({ pool, schoolCount, reportCount, pendingCount }) => (
                  <tr key={pool.id} className={clsx(selectedPoolId === pool.id && "bg-blue-50/60")}>
                    <td className="py-2 font-medium text-gray-900">{pool.name}</td>
                    <td className="py-2">{schoolCount}</td>
                    <td className="py-2">{reportCount}</td>
                    <td className="py-2">{pendingCount}</td>
                    <td className="py-2 text-right">
                      <Link href={`/dashboard?poolId=${pool.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                        Explorer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {selectedPoolId && <PoolExplorer poolId={selectedPoolId} selectedInspectorId={selectedInspectorId} />}
      </div>
    );
  }

  const canManagePool =
    user.poolId &&
    (hasPermissionAnyPool(user.permissions, PERMISSIONS.SCHOOLS_MANAGE) ||
      hasPermissionAnyPool(user.permissions, PERMISSIONS.ASSIGNMENTS_MANAGE) ||
      hasPermissionAnyPool(user.permissions, PERMISSIONS.REPORTS_REVIEW_POOL));

  if (canManagePool && user.poolId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tableau de bord du pool" description="Vue d'ensemble de votre pool d'inspection" />
        <PoolExplorer poolId={user.poolId} selectedInspectorId={selectedInspectorId} />
      </div>
    );
  }

  const [assigned, mine, inspectedSchoolIds] = await Promise.all([
    prisma.assignment.count({ where: { inspectorId: user.id, active: true } }),
    prisma.inspection.findMany({
      where: { inspectorId: user.id },
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: { school: true },
    }),
    prisma.inspection.findMany({
      where: { inspectorId: user.id },
      distinct: ["schoolId"],
      select: { schoolId: true },
    }),
  ]);

  const aFaire = Math.max(assigned - inspectedSchoolIds.length, 0);
  const enCours = await prisma.inspection.count({ where: { inspectorId: user.id, status: "EN_COURS" } });
  const aCompleter = await prisma.inspection.count({ where: { inspectorId: user.id, status: "PLANIFIEE" } });
  const envoyees = await prisma.inspection.count({
    where: { inspectorId: user.id, status: { in: ["RAPPORT_SOUMIS", "VALIDEE"] } },
  });

  return (
    <div>
      <PageHeader
        title="Mon tableau de bord"
        description="Vos écoles et inspections"
        actions={
          <Link href="/inspections">
            <span className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
              Nouvelle inspection
            </span>
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={School} label="À faire" value={aFaire} />
        <StatCard icon={ClipboardList} label="En cours" value={enCours} />
        <StatCard icon={FileCheck2} label="Envoyées" value={envoyees} />
        <StatCard icon={FileCheck2} label="À compléter" value={aCompleter} />
      </div>
      <Card className="mt-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Mes dernières inspections</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune inspection pour le moment.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {mine.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium text-gray-900">{i.school.name}</span>
                <Badge color="blue">{i.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function PoolExplorer({
  poolId,
  selectedInspectorId,
}: {
  poolId: string;
  selectedInspectorId?: string;
}) {
  const pool = await prisma.pool.findUnique({ where: { id: poolId } });
  if (!pool) return <Card><p className="text-sm text-gray-500">Pool introuvable.</p></Card>;

  const [schools, inspectors, pendingReports, validatedReports] = await Promise.all([
    prisma.school.count({ where: { poolId } }),
    prisma.user.findMany({
      where: { poolId, roles: { some: { role: { key: ROLE_KEYS.INSPECTEUR } } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.report.count({ where: { inspection: { school: { poolId } }, status: { key: { in: PENDING_KEYS } } } }),
    prisma.report.count({ where: { inspection: { school: { poolId } }, status: { key: { in: VALIDATED_KEYS } } } }),
  ]);

  const inspectorStats = await Promise.all(
    inspectors.map(async (insp) => ({
      ...insp,
      reportCount: await prisma.report.count({ where: { inspection: { inspectorId: insp.id } } }),
    }))
  );

  const selectedReports = selectedInspectorId
    ? await prisma.report.findMany({
        where: { inspection: { inspectorId: selectedInspectorId, school: { poolId } } },
        orderBy: { updatedAt: "desc" },
        include: { status: true, inspection: { include: { school: true } } },
      })
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Pool {pool.name}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={School} label="Écoles" value={schools} />
          <StatCard icon={FileCheck2} label="Rapports à traiter" value={pendingReports} />
          <StatCard icon={FileCheck2} label="Rapports validés" value={validatedReports} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Inspecteurs itinérants</h2>
        {inspectorStats.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun inspecteur rattaché à ce pool.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {inspectorStats.map((insp) => (
              <li key={insp.id} className="flex items-center justify-between py-3 text-sm">
                <span className={clsx("font-medium", insp.id === selectedInspectorId ? "text-blue-600" : "text-gray-900")}>
                  {insp.name}
                </span>
                <div className="flex items-center gap-3">
                  <Badge color="blue">{insp.reportCount} rapport(s)</Badge>
                  <Link
                    href={`/dashboard?poolId=${poolId}&inspecteurId=${insp.id}`}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Voir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selectedInspectorId && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Rapports de l&apos;inspecteur sélectionné</h2>
          {selectedReports.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun rapport pour le moment.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {selectedReports.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium text-gray-900">{r.inspection.school.name}</span>
                  <div className="flex items-center gap-3">
                    <Badge color="blue">{r.status.label}</Badge>
                    <Link href={`/rapports/${r.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                      Ouvrir
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
