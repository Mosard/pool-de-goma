import type { NextAuthConfig } from "next-auth";

export type SessionRole = { key: string; label: string; poolId: string | null };
export type SessionPermission = { permissionKey: string; poolId: string | null; organizationId: string };

// Edge-safe config: no providers, no Prisma/bcrypt. Used by middleware (Edge
// runtime, 1MB size limit) to check session presence without pulling in the
// Node-only auth stack. The full config in auth.ts extends this with providers.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.organizationId = user.organizationId as string;
        token.poolId = (user.poolId as string | null) ?? null;
        token.roles = (user.roles as SessionRole[]) ?? [];
        token.permissions = (user.permissions as SessionPermission[]) ?? [];
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.organizationId = token.organizationId as string;
        session.user.poolId = (token.poolId as string | null) ?? null;
        session.user.roles = (token.roles as SessionRole[]) ?? [];
        session.user.permissions = (token.permissions as SessionPermission[]) ?? [];
      }
      return session;
    },
  },
};
