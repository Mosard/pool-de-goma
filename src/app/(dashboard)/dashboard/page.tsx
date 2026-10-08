import Link from "next/link";
import { redirect } from "next/navigation";
import { clsx } from "clsx";
import { auth } from "@/lib/auth";
import { Card, PageHeader, Badge } from "@/components/ui";
import { School, Users, ClipboardList, FileCheck2, AlertTriangle, MapPin, Inbox, Newspaper, UserPlus, FileText } from "lucide-react";
import { PoolActivityChart } from "@/components/pool-activity-chart";
import { resolveDashboardScopes, type DashboardScope } from "@/lib/dashboard/scope";
import { PILOTAGE_BUCKETS, monthLabel } from "@/lib/dashboard/indicators";
import {
  loadAdministration,
  loadContenus,
  loadEcolesPool,
  loadExploitation,
  loadItinerant,
  loadPilotageProvincial,
  loadPoolDetail,
  loadSynthesisCounts,
  loadCellule,
  loadSecretariat,
} from "@/lib/dashboard/data";
import { loadActor, type SynthesisActor } from "@/lib/synthese/server";

// Tableau de bord : une section par fonction du compte connecté, chacune
// limitée au périmètre décidé par resolveDashboardScopes (session côté
// serveur). Les paramètres d'URL (POOL, inspecteur à explorer) ne font que
// choisir DANS ce périmètre ; data.ts les vérifie.

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");

function StatCard({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: number; hint?: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    </Card>
  );
}

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      {children}
    </Link>
  );
}

/** Bandeau du périmètre : fonction et étendue des données affichées. */
function ScopeBanner({ scope, perimeter }: { scope: DashboardScope; perimeter: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
      <MapPin size={16} className="text-blue-600" aria-hidden />
      <span>
        Fonction : <strong className="text-gray-900">{scope.roleLabel}</strong> — Périmètre :{" "}
        <strong className="text-gray-900">{perimeter}</strong>
      </span>
    </p>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ poolId?: string; inspecteurId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const { poolId, inspecteurId } = await searchParams;

  // Acteur relu en base, pour les compteurs de synthèses (mêmes règles de lecture que /syntheses).
  const actor = await loadActor(user.id);
  const scopes = resolveDashboardScopes({
    id: user.id,
    organizationId: user.organizationId,
    isDemo: actor.isDemo,
    roles: user.roles,
    permissions: user.permissions,
  });

  return (
    <div className="space-y-10">
      {scopes.length > 1 && (
        <Card className="border-blue-100 bg-blue-50/60 text-sm text-blue-900">
          Vous exercez {scopes.length} fonctions. Chaque section ci-dessous est limitée au périmètre de la fonction indiquée.
        </Card>
      )}
      {scopes.map((scope) => (
        <section key={`${scope.kind}:${scope.poolId ?? scope.cellId ?? "org"}`} className="space-y-6">
          <Section scope={scope} actor={actor} poolId={poolId ?? null} inspectorId={inspecteurId ?? null} />
        </section>
      ))}
    </div>
  );
}

async function Section({
  scope,
  actor,
  poolId,
  inspectorId,
}: {
  scope: DashboardScope;
  actor: SynthesisActor;
  poolId: string | null;
  inspectorId: string | null;
}) {
  switch (scope.kind) {
    case "pilotage_provincial":
      return (
        <>
          <PilotageProvincial scope={scope} poolId={poolId} inspectorId={inspectorId} />
          <SynthesesCard scope={scope} actor={actor} />
        </>
      );
    case "exploitation_cellule":
      return (
        <>
          <Cellule scope={scope} />
          <SynthesesCard scope={scope} actor={actor} />
        </>
      );
    case "secretariat_ipp":
      return <Secretariat scope={scope} />;
    case "exploitation_provinciale":
    case "exploitation_pool":
      return (
        <>
          <Exploitation scope={scope} />
          <SynthesesCard scope={scope} actor={actor} />
        </>
      );
    case "pilotage_pool":
      return (
        <>
          <PilotagePool scope={scope} inspectorId={inspectorId} />
          <SynthesesCard scope={scope} actor={actor} />
        </>
      );
    case "ecoles_pool":
      return <EcolesPool scope={scope} />;
    case "itinerant":
      return <Itinerant scope={scope} />;
    case "administration":
      return <Administration scope={scope} />;
    case "contenus":
      return <Contenus scope={scope} />;
    default:
      return (
        <>
          <PageHeader title="Tableau de bord" description="Aucun tableau de bord n'est défini pour votre fonction." />
          <ScopeBanner scope={scope} perimeter="aucune donnée de suivi" />
          <Card>
            <p className="text-sm text-gray-600">
              Votre fonction ne comporte pas encore d&apos;indicateurs de suivi. Le menu donne accès aux pages autorisées. Si
              vous pensez qu&apos;il vous manque un accès, adressez-vous à l&apos;informaticien de l&apos;Inspection.
            </p>
          </Card>
        </>
      );
  }
}

// ─── Rapports de synthèse ─────────────────────────────────────────────────

// Compteurs adaptés à la fonction : l'IPP et ses adjoints valident, l'exploitant
// IPP examine et rédige, le POOL rédige. Seules les synthèses lisibles comptent.
async function SynthesesCard({ scope, actor }: { scope: DashboardScope; actor: SynthesisActor }) {
  const c = await loadSynthesisCounts(scope, actor);
  const validator = scope.kind === "pilotage_provincial";
  const cellIpa = scope.kind === "exploitation_cellule" && scope.roleKey === "ipa";
  const cards = validator
    ? [
        { label: "Synthèses à valider", value: c.submitted, hint: "Soumises, décision attendue" },
        { label: "Renvoyées pour correction", value: c.toFix },
        { label: "Validées ou signées", value: c.validated, hint: "Synthèses de cellule : signées par l'IPA" },
      ]
    : cellIpa
      ? [
          { label: "Synthèses à signer", value: c.submitted, hint: "Soumises par la cellule" },
          { label: "Renvoyées à la cellule", value: c.toFix },
          { label: "Signées et transmises à l'IPP", value: c.validated },
        ]
    : scope.kind === "exploitation_cellule"
      ? [
          { label: "Mes brouillons", value: c.myDrafts },
          { label: "Mes synthèses à corriger", value: c.myToFix },
          { label: "Soumises à l'IPA", value: c.submitted, hint: "En attente de signature" },
          { label: "Signées et transmises à l'IPP", value: c.validated },
        ]
    : scope.kind === "exploitation_provinciale"
      ? [
          { label: "Synthèses soumises à examiner", value: c.submitted, hint: "Renvoi pour correction possible" },
          { label: "Mes brouillons", value: c.myDrafts },
          { label: "Mes synthèses à corriger", value: c.myToFix },
          { label: "Synthèses validées", value: c.validated },
        ]
      : [
          { label: "Mes brouillons", value: c.myDrafts },
          { label: "Mes synthèses à corriger", value: c.myToFix },
          { label: "Synthèses soumises", value: c.submitted, hint: "En attente du niveau provincial" },
          { label: "Synthèses validées", value: c.validated },
        ];
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">
          Rapports de synthèse {scope.cellId ? "de la cellule" : scope.poolId ? "du POOL" : "de l'Inspection"} ({c.total} soumis au moins une fois)
        </h2>
        <ActionLink href="/syntheses">Ouvrir les synthèses</ActionLink>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((k) => (
          <StatCard key={k.label} icon={FileText} label={k.label} value={k.value} hint={k.hint} />
        ))}
      </div>
    </Card>
  );
}

// ─── IPP : pilotage provincial ────────────────────────────────────────────

async function PilotageProvincial({ scope, poolId, inspectorId }: { scope: DashboardScope; poolId: string | null; inspectorId: string | null }) {
  const [data, detail] = await Promise.all([
    loadPilotageProvincial(scope),
    poolId ? loadPoolDetail(scope, poolId, inspectorId) : Promise.resolve(null),
  ]);
  const label = (key: string) => PILOTAGE_BUCKETS.find((b) => b.key === key)!.label;
  return (
    <>
      <PageHeader
        title="Pilotage provincial"
        description="Synthèse de l'Inspection Principale Provinciale — Nord-Kivu 1"
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionLink href="/rapports">Rapports</ActionLink>
            <ActionLink href="/exploitation">Exploitation des fiches</ActionLink>
          </div>
        }
      />
      <ScopeBanner scope={scope} perimeter="tous les POOL de l'Inspection" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileCheck2} label={label("a_valider")} value={data.buckets.a_valider} hint="Décision de l'IPP attendue" />
        <StatCard icon={Inbox} label={label("en_circuit")} value={data.buckets.en_circuit} />
        <StatCard icon={FileCheck2} label={label("valides")} value={data.buckets.valides} />
        <StatCard icon={ClipboardList} label="Inspections réalisées" value={data.realizedInspections} />
        <StatCard icon={School} label="Écoles actives" value={data.schools} />
        <StatCard icon={Users} label="Comptes actifs" value={data.activeUsers} />
        <StatCard icon={FileCheck2} label={label("rejetes")} value={data.buckets.rejetes} />
        <StatCard icon={Inbox} label="Rapports reçus (total)" value={data.received} />
        <StatCard icon={FileCheck2} label="Signés par les cellules" value={data.signedFromCells} hint="Signés par l'IPA, transmis à l'IPP" />
      </div>
      {data.buckets.corrections > 0 && (
        <Card className="flex items-center gap-3 border-amber-200 bg-amber-50">
          <AlertTriangle size={20} className="text-amber-600" strokeWidth={1.75} />
          <p className="text-sm text-amber-800">
            {data.buckets.corrections} rapport{data.buckets.corrections > 1 ? "s" : ""} en correction chez un inspecteur.
          </p>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Production par POOL</h2>
        {data.byPool.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun POOL actif pour le moment.</p>
        ) : (
          <PoolActivityChart
            data={data.byPool.map((p) => ({
              pool: p.pool.name,
              rapports: p.received,
              aTraiter: p.buckets.en_circuit + p.buckets.a_valider,
            }))}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="overflow-x-auto lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Comparaison par POOL</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="py-2">POOL</th>
                <th className="py-2">Écoles</th>
                <th className="py-2">Reçus</th>
                <th className="py-2">Dans le circuit</th>
                <th className="py-2">À valider</th>
                <th className="py-2">Validés</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.byPool.map((p) => (
                <tr key={p.pool.id} className={clsx(detail?.pool.id === p.pool.id && "bg-blue-50/60")}>
                  <td className="py-2 font-medium text-gray-900">{p.pool.name}</td>
                  <td className="py-2">{p.schools}</td>
                  <td className="py-2">{p.received}</td>
                  <td className="py-2">{p.buckets.en_circuit}</td>
                  <td className="py-2">{p.buckets.a_valider}</td>
                  <td className="py-2">{p.buckets.valides}</td>
                  <td className="py-2 text-right">
                    <Link href={`/dashboard?poolId=${p.pool.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                      Explorer
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Tendance : rapports soumis par mois</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {data.trend.map((m) => (
                <tr key={m.month}>
                  <td className="py-2 text-gray-600">{monthLabel(m.month)}</td>
                  <td className="py-2 text-right font-medium text-gray-900">{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {detail && <PoolDetailCards detail={detail} basePath={`/dashboard?poolId=${detail.pool.id}&`} />}
    </>
  );
}

// ─── Détail d'un POOL (IPP qui explore, chef de POOL) ─────────────────────

type PoolDetail = NonNullable<Awaited<ReturnType<typeof loadPoolDetail>>>;

function PoolDetailCards({ detail, basePath }: { detail: PoolDetail; basePath: string }) {
  return (
    <>
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-gray-900">POOL {detail.pool.name}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={School} label="Écoles actives" value={detail.schools} />
          <StatCard icon={School} label="Écoles sans inspecteur affecté" value={detail.unassignedSchools} />
          <StatCard icon={Inbox} label="Rapports à traiter" value={detail.buckets.a_traiter} />
          <StatCard icon={AlertTriangle} label="Corrections attendues" value={detail.buckets.corrections} />
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Inspecteurs itinérants du POOL</h2>
        {detail.inspectors.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun inspecteur rattaché à ce POOL.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {detail.inspectors.map((insp) => (
              <li key={insp.id} className="flex items-center justify-between py-3 text-sm">
                <span className={clsx("font-medium", insp.id === detail.selectedInspector?.id ? "text-blue-600" : "text-gray-900")}>
                  {insp.name}
                </span>
                <div className="flex items-center gap-3">
                  <Badge color="blue">{insp.reportCount} rapport(s) reçu(s)</Badge>
                  <Link href={`${basePath}inspecteurId=${insp.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                    Voir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {detail.selectedInspector && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Rapports de {detail.selectedInspector.name} dans ce POOL</h2>
          {detail.selectedReports.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun rapport reçu pour le moment.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {detail.selectedReports.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium text-gray-900">{r.title}</span>
                  <div className="flex items-center gap-3">
                    <Badge color="blue">{r.status}</Badge>
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
    </>
  );
}

// ─── Chef de POOL ─────────────────────────────────────────────────────────

async function PilotagePool({ scope, inspectorId }: { scope: DashboardScope; inspectorId: string | null }) {
  const detail = await loadPoolDetail(scope, null, inspectorId);
  if (!detail) {
    return (
      <Card>
        <p className="text-sm text-gray-500">POOL introuvable ou inactif.</p>
      </Card>
    );
  }
  return (
    <>
      <PageHeader
        title={`Pilotage du POOL ${detail.pool.name}`}
        description="Écoles, affectations et suivi des rapports de votre POOL"
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionLink href="/affectations">Affectations</ActionLink>
            <ActionLink href="/rapports">Rapports</ActionLink>
          </div>
        }
      />
      <ScopeBanner scope={scope} perimeter={`POOL ${detail.pool.name}`} />
      <PoolDetailCards detail={detail} basePath="/dashboard?" />
    </>
  );
}

// ─── Cellule de l'IPP : exploitants et IPA (décisions du 2026-10-08) ──────

function ReportMiniList({ title, rows, empty }: { title: string; rows: { id: string; title: string; author: string }[]; empty: string }) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/rapports/${r.id}`} className="font-medium text-blue-600 hover:underline">
                {r.title}
              </Link>
              <span className="text-gray-500"> — {r.author}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function Cellule({ scope }: { scope: DashboardScope }) {
  const data = await loadCellule(scope);
  const ipa = scope.roleKey === "ipa";
  const cellLabel = data.cell ? `cellule ${data.cell.code} — ${data.cell.name}` : "votre cellule";
  return (
    <>
      <PageHeader
        title={ipa ? "Ma cellule — signatures" : "Exploitation de la cellule"}
        description={`Rapports envoyés par le secrétariat de l'IPP à la ${cellLabel}.${data.cell?.ipa ? ` IPA : ${data.cell.ipa.name}.` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionLink href="/rapports">Rapports de la cellule</ActionLink>
            <ActionLink href="/exploitation">Exploitation des fiches</ActionLink>
          </div>
        }
      />
      <ScopeBanner scope={scope} perimeter={`${cellLabel} (rapports affectés uniquement)`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Inbox} label="En exploitation" value={data.affected} hint="Envoyés par le secrétariat" />
        <StatCard icon={FileCheck2} label="À signer par l'IPA" value={data.toSign} />
        <StatCard icon={FileCheck2} label="Signés et transmis à l'IPP" value={data.signed} />
        <StatCard icon={ClipboardList} label="Mes étapes (30 jours)" value={data.myActions} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportMiniList title="À signer (exploitation terminée)" rows={data.toSignList} empty="Aucun rapport en attente de signature." />
        <ReportMiniList title="Derniers rapports reçus par la cellule" rows={data.latestAffected} empty="Aucun rapport en cours dans la cellule." />
      </div>
    </>
  );
}

// ─── Secrétariat de l'IPP ─────────────────────────────────────────────────

async function Secretariat({ scope }: { scope: DashboardScope }) {
  const data = await loadSecretariat(scope);
  return (
    <>
      <PageHeader
        title="Secrétariat de l'IPP"
        description="Rapports soumis arrivés au secrétariat, à envoyer à la cellule correspondante."
        actions={<ActionLink href="/secretariat">Ouvrir le secrétariat</ActionLink>}
      />
      <ScopeBanner scope={scope} perimeter="rapports arrivés au secrétariat (réception et orientation, sans exploitation)" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Inbox} label="À envoyer à une cellule" value={data.waiting} hint={data.legacy ? `dont ${data.legacy} antérieur(s) à orienter` : undefined} />
        <StatCard icon={Users} label="Cellules actives" value={data.activeCells} />
      </div>
      {data.byCell.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Rapports en cours par cellule</h2>
          <ul className="space-y-1 text-sm text-gray-700">
            {data.byCell.map((c) => (
              <li key={c.id}>
                <strong>{c.code}</strong> — {c.name} : {c.inProgress}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

// ─── Exploitation : exploitant de POOL, fonction provinciale hors cellule ───

async function Exploitation({ scope }: { scope: DashboardScope }) {
  const data = await loadExploitation(scope);
  const provincial = scope.poolId === null;
  const poolName = data.byPool[0]?.pool.name ?? "";
  const title = provincial ? "Mes activités d'exploitation (bureau IPP)" : `Exploitation des rapports — POOL ${poolName}`;
  return (
    <>
      <PageHeader
        title={title}
        description={
          provincial
            ? "Rapports reçus de tous les POOL et leur traitement. La validation reste à l'IPP."
            : "Rapports reçus de votre POOL et leur traitement avant transmission au bureau IPP."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionLink href="/rapports">Traiter les rapports</ActionLink>
            <ActionLink href="/exploitation">Exploitation des fiches</ActionLink>
          </div>
        }
      />
      <ScopeBanner scope={scope} perimeter={provincial ? "tous les POOL de l'Inspection" : `POOL ${poolName}`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Inbox} label="Rapports reçus (total)" value={data.received} hint={`dont ${data.receivedLast30} sur 30 jours`} />
        {data.buckets.map((b) => (
          <StatCard key={b.key} icon={FileCheck2} label={b.label} value={data.counts[b.key]} hint={b.hint} />
        ))}
        <StatCard icon={ClipboardList} label="Mes actions sur 30 jours" value={data.myActions} hint="Changements de statut faits par vous" />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Dossiers en attente depuis le plus longtemps</h2>
        {data.oldestPending.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun rapport en attente de traitement.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.oldestPending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <span className="font-medium text-gray-900">{r.title}</span>
                  <span className="text-gray-500">
                    {" "}
                    — {r.author}, soumis le {fmtDate(r.submittedAt)}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <Badge color="orange">{r.status}</Badge>
                  <Link href={`/rapports/${r.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                    Ouvrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {provincial && (
        <Card className="overflow-x-auto">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Suivi par POOL</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="py-2">POOL</th>
                <th className="py-2">Reçus</th>
                {data.buckets.map((b) => (
                  <th key={b.key} className="py-2">
                    {b.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.byPool.map((p) => (
                <tr key={p.pool.id}>
                  <td className="py-2 font-medium text-gray-900">{p.pool.name}</td>
                  <td className="py-2">{p.received}</td>
                  {data.buckets.map((b) => (
                    <td key={b.key} className="py-2">
                      {p.counts[b.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

// ─── Secrétaire de POOL ───────────────────────────────────────────────────

async function EcolesPool({ scope }: { scope: DashboardScope }) {
  const data = await loadEcolesPool(scope);
  if (!data) {
    return (
      <Card>
        <p className="text-sm text-gray-500">POOL introuvable.</p>
      </Card>
    );
  }
  return (
    <>
      <PageHeader
        title={`Écoles du POOL ${data.pool.name}`}
        description="Gestion administrative des fiches écoles"
        actions={<ActionLink href="/ecoles">Gérer les écoles</ActionLink>}
      />
      <ScopeBanner scope={scope} perimeter={`POOL ${data.pool.name}`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={School} label="Écoles actives" value={data.active} />
        <StatCard icon={School} label="Écoles inactives" value={data.inactive} />
        <StatCard icon={AlertTriangle} label="Écoles sans inspecteur affecté" value={data.unassigned.length} />
      </div>
      {data.unassigned.length > 0 && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Écoles sans inspecteur affecté</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {data.unassigned.slice(0, 10).map((s) => (
              <li key={s.id} className="py-2 text-gray-900">
                {s.name}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

// ─── Inspecteur itinérant ─────────────────────────────────────────────────

async function Itinerant({ scope }: { scope: DashboardScope }) {
  const data = await loadItinerant(scope);
  return (
    <>
      <PageHeader
        title="Mon tableau de bord"
        description="Vos écoles, vos inspections et vos rapports"
        actions={
          <Link href="/inspections">
            <span className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
              Nouvelle inspection
            </span>
          </Link>
        }
      />
      <ScopeBanner scope={scope} perimeter="vos écoles et vos propres inspections" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={School} label="Écoles affectées" value={data.assignments.length} />
        <StatCard icon={ClipboardList} label="Inspections réalisées" value={data.realized} />
        <StatCard icon={ClipboardList} label="Inspections programmées" value={data.planned.length} hint="Créées, non commencées" />
        <StatCard icon={AlertTriangle} label="Corrections demandées" value={data.corrections.length} />
      </div>

      {data.corrections.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="mb-3 text-sm font-semibold text-amber-900">Rapports à corriger</h2>
          <ul className="divide-y divide-amber-100 text-sm">
            {data.corrections.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium text-amber-900">{c.title}</span>
                  {c.comment && <span className="text-amber-800"> — « {c.comment} »</span>}
                </span>
                <Link href={`/rapports/${c.id}`} className="text-xs font-medium text-blue-700 hover:underline">
                  Corriger
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Mes écoles affectées</h2>
          {data.assignments.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune école ne vous est affectée actuellement.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {data.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-gray-900">{a.schoolName}</span>
                  <span className="text-xs text-gray-500">
                    {a.poolName}
                    {a.upcoming && <span className="ml-1 text-amber-700">(à partir du {fmtDate(a.effectiveFrom)})</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Inspections programmées</h2>
          {data.planned.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aucune inspection programmée. Créez-la depuis « Inspections & fiches » avec sa date prévue.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {data.planned.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-gray-900">{i.schoolName}</span>
                  <Link href={`/inspections/${i.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                    {i.scheduledDate ? `Prévue le ${fmtDate(i.scheduledDate)}` : "Date non fixée"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Mes rapports par statut</h2>
          {data.reportsByStatus.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun rapport pour le moment.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {data.reportsByStatus.map((s) => (
                <li key={s.key} className="flex items-center justify-between py-2">
                  <span className="text-gray-700">{s.label}</span>
                  <span className="font-medium text-gray-900">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Derniers retours sur mes rapports</h2>
          {data.recentComments.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun retour pour le moment.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {data.recentComments.map((c) => (
                <li key={c.id} className="py-2">
                  <p className="text-gray-900">{c.content}</p>
                  <p className="text-xs text-gray-500">
                    {c.author.name}, le {fmtDate(c.createdAt)} —{" "}
                    <Link href={`/rapports/${c.reportId}`} className="text-blue-600 hover:underline">
                      voir le rapport
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

// ─── Informaticien ────────────────────────────────────────────────────────

async function Administration({ scope }: { scope: DashboardScope }) {
  const data = await loadAdministration(scope);
  return (
    <>
      <PageHeader
        title="Administration de la plateforme"
        description="Comptes et organisation de l'Inspection"
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionLink href="/comptes">Demandes de compte</ActionLink>
            <ActionLink href="/inspecteurs">Comptes</ActionLink>
            <ActionLink href="/parametres">Paramètres</ActionLink>
          </div>
        }
      />
      <ScopeBanner scope={scope} perimeter="comptes et POOL de l'Inspection" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={UserPlus} label="Demandes de compte en attente" value={data.pendingRequests} />
        <StatCard icon={Users} label="Comptes actifs" value={data.activeUsers} />
        <StatCard icon={Users} label="Comptes en attente d'activation" value={data.pendingActivation} />
        <StatCard icon={Users} label="Comptes suspendus ou désactivés" value={data.suspended} />
        <StatCard icon={MapPin} label="POOL actifs" value={data.activePools} />
      </div>
    </>
  );
}

// ─── Chargé des médias ────────────────────────────────────────────────────

async function Contenus({ scope }: { scope: DashboardScope }) {
  const { counts, toFix } = await loadContenus(scope);
  return (
    <>
      <PageHeader
        title="Mes contenus du site public"
        description="Actualités, articles, communiqués et albums"
        actions={<ActionLink href="/contenus/nouveau">Nouveau contenu</ActionLink>}
      />
      <ScopeBanner scope={scope} perimeter="vos propres contenus" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Newspaper} label="Brouillons" value={counts.BROUILLON ?? 0} />
        <StatCard icon={Newspaper} label="En attente de validation" value={counts.SOUMIS ?? 0} />
        <StatCard icon={AlertTriangle} label="À corriger" value={counts.A_CORRIGER ?? 0} />
        <StatCard icon={Newspaper} label="Publiés" value={counts.PUBLIE ?? 0} />
      </div>
      {toFix.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="mb-3 text-sm font-semibold text-amber-900">Renvoyés en correction</h2>
          <ul className="divide-y divide-amber-100 text-sm">
            {toFix.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium text-amber-900">{c.title}</span>
                  {c.reviewNote && <span className="text-amber-800"> — « {c.reviewNote} »</span>}
                </span>
                <Link href={`/contenus/${c.id}`} className="text-xs font-medium text-blue-700 hover:underline">
                  Corriger
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
