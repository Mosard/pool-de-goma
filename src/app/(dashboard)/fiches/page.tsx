import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { addFicheAction } from "@/app/(dashboard)/fiches/actions";
import { hasPermissionAnyPool } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/rbac-data";
import { resolveFicheDef } from "@/lib/fiches/defs/index";
import { ficheData, instanceLabel, proposedTemplates } from "@/lib/fiches/server";

// Fiches de période de l'inspecteur : plan et relevés d'activités, bordereau
// de transmission (A2, A3, A4, A6), rattachés à l'inspecteur et non à une école.
export default async function FichesDePeriodePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!hasPermissionAnyPool(user.permissions, PERMISSIONS.INSPECTIONS_CONDUCT)) redirect("/dashboard");

  const [templates, forms] = await Promise.all([
    proposedTemplates("periode"),
    prisma.form.findMany({
      where: { authorId: user.id, inspectionId: null },
      include: { formTemplate: true, report: { include: { status: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Fiches de période" description="Plan trimestriel (A2), relevés trimestriel (A3) et annuel (A4), bordereau de transmission (A6)" />

      <Card>
        <form action={addFicheAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium text-gray-700">
            Nouvelle fiche
            <select name="templateId" required className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Créer</Button>
        </form>
      </Card>

      {forms.length === 0 ? (
        <EmptyState message="Aucune fiche de période pour le moment." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-gray-100">
            {forms.map((f) => {
              const def = resolveFicheDef(f.formTemplate);
              const label = instanceLabel(def, ficheData(f));
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {f.formTemplate.title}
                      {label && <span className="font-normal text-gray-500"> — {f.formTemplate.code === "A2" || f.formTemplate.code === "A3" ? `trimestre ${label}` : label}</span>}
                    </p>
                    <p className="text-xs text-gray-400">{f.number ?? `Modifiée le ${f.updatedAt.toLocaleDateString("fr-FR")}`}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {f.report ? <Badge color={f.report.status.key === "A_CORRIGER" ? "red" : "blue"}>{f.report.status.label}</Badge> : <Badge color={f.completed ? "green" : "gray"}>{f.completed ? "Complète, à soumettre" : "Brouillon"}</Badge>}
                    <Link href={`/fiches/${f.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                      Ouvrir
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
