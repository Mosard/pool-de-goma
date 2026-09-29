import Link from "next/link";
import { redirect } from "next/navigation";
import { clsx } from "clsx";
import { ChevronRight, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { canPublishContents, canWriteContents } from "@/lib/contents";
import {
  CONTENT_KIND_LABELS,
  CONTENT_STATUS_COLORS,
  CONTENT_STATUS_LABELS,
  type ContentStatusKey,
} from "@/lib/content-meta";

const TABS: { key: string; label: string; statuses: ContentStatusKey[] | null }[] = [
  { key: "tous", label: "Tous", statuses: null },
  { key: "a-valider", label: "À valider", statuses: ["SOUMIS"] },
  { key: "brouillons", label: "Brouillons et corrections", statuses: ["BROUILLON", "A_CORRIGER"] },
  { key: "publies", label: "Publiés", statuses: ["PUBLIE"] },
  { key: "retires", label: "Retirés", statuses: ["RETIRE"] },
];

/**
 * Contenus du site public. Rédacteur (content.write) : ses propres contenus.
 * Valideur (content.publish) : tous les contenus de l'organisation.
 */
export default async function ContenusPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const session = await auth();
  const user = session!.user;
  const canWrite = canWriteContents(user.permissions);
  const canPublish = canPublishContents(user.permissions);
  if (!canWrite && !canPublish) redirect("/dashboard");

  const { vue } = await searchParams;
  const tab = TABS.find((t) => t.key === vue) ?? TABS[canPublish && !canWrite ? 1 : 0];
  const scope = { organizationId: user.organizationId, ...(canPublish ? {} : { authorId: user.id }) };

  const [contents, toReview] = await Promise.all([
    prisma.content.findMany({
      where: { ...scope, ...(tab.statuses ? { status: { in: tab.statuses } } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        kind: true,
        title: true,
        status: true,
        updatedAt: true,
        author: { select: { name: true } },
      },
    }),
    prisma.content.count({ where: { ...scope, status: "SOUMIS" } }),
  ]);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "Africa/Lubumbashi" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Actualités et articles"
        description={
          canPublish
            ? toReview > 0
              ? `${toReview} contenu(s) attendent une validation`
              : "Aucun contenu en attente de validation"
            : "Vos actualités, articles et communiqués pour le site public"
        }
        actions={
          canWrite ? (
            <Link
              href="/contenus/nouveau"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <Plus size={16} aria-hidden /> Nouveau contenu
            </Link>
          ) : undefined
        }
      />

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrer les contenus">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/contenus?vue=${t.key}`}
            className={clsx(
              "whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium",
              t.key === tab.key ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            )}
          >
            {t.label}
            {t.key === "a-valider" && toReview > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 text-[10px] text-white">{toReview}</span>
            )}
          </Link>
        ))}
      </nav>

      {contents.length === 0 ? (
        <EmptyState message="Aucun contenu dans cette vue." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-3">Titre</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">État</th>
                {canPublish && <th className="px-6 py-3">Auteur</th>}
                <th className="px-6 py-3">Mis à jour</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contents.map((c) => (
                <tr key={c.id} className="hover:bg-blue-50/40">
                  <td className="max-w-md px-6 py-3 font-medium text-gray-900">{c.title}</td>
                  <td className="px-6 py-3 text-gray-600">{CONTENT_KIND_LABELS[c.kind]}</td>
                  <td className="px-6 py-3">
                    <Badge color={CONTENT_STATUS_COLORS[c.status]}>{CONTENT_STATUS_LABELS[c.status]}</Badge>
                  </td>
                  {canPublish && <td className="px-6 py-3 text-gray-600">{c.author.name}</td>}
                  <td className="whitespace-nowrap px-6 py-3 text-gray-500">{fmt(c.updatedAt)}</td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/contenus/${c.id}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
                    >
                      Ouvrir <ChevronRight size={14} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
