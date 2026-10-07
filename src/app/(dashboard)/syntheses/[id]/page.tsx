import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { eligibleReports, getSynthesis, loadActor, snapshotOf, type SourceSnapshot } from "@/lib/synthese/server";
import { formatOf, readContent } from "@/lib/synthese/format";
import { SYNTHESIS_STATUS_COLOR, SYNTHESIS_STATUS_LABELS, availableTransitions, canEdit, type SynthesisStatusKey } from "@/lib/synthese/rules";
import { SourcesForm, SynthesisEditor, SynthesisTransitions } from "../forms";

const fmtDate = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
const fmtDateTime = (d: Date) => d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

// Détail d'un rapport de synthèse : informations reprises des rapports
// d'origine (lien vers chacun), partie rédigée, circuit, historique et
// versions soumises. Lecture et actions contrôlées côté serveur.
export default async function SyntheseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const actor = await loadActor(session.user.id);
  const s = await getSynthesis(actor, id);
  if (!s) notFound();

  const status = s.status as SynthesisStatusKey;
  const editable = canEdit(actor, s.meta);
  const transitions = availableTransitions(actor, s.meta).map((t) => ({ to: t.to, label: t.label, commentRequired: t.commentRequired }));
  const sections = formatOf(s.formatVersion);
  const snapshots = s.sources.map((src) => ({ ...(src.snapshot as unknown as SourceSnapshot), current: src.report.status }));
  const lastReturn = [...s.statusHistory].reverse().find((h) => h.toStatus === "A_CORRIGER");

  // Rapports proposables pour modifier la sélection : admissibles + déjà retenus.
  const eligible = editable ? await eligibleReports(actor, { poolId: s.poolId }) : [];
  const options = [...eligible.map((r) => snapshotOf(r)), ...snapshots.filter((x) => !eligible.some((r) => r.id === x.reportId))].map(
    (x) => ({
      id: x.reportId,
      title: x.title,
      number: x.number,
      poolName: x.poolName,
      authorName: x.authorName,
      statusLabel: x.statusLabel,
      submittedAt: x.submittedAt,
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.title}
        description={[
          s.pool ? `POOL ${s.pool.name}` : "Synthèse provinciale",
          `Rédigée par ${s.author.name}`,
          s.reference,
          s.periodFrom || s.periodTo ? `Période : ${fmtDate(s.periodFrom)} – ${fmtDate(s.periodTo)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={<Badge color={SYNTHESIS_STATUS_COLOR[status]}>{SYNTHESIS_STATUS_LABELS[status]}</Badge>}
      />

      {status === "A_CORRIGER" && (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
          Renvoyée pour correction : <strong>« {lastReturn?.comment ?? "—"} »</strong>
          {editable ? " Corrigez puis resoumettez." : ""}
        </Card>
      )}

      <Card className="overflow-x-auto">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Repris des rapports d&apos;origine ({snapshots.length})</h2>
        <p className="mb-4 text-xs text-gray-500">
          Informations copiées automatiquement des rapports d&apos;inspection retenus (figées à la dernière soumission). Le statut actuel
          de chaque rapport est indiqué à part.
        </p>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
            <tr>
              <th className="py-2 pr-4">Fiche / École</th>
              <th className="py-2 pr-4">N°</th>
              <th className="py-2 pr-4">Inspecteur</th>
              <th className="py-2 pr-4">POOL</th>
              <th className="py-2 pr-4">Visite</th>
              <th className="py-2 pr-4">Soumis le</th>
              <th className="py-2 pr-4">Statut repris</th>
              <th className="py-2 pr-4">Statut actuel</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {snapshots.map((x) => (
              <tr key={x.reportId}>
                <td className="py-2 pr-4 font-medium text-gray-900">{x.title}</td>
                <td className="py-2 pr-4 text-xs text-gray-500">{x.number ?? "—"}</td>
                <td className="py-2 pr-4 text-gray-600">{x.authorName}</td>
                <td className="py-2 pr-4 text-gray-600">{x.poolName ?? "—"}</td>
                <td className="py-2 pr-4 text-gray-600">{fmtDate(x.inspectionDate)}</td>
                <td className="py-2 pr-4 text-gray-600">{fmtDate(x.submittedAt)}</td>
                <td className="py-2 pr-4 text-gray-600">{x.statusLabel}</td>
                <td className="py-2 pr-4 text-gray-600">{x.current.label}</td>
                <td className="py-2 text-right">
                  <Link href={`/rapports/${x.reportId}`} className="text-xs font-medium text-blue-600 hover:underline">
                    Voir le rapport
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editable ? (
        <>
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Rédaction de l&apos;exploitant</h2>
            <SynthesisEditor
              id={s.id}
              formatVersion={s.formatVersion}
              sections={sections}
              values={s.parsedContent.sections}
              title={s.title}
              periodFrom={isoDay(s.periodFrom)}
              periodTo={isoDay(s.periodTo)}
            />
          </Card>
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Rapports retenus</h2>
            <SourcesForm id={s.id} reports={options} selectedIds={snapshots.map((x) => x.reportId)} />
          </Card>
        </>
      ) : (
        <Card className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900">Rédaction de l&apos;exploitant</h2>
          {sections.map((sec) => (
            <section key={sec.key}>
              <h3 className="text-sm font-medium text-gray-900">{sec.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{s.parsedContent.sections[sec.key] || "—"}</p>
            </section>
          ))}
        </Card>
      )}

      {transitions.length > 0 && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Circuit</h2>
          <SynthesisTransitions id={s.id} transitions={transitions} />
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Historique du circuit</h2>
        <ol className="space-y-2 text-sm">
          {s.statusHistory.map((h) => (
            <li key={h.id} className="text-gray-700">
              <span className="text-gray-500">{fmtDateTime(h.createdAt)}</span> —{" "}
              {h.fromStatus ? `${SYNTHESIS_STATUS_LABELS[h.fromStatus as SynthesisStatusKey]} → ` : ""}
              <strong>{SYNTHESIS_STATUS_LABELS[h.toStatus as SynthesisStatusKey]}</strong>
              {h.version > 0 && <span className="text-gray-500"> (V{h.version})</span>} par {h.changedBy.name}
              {h.comment && <span className="block pl-4 text-gray-600">« {h.comment} »</span>}
            </li>
          ))}
        </ol>
      </Card>

      {s.versions.length > 0 && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Versions soumises</h2>
          <div className="space-y-2">
            {s.versions.map((v) => {
              const content = readContent(v.content);
              return (
                <details key={v.id} className="rounded-xl border border-gray-200 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-gray-900">
                    {s.number ? `${s.number}-V${v.number}` : `V${v.number}`} — soumise le {fmtDateTime(v.createdAt)} par {v.submittedBy.name}
                  </summary>
                  <div className="mt-3 space-y-3">
                    {sections.map((sec) => (
                      <section key={sec.key}>
                        <h3 className="text-xs font-medium uppercase text-gray-500">{sec.title}</h3>
                        <p className="whitespace-pre-wrap text-sm text-gray-700">{content.sections[sec.key] || "—"}</p>
                      </section>
                    ))}
                    <p className="text-xs text-gray-500">
                      {(v.sources as unknown as SourceSnapshot[]).length} rapport(s) d&apos;origine dans cette version.
                    </p>
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
