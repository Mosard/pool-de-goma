import Link from "next/link";
import { redirect } from "next/navigation";
import { EyeOff, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonClasses, Card, Notice, PageHeader } from "@/components/ui";
import { loadFileView, resolveFileContext } from "@/lib/personnel-file/server";
import { PhotoForm } from "./photo-form";
import { ConsentForm } from "./consent-form";
import { SecuritySection } from "./security-section";
import { roleDisplayLabel } from "@/lib/cells/rules";
import { USERNAME_RULE } from "@/lib/activation-token";
import { loadSecurityHistory } from "@/lib/login-credentials";
import { RECENT_GOOGLE_LOGIN_MINUTES, recentGoogleMinutesLeft } from "@/lib/login-credentials-rules";

// « Mon compte » : trois blocs. Les informations personnelles (nom, sexe,
// téléphone, matricule, enfants…) se modifient dans la fiche personnelle,
// qui les enregistre sur le compte ; cette page ne les duplique plus.

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      photoUrl: true,
      isDemo: true,
      publicationConsentIdentity: true,
      publicationConsentPhoto: true,
      publicationAuthIdentity: true,
      publicationAuthPhoto: true,
    },
  });
  if (!user) redirect("/login");
  const poolNames = new Map(
    (await prisma.pool.findMany({ where: { id: { in: session.user.roles.flatMap((r) => (r.poolId ? [r.poolId] : [])) } }, select: { id: true, name: true } })).map(
      (p) => [p.id, p.name]
    )
  );
  const ficheCtx = session.user.awaitingCell ? null : await resolveFileContext(user.id, user.id);
  const [fiche, history] = await Promise.all([ficheCtx ? loadFileView(ficheCtx) : null, loadSecurityHistory(user.id)]);
  // Fonctions effectives relues en base : la cellule affichée est celle qui borne les droits.
  const functions = session.user.roles.map((r) => roleDisplayLabel(r, r.poolId ? poolNames.get(r.poolId) : null));

  return (
    <div className="space-y-6">
      <PageHeader title="Mon compte" description={functions.length ? functions.join(" · ") : "Aucune fonction attribuée"} />

      {/* 1. Ma fiche personnelle */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FileText size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Ma fiche personnelle</h2>
            <p className="text-pretty text-xs text-gray-500">
              {fiche ? (
                <>
                  Fiche de renseignement de l&apos;agent (IGAP) : identité, contacts, carrière, famille. Renseignée à{" "}
                  <span className="font-medium tabular-nums text-gray-900">{fiche.completeness.percent} %</span>.
                </>
              ) : (
                "Votre fiche personnelle n'est pas disponible pour le moment."
              )}
            </p>
          </div>
        </div>
        {fiche && (
          <Link href="/profil/fiche" className={buttonClasses({ size: "sm", className: "min-h-10" })}>
            Voir ma fiche
          </Link>
        )}
      </Card>

      {/* 2. Confidentialité et publication */}
      <Card>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <EyeOff size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Confidentialité et publication</h2>
            <p className="mt-0.5 text-pretty text-xs text-gray-500">Votre photo de profil et ce qui peut apparaître sur le site public.</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-gray-200 p-4">
          <PhotoForm name={user.name} photoUrl={user.photoUrl} />
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4">
          {user.isDemo ? (
            <p className="text-xs text-gray-500">Compte de démonstration : il n&apos;est jamais publié sur le site public.</p>
          ) : (
            <ConsentForm
              consentIdentity={user.publicationConsentIdentity}
              consentPhoto={user.publicationConsentPhoto}
              authIdentity={user.publicationAuthIdentity}
              authPhoto={user.publicationAuthPhoto}
              hasPhoto={Boolean(user.photoUrl)}
            />
          )}
        </div>
      </Card>

      {/* 3. Sécurité et identifiants */}
      {session.user.viewMode ? (
        <Notice tone="neutral" title="Sécurité et identifiants">
          Quittez le mode « Voir comme » pour consulter ou modifier vos identifiants de connexion.
        </Notice>
      ) : (
        <SecuritySection
          username={user.username}
          email={user.email}
          usernameRule={USERNAME_RULE}
          recentMinutes={RECENT_GOOGLE_LOGIN_MINUTES}
          googleMinutesLeft={recentGoogleMinutesLeft(session.user.authMethod, session.user.authAt)}
          googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
          history={history.map((h) => ({ at: h.at.toISOString(), label: h.label, detail: h.detail }))}
        />
      )}
    </div>
  );
}
