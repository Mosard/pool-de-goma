import Link from "next/link";
import { redirect } from "next/navigation";
import { clsx } from "clsx";
import { AlertTriangle, ExternalLink, FileText, History } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Alert, Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";
import { ForbiddenError, loadUserAccess } from "@/lib/permissions";
import { analysisInScope, requireAiScope, resolveAiPool, type AiScope } from "@/lib/ai/scope";
import { canActOnAiProblem, canDesignateAiService } from "@/lib/ai/authority";
import { loadAiReports } from "@/lib/ai/reports";
import { computeAiStats } from "@/lib/ai/stats";
import { defaultAiPeriod, formatAiDay, formatAiRange, parseAiPeriod } from "@/lib/ai/period";
import {
  AI_GRAVITY_LABELS,
  AI_GRAVITY_STYLES,
  AI_REACTION_LABELS,
  AI_STATUS_COLORS,
  AI_STATUS_LABELS,
  type AiSource,
} from "@/lib/ai/meta";
import { CompareChart, TrendChart } from "./ai-charts";
import { AnalysisLauncher } from "./analysis-launcher";
import { ReactionPanel, ServicePicker } from "./reaction-panel";

// L'analyse (étage 2) est lancée par une action de cette page : elle peut
// durer plusieurs minutes (voir REQUEST_TIMEOUT_MS dans src/lib/ai/analyze.ts).
export const maxDuration = 300;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Lubumbashi",
});

function scopeName(scope: AiScope, poolId: string | null): string {
  if (!poolId) return "Toute l'inspection";
  return `POOL ${scope.pools.find((p) => p.id === poolId)?.name ?? ""}`.trim();
}

export default async function IaPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  let scope: AiScope;
  try {
    scope = await requireAiScope(userId);
  } catch (e) {
    if (e instanceof ForbiddenError) redirect("/dashboard");
    throw e;
  }

  const sp = await searchParams;
  let poolId: string | null;
  try {
    poolId = resolveAiPool(scope, one(sp.pool));
  } catch (e) {
    if (e instanceof ForbiddenError) redirect("/ia");
    throw e;
  }
  const requestedPeriod = parseAiPeriod(one(sp.du), one(sp.au));
  const period = requestedPeriod ?? parseAiPeriod(defaultAiPeriod().du, defaultAiPeriod().au)!;
  const label = scopeName(scope, poolId);

  const [reports, analyses, access, attributions] = await Promise.all([
    loadAiReports({ organizationId: scope.organizationId, poolId, cellId: scope.cellId, from: period.from, to: period.to, isDemo: scope.isDemo }),
    prisma.aiAnalysis.findMany({
      // Analyses de SA cellule pour un IPA ; jamais celles d'une cellule pour les autres.
      where: { organizationId: scope.organizationId, poolId, cellId: scope.cellId, isDemo: scope.isDemo },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        createdAt: true,
        periodFrom: true,
        periodTo: true,
        reportIds: true,
        author: { select: { name: true } },
        _count: { select: { problems: true } },
      },
    }),
    loadUserAccess(userId),
    prisma.directionAttribution.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: [{ position: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    }),
  ]);

  const stats = computeAiStats(reports, one(sp.indicateur) ?? null, period);
  const unit = stats.indicator?.kind === "yes" ? " %" : "";

  // Analyse affichée : celle demandée (si elle est dans le périmètre), sinon
  // la dernière réussie de ce périmètre.
  const selectedId = one(sp.analyse) ?? analyses.find((a) => a.status === "REUSSIE")?.id ?? null;
  const selected = selectedId
    ? await prisma.aiAnalysis.findUnique({
        where: { id: selectedId },
        include: {
          author: { select: { name: true } },
          pool: { select: { name: true } },
          problems: {
            orderBy: { rank: "asc" },
            include: {
              attribution: { select: { id: true, label: true, holderId: true, holder: { select: { name: true } } } },
              reactions: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
            },
          },
        },
      })
    : null;
  const analysis = selected && analysisInScope(scope, selected) && selected.isDemo === scope.isDemo ? selected : null;
  const canDesignate = canDesignateAiService(access);

  const counts = analysis
    ? (["PROPOSEE", "VALIDEE", "AJUSTEE", "REJETEE"] as const).map((s) => ({
        s,
        n: analysis.problems.filter((p) => p.status === s).length,
      }))
    : [];

  const filterQuery = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ du: period.du, au: period.au, ...extra });
    if (poolId && scope.allPools) p.set("pool", poolId);
    if (stats.indicator) p.set("indicateur", stats.indicator.key);
    return `/ia?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="IA — analyse des rapports" description={`${label} · ${formatAiRange(period.from, period.to)}`} />

      {!requestedPeriod && (one(sp.du) || one(sp.au)) && (
        <Alert variant="error">Période invalide : la période par défaut (six derniers mois) est affichée.</Alert>
      )}

      {/* Synthèse de l'analyse affichée, en tête de page */}
      <Card className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-base font-semibold text-gray-900">Synthèse</h2>
          {analysis && (
            <p className="text-xs text-gray-500">
              Analyse du {DATE_TIME.format(analysis.createdAt)} par {analysis.author.name} ·{" "}
              {analysis.pool ? `POOL ${analysis.pool.name}` : "Toute l'inspection"} ·{" "}
              {formatAiRange(analysis.periodFrom, analysis.periodTo)} · {analysis.reportIds.length} rapport(s)
            </p>
          )}
        </div>
        {analysis ? (
          analysis.status === "REUSSIE" ? (
            <>
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">{analysis.synthese}</p>
              {Array.isArray(analysis.limites) && analysis.limites.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Limites des données</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-700">
                    {(analysis.limites as string[]).map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {counts.map(({ s, n }) => (
                  <Badge key={s} color={AI_STATUS_COLORS[s]}>
                    {n} {AI_STATUS_LABELS[s].toLowerCase()}
                  </Badge>
                ))}
              </div>
            </>
          ) : (
            <Alert variant="error">Cette analyse a échoué : {analysis.error}</Alert>
          )
        ) : (
          <p className="text-sm text-gray-500">Aucune analyse IA pour ce périmètre. Lancez-en une sur la période affichée.</p>
        )}
        <div className="border-t border-gray-100 pt-4">
          <AnalysisLauncher
            pool={poolId}
            du={period.du}
            au={period.au}
            scopeLabel={`${label}, ${formatAiRange(period.from, period.to)}`}
            reportCount={reports.length}
          />
        </div>
      </Card>

      {/* Filtres : une seule ligne au-dessus des graphiques */}
      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          {scope.allPools && (
            <div className="min-w-[10rem]">
              <Label htmlFor="pool" className="text-xs">
                Périmètre
              </Label>
              <Select id="pool" name="pool" defaultValue={poolId ?? ""}>
                <option value="">Toute l&apos;inspection</option>
                {scope.pools.map((p) => (
                  <option key={p.id} value={p.id}>
                    POOL {p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="du" className="text-xs">
              Du
            </Label>
            <Input id="du" name="du" type="date" defaultValue={period.du} />
          </div>
          <div>
            <Label htmlFor="au" className="text-xs">
              Au
            </Label>
            <Input id="au" name="au" type="date" defaultValue={period.au} />
          </div>
          {stats.indicators.length > 0 && (
            <div className="min-w-[14rem] flex-1">
              <Label htmlFor="indicateur" className="text-xs">
                Indicateur
              </Label>
              <Select id="indicateur" name="indicateur" defaultValue={stats.indicator?.key}>
                {stats.indicators.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button type="submit" variant="secondary" className="!min-h-0 px-4 py-2.5">
            Afficher
          </Button>
        </form>
      </Card>

      {/* Étage 1 : chiffres calculés sur les champs structurés */}
      <section className="space-y-4" aria-labelledby="chiffres">
        <h2 id="chiffres" className="text-base font-semibold text-gray-900">
          Chiffres des rapports <span className="font-normal text-gray-500">(calculés, sans IA)</span>
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Rapports", value: stats.totals.rapports },
            { label: "Sites (écoles)", value: stats.totals.sites },
            { label: "POOL", value: stats.totals.pools },
          ].map((t) => (
            <Card key={t.label} className="p-4">
              <p className="text-xs text-gray-500">{t.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{t.value.toLocaleString("fr-FR")}</p>
            </Card>
          ))}
        </div>

        {reports.length === 0 ? (
          <EmptyState message="Aucun rapport soumis sur cette période et ce périmètre." />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900">Rapports par mois</h3>
                <TrendChart data={stats.trend} measure="rapports" />
              </Card>
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  {stats.indicator ? `${stats.indicator.label} — par mois` : "Indicateur par mois"}
                </h3>
                {stats.indicator ? (
                  <TrendChart data={stats.trend} measure="valeur" unit={unit} />
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500">Aucun champ chiffré dans les fiches.</p>
                )}
              </Card>
            </div>

            {stats.indicator && (
              <div className="grid gap-4 lg:grid-cols-2">
                {stats.byPool.length > 1 && (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Comparaison entre POOL</h3>
                    <p className="text-xs text-gray-500">{stats.indicator.label}</p>
                    <CompareChart data={stats.byPool} measure="valeur" unit={unit} />
                  </Card>
                )}
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900">Comparaison entre sites</h3>
                  <p className="text-xs text-gray-500">
                    {stats.indicator.label} ·{" "}
                    {stats.bySchool.length < stats.totals.sites
                      ? `les ${stats.bySchool.length} sites les plus inspectés`
                      : "tous les sites"}
                  </p>
                  <CompareChart data={stats.bySchool} measure="valeur" unit={unit} />
                </Card>
              </div>
            )}

            <details className="rounded-2xl border border-gray-200 bg-white p-4 text-sm">
              <summary className="cursor-pointer font-medium text-gray-700">Voir les chiffres en tableau</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="py-1 pr-3">Groupe</th>
                      <th className="py-1 pr-3">Rapports</th>
                      <th className="py-1 pr-3">{stats.indicator?.label ?? "Indicateur"}</th>
                      <th className="py-1">n</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 tabular-nums">
                    {[
                      ...stats.trend.map((p) => ({ ...p, g: "Mois" })),
                      ...stats.byPool.map((p) => ({ ...p, g: "POOL" })),
                      ...stats.bySchool.map((p) => ({ ...p, g: "Site" })),
                    ].map((p, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-3 text-gray-800">
                          <span className="text-gray-400">{p.g} · </span>
                          {p.label}
                        </td>
                        <td className="py-1 pr-3">{p.rapports}</td>
                        <td className="py-1 pr-3">{p.valeur === null ? "—" : `${p.valeur.toLocaleString("fr-FR")}${unit}`}</td>
                        <td className="py-1">{p.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>

      {/* Étage 2 : problèmes proposés par l'analyse IA */}
      {analysis?.status === "REUSSIE" && (
        <section className="space-y-4" aria-labelledby="problemes">
          <h2 id="problemes" className="text-base font-semibold text-gray-900">
            Problèmes et décisions proposées{" "}
            <span className="font-normal text-gray-500">(par priorité — propositions soumises à validation)</span>
          </h2>
          {analysis.problems.length === 0 ? (
            <EmptyState message="L'analyse n'a relevé aucun problème à signaler." />
          ) : (
            analysis.problems.map((p, index) => {
              const style = AI_GRAVITY_STYLES[p.gravite];
              const sources = (Array.isArray(p.sources) ? p.sources : []) as AiSource[];
              const sites = (Array.isArray(p.sites) ? p.sites : []) as string[];
              const canAct = canActOnAiProblem({ userId, roles: access.roles }, analysis, p);
              const finalDecision = p.decisionAjustee ?? p.decisionProposee;
              return (
                <Card key={p.id} className={clsx("space-y-4 border-l-4 p-5", style.edge)}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-400">Priorité {index + 1}</p>
                      <h3 className="text-base font-semibold text-gray-900">{p.titre}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", style.badge)}
                      >
                        {p.gravite === "CRITIQUE" && <AlertTriangle size={12} aria-hidden />}
                        Gravité : {AI_GRAVITY_LABELS[p.gravite]}
                      </span>
                      <Badge color={AI_STATUS_COLORS[p.status]}>{AI_STATUS_LABELS[p.status]}</Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Constat</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{p.constat}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {p.nbRapports} rapport(s) · {sites.length} site(s)
                      {sites.length ? ` : ${sites.join(", ")}` : ""} · {p.periode}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sources</p>
                    <ul className="mt-1 space-y-2">
                      {sources.map((s, i) => {
                        const known = analysis.reportIds.includes(s.rapport_id);
                        return (
                          <li key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                            <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                              {known ? (
                                <Link
                                  href={`/rapports/${s.rapport_id}`}
                                  className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                                >
                                  <FileText size={12} aria-hidden /> Ouvrir le rapport
                                  <ExternalLink size={11} aria-hidden />
                                </Link>
                              ) : (
                                <span className="font-medium">Repère de travail {s.rapport_id} (non officiel)</span>
                              )}
                              <span>{s.site}</span>
                              <span>{s.date}</span>
                            </p>
                            {s.extrait && <p className="mt-1 text-gray-800">« {s.extrait} »</p>}
                            {s.traduction && s.traduction !== s.extrait && (
                              <p className="mt-0.5 text-gray-600">
                                <span className="text-xs font-medium text-gray-500">Traduction : </span>
                                {s.traduction}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Hypothèse sur la cause</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{p.hypothese}</p>
                      {p.aVerifier && (
                        <p className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">À vérifier : </span>
                          {p.aVerifier}
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-gray-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {p.status === "AJUSTEE" ? "Décision retenue (ajustée)" : "Décision proposée"}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm font-medium text-gray-900">{finalDecision}</p>
                      {p.status === "AJUSTEE" && (
                        <p className="mt-1 text-xs text-gray-500">Proposition initiale : {p.decisionProposee}</p>
                      )}
                      <dl className="mt-2 space-y-1 text-xs text-gray-600">
                        <div>
                          <dt className="inline font-medium">Service responsable : </dt>
                          <dd className="inline">
                            {p.attribution
                              ? `${p.attribution.label}${p.attribution.holder ? ` (${p.attribution.holder.name})` : ""}`
                              : p.serviceResponsable || "Service responsable à confirmer"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline font-medium">Délai indicatif : </dt>
                          <dd className="inline">{p.delaiIndicatif}</dd>
                        </div>
                        <div>
                          <dt className="inline font-medium">Résultat attendu : </dt>
                          <dd className="inline">{p.resultatAttendu}</dd>
                        </div>
                      </dl>
                      {p.status === "REJETEE" && p.motifRejet && (
                        <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-800">
                          <span className="font-medium">Motif du rejet : </span>
                          {p.motifRejet}
                        </p>
                      )}
                    </div>
                  </div>

                  {canDesignate && attributions.length > 0 && (
                    <ServicePicker problemId={p.id} current={p.attributionId} attributions={attributions} />
                  )}

                  {canAct ? (
                    <ReactionPanel problemId={p.id} proposedDecision={finalDecision} decided={p.status !== "PROPOSEE"} />
                  ) : (
                    p.status === "PROPOSEE" && (
                      <p className="text-xs text-gray-500">En attente de la décision du responsable concerné.</p>
                    )
                  )}

                  {p.reactions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Historique des réactions</p>
                      <ol className="mt-1 space-y-2 border-l border-gray-200 pl-4">
                        {p.reactions.map((r) => (
                          <li key={r.id} className="text-sm">
                            <p className="text-xs text-gray-500">
                              <span className="font-medium text-gray-800">{r.author.name}</span> {AI_REACTION_LABELS[r.kind]} ·{" "}
                              {DATE_TIME.format(r.createdAt)}
                            </p>
                            {r.kind === "AJUSTEMENT" && r.decisionAjustee && (
                              <p className="text-gray-700">Décision : {r.decisionAjustee}</p>
                            )}
                            {r.kind === "REJET" && r.motif && <p className="text-gray-700">Motif : {r.motif}</p>}
                            {r.comment && (
                              <p className="whitespace-pre-line text-gray-700">
                                {r.kind === "SERVICE_DESIGNE" ? `Service : ${r.comment}` : r.comment}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </section>
      )}

      {/* Historique des analyses de ce périmètre */}
      {analyses.length > 0 && (
        <section aria-labelledby="historique">
          <h2 id="historique" className="mb-2 flex items-center gap-2 text-base font-semibold text-gray-900">
            <History size={16} aria-hidden /> Analyses précédentes · {label}
          </h2>
          <Card className="divide-y divide-gray-100 p-0">
            {analyses.map((a) => (
              <Link
                key={a.id}
                href={filterQuery({ analyse: a.id })}
                className={clsx(
                  "flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-blue-50/40",
                  analysis?.id === a.id && "bg-blue-50/60"
                )}
              >
                <span className="text-gray-800">
                  {DATE_TIME.format(a.createdAt)} · {a.author.name}
                  <span className="text-gray-500">
                    {" "}
                    · {formatAiDay(a.periodFrom)} → {formatAiDay(new Date(a.periodTo.getTime() - 1))} ·{" "}
                    {a.reportIds.length} rapport(s)
                  </span>
                </span>
                {a.status === "REUSSIE" ? (
                  <Badge color="blue">{a._count.problems} problème(s)</Badge>
                ) : (
                  <Badge color="red">Échec</Badge>
                )}
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
