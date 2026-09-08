import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { canManageSchools } from "@/lib/permissions";

export default async function EcolesPage() {
  const session = await auth();
  const role = session!.user.role;
  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { inspections: true, assignments: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Écoles"
        description={`${schools.length} école(s) enregistrée(s)`}
        actions={
          canManageSchools(role) ? (
            <Link href="/ecoles/nouveau">
              <Button>Nouvelle école</Button>
            </Link>
          ) : undefined
        }
      />

      {schools.length === 0 ? (
        <EmptyState message="Aucune école enregistrée pour le moment." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schools.map((school) => (
            <Link key={school.id} href={`/ecoles/${school.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{school.name}</h3>
                    <p className="text-xs text-gray-500">{school.code}</p>
                  </div>
                  <Badge color={school.active ? "green" : "gray"}>
                    {school.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="mt-4 space-y-1 text-sm text-gray-600">
                  <p>{school.province} — {school.territoire}</p>
                  {school.type && <p>{school.type}</p>}
                  {school.director && <p>Directeur : {school.director}</p>}
                </div>
                <div className="mt-4 flex gap-4 text-xs text-gray-400">
                  <span>{school._count.assignments} affectation(s)</span>
                  <span>{school._count.inspections} inspection(s)</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
