import type { DefaultSession } from "next-auth";
import type { SessionRole, SessionPermission } from "@/lib/auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      poolId: string | null;
      roles: SessionRole[];
      permissions: SessionPermission[];
      /** Rôle Super Admin réellement détenu (indépendant du mode simulé). */
      isSuperAdmin?: boolean;
      /** Rôle réellement détenu autorisant « Voir comme » (Super Admin, IPP). */
      canViewAs?: boolean;
      /** Type de bascule : complète (Super Admin), bornée (IPP), consultation (informaticien, secrétaires de l'IPP). */
      viewModeKind?: "full" | "bounded" | "readonly" | null;
      /** IPA ou exploitant de l'IPP sans cellule active : aucun espace de travail. */
      awaitingCell?: boolean;
      /** Moyen de la connexion en cours (« credentials » ou « google ») et son heure (ms). */
      authMethod?: string;
      authAt?: number;
      /** Fonction simulée (« Voir comme »), sinon null. */
      viewMode?: {
        role: string;
        label: string;
        poolId: string | null;
        poolName: string | null;
        cellId?: string | null;
        cellName?: string | null;
        /** Bascule en consultation : aucune écriture possible. */
        readOnly?: boolean;
      } | null;
    } & DefaultSession["user"];
  }

  interface User {
    organizationId: string;
    poolId: string | null;
    roles: SessionRole[];
    permissions: SessionPermission[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    authMethod?: string;
    authAt?: number;
    id: string;
    organizationId: string;
    poolId: string | null;
    roles: SessionRole[];
    permissions: SessionPermission[];
  }
}
