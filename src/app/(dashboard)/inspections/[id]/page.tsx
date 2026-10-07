import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { addFicheAction } from "@/app/(dashboard)/fiches/actions";
import { canReadScope } from "@/lib/fiches/report-scope";
import { MODULE_LABELS, resolveFicheDef } from "@/lib/fiches/defs/index";
import { ficheData, instanceLabel, proposedTemplates } from "@/lib/fiches/server";

const INSPECTION_STATUS: Record<string, { label: string; color: "gray" | "blue" | "green" | "orange" }> = {
  PLANIFIEE: { label: "Planifiée", color: "gray" },
  EN_COURS: { label: "En cours", color: "blue" },
  TERMINEE: { label: "Terminée", color: "orange" },
  RAPPORT_SOUMIS: { label: "Fiches soumises", color: "orange" },
  VALIDEE: { label: "Validée", color: "green" },
};

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      school: { include: { pool: true } },
      inspector: true,
      report: { include: { status: true } },
      forms: { include: { formTemplate: true, report: { include: { status: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!inspection) notFound();
  if (!canReadScope(user, { poolId: inspection.school.poolId, organizationId: inspection.school.pool.organizationId, authorId: inspection.inspectorId })) {
    notFound();
  }

  const isOwner = inspection.inspectorId === user.id;
  const templates = isOwner ? await proposedTemplates("visite") : [];
  const status = INSPECTION_STATUS[inspection.status];

  return (
    <div className="space-y-6">
      <PageHeader
        title={inspection.school.name}
        description={`Inspecteur : ${inspection.inspector.name} · POOL ${inspection.school.pool.name}`}
        actions={<Badge color={status.color}>{status.label}</Badge>}
      />

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Fiches de la visite</h3>
        <p className="mb-4 text-xs text-gray-500">
          École globale : toutes les fiches de la visite. Chaque fiche est soumise et suit le circuit séparément ; plusieurs exemplaires sont possibles (un C3 par enseignant, un A5 par absent).
        </p>
        {inspection.forms.length === 0 ? (
          <EmptyState message="Aucune fiche pour cette visite." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {inspection.forms.map((f) => {
              const def = resolveFicheDef(f.formTemplate);
              const label = instanceLabel(def, ficheData(f));
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {f.formTemplate.title}
                      {label && <span className="font-normal text-gray-500"> — {label}</span>}
                    </p>
                    <p className="text-xs text-gray-400">{f.number ?? "Numéro attribué à la soumission"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {f.report ? (
                      <Badge color={f.report.status.key === "A_CORRIGER" ? "red" : f.report.status.key === "VALIDE" ? "green" : "blue"}>{f.report.status.label}</Badge>
                    ) : (
                      <Badge color={f.completed ? "green" : "gray"}>{f.completed ? "Complète, à soumettre" : "Brouillon"}</Badge>
                    )}
                    <Link href={`/fiches/${f.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                      Ouvrir
                    </Link>
                    {f.report && (
                      <a href={`/rapports/${f.report.id}/pdf`} target="_blank" rel="noopener" className="text-xs font-medium text-blue-600 hover:underline">
                        PDF
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {isOwner && templates.length > 0 && (
          <form action={addFicheAction} className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-end">
            <input type="hidden" name="inspectionId" value={inspection.id} />
            <label className="flex-1 text-sm font-medium text-gray-700">
              Ajouter une fiche
              <select name="templateId" required className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm">
                {(["C", "A", "F", "T"] as const).map((m) => {
                  const group = templates.filter((t) => (t.module ?? "") === m);
                  return group.length ? (
                    <optgroup key={m} label={MODULE_LABELS[m]}>
                      {group.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
                {templates.some((t) => !t.module) && (
                  <optgroup label="Fiches simulées (provisoires)">
                    {templates
                      .filter((t) => !t.module)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </label>
            <Button type="submit">Ajouter</Button>
          </form>
        )}
      </Card>

      {inspection.report && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Rapport d&apos;inspection (ancien circuit)</h3>
          <p className="text-sm text-gray-700">{inspection.report.summary}</p>
          {inspection.report.recommendations && <p className="mt-2 text-sm text-gray-500">Recommandations : {inspection.report.recommendations}</p>}
          <p className="mt-2 text-xs text-gray-400">Statut actuel : {inspection.report.status.label}</p>
          <Link href={`/rapports/${inspection.report.id}`} className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">
            Ouvrir le rapport
          </Link>
        </Card>
      )}
    </div>
  );
}
