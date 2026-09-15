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
