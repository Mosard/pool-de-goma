import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, Badge } from "@/components/ui";
import { School, Users, ClipboardList, FileCheck2 } from "lucide-react";

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

export default async function DashboardPage() {
  const session = await auth();
  const role = session!.user.role;
  const userId = session!.user.id;

  if (role === "CHEF_POOL") {
    const [schools, users, activeInspections, submittedReports] = await Promise.all([
      prisma.school.count(),
      prisma.user.count(),
      prisma.inspection.count({ where: { status: { in: ["PLANIFIEE", "EN_COURS"] } } }),
      prisma.report.count({ where: { status: { in: ["SOUMIS", "EN_REVUE"] } } }),
    ]);

    const recentReports = await prisma.report.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: { inspection: { include: { school: true, inspector: true } } },
    });

    return (
      <div>
        <PageHeader title="Tableau de bord" description="Vue d'ensemble du POOL d'inspection" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={School} label="Écoles enregistrées" value={schools} />
          <StatCard icon={Users} label="Utilisateurs" value={users} />
          <StatCard icon={ClipboardList} label="Inspections en cours" value={activeInspections} />
          <StatCard icon={FileCheck2} label="Rapports à traiter" value={submittedReports} />
        </div>
        <Card className="mt-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Derniers rapports</h2>
          <ReportsList reports={recentReports} />
        </Card>
      </div>
    );
  }

  if (role === "INSPECTEUR") {
    const [assigned, mine] = await Promise.all([
      prisma.assignment.count({ where: { inspectorId: userId, active: true } }),
      prisma.inspection.findMany({
        where: { inspectorId: userId },
        take: 5,
        orderBy: { updatedAt: "desc" },
        include: { school: true },
      }),
    ]);
    const inProgress = await prisma.inspection.count({
      where: { inspectorId: userId, status: { in: ["PLANIFIEE", "EN_COURS"] } },
    });

    return (
      <div>
        <PageHeader title="Mon tableau de bord" description="Vos écoles et inspections" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard icon={School} label="Écoles assignées" value={assigned} />
          <StatCard icon={ClipboardList} label="Inspections en cours" value={inProgress} />
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

  const pendingReports = await prisma.report.count({ where: { status: "SOUMIS" } });
  const recentReports = await prisma.report.findMany({
    take: 5,
    where: { status: { in: ["SOUMIS", "EN_REVUE", "VALIDE"] } },
    orderBy: { updatedAt: "desc" },
    include: { inspection: { include: { school: true, inspector: true } } },
  });

  return (
    <div>
      <PageHeader title="Tableau de bord" description="Rapports d'inspection à analyser" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={FileCheck2} label="Rapports en attente" value={pendingReports} />
      </div>
      <Card className="mt-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Derniers rapports</h2>
        <ReportsList reports={recentReports} />
      </Card>
    </div>
  );
}

function ReportsList({
  reports,
}: {
  reports: Array<{
    id: string;
    status: string;
    inspection: { school: { name: string }; inspector: { name: string } };
  }>;
}) {
  if (reports.length === 0) {
    return <p className="text-sm text-gray-500">Aucun rapport pour le moment.</p>;
  }
  return (
    <ul className="divide-y divide-gray-100">
      {reports.map((r) => (
        <li key={r.id} className="flex items-center justify-between py-3 text-sm">
          <div>
            <p className="font-medium text-gray-900">{r.inspection.school.name}</p>
            <p className="text-xs text-gray-500">Inspecteur : {r.inspection.inspector.name}</p>
          </div>
          <Badge color={r.status === "VALIDE" ? "green" : r.status === "SOUMIS" ? "orange" : "blue"}>
            {r.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
