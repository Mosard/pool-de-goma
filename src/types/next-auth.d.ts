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
      /** Fonction simulée (« Voir comme »), sinon null. */
      viewMode?: {
        role: string;
        label: string;
        poolId: string | null;
        poolName: string | null;
        cellId?: string | null;
        cellName?: string | null;
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
    id: string;
    organizationId: string;
    poolId: string | null;
    roles: SessionRole[];
    permissions: SessionPermission[];
  }
}
