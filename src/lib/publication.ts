import type { PublicationDecisionKind, PublicationScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidatePublicPools } from "@/lib/public-pools";

// Publication d'un agent sur le site public = accord de l'agent (CONSENT)
// ET autorisation de l'IPP ou de l'informaticien (AUTHORIZATION), pour
// l'identité (nom + fonction) et, séparément, pour la photo. Chaque accord,
// autorisation ou retrait est conservé dans PublicationRecord (trace interne)
// et dans le journal d'audit.

const FIELDS = {
  CONSENT: { IDENTITY: "publicationConsentIdentity", PHOTO: "publicationConsentPhoto" },
  AUTHORIZATION: { IDENTITY: "publicationAuthIdentity", PHOTO: "publicationAuthPhoto" },
} as const;

export const PUBLICATION_REASONS = {
  PHOTO_CHANGED: "photo_changed",
} as const;

/**
 * Applique un accord/une autorisation (ou leur retrait). La photo exige
 * l'identité au même niveau : retirer l'identité retire aussi la photo.
 * Retourne true si quelque chose a changé.
 */
export async function applyPublicationDecision(params: {
  userId: string;
  actorId: string | null;
  organizationId: string;
  kind: PublicationDecisionKind;
  identity: boolean;
  photo: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const fields = FIELDS[params.kind];
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      publicationConsentIdentity: true,
      publicationConsentPhoto: true,
      publicationAuthIdentity: true,
      publicationAuthPhoto: true,
    },
  });
  if (!user) return false;

  const before = { IDENTITY: user[fields.IDENTITY], PHOTO: user[fields.PHOTO] };
  const after = { IDENTITY: params.identity, PHOTO: params.identity && params.photo };
  const changed = (["IDENTITY", "PHOTO"] as PublicationScope[]).filter((scope) => before[scope] !== after[scope]);
  if (changed.length === 0) return false;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: params.userId },
      data: { [fields.IDENTITY]: after.IDENTITY, [fields.PHOTO]: after.PHOTO },
    }),
    ...changed.map((scope) =>
      prisma.publicationRecord.create({
        data: {
          userId: params.userId,
          actorId: params.actorId,
          kind: params.kind,
          scope,
          granted: after[scope],
          reason: params.reason ?? null,
        },
      })
    ),
  ]);

  await logAudit({
    actorId: params.actorId,
    organizationId: params.organizationId,
    action: params.kind === "CONSENT" ? "user.publication_consent" : "user.publication_authorization",
    entityType: "User",
    entityId: params.userId,
    oldValue: { identity: before.IDENTITY, photo: before.PHOTO },
    newValue: { identity: after.IDENTITY, photo: after.PHOTO },
    metadata: { ...(params.reason && { reason: params.reason }), ...params.metadata },
  });

  revalidatePublicPools();
  return true;
}
