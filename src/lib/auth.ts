import { cache } from "react";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { authConfig, type SessionRole, type SessionPermission } from "@/lib/auth.config";
import { loadUserAccess } from "@/lib/permissions";
import { verifyCredentials } from "@/lib/accounts";

const providers: Provider[] = [
  Credentials({
    credentials: {
      identifier: { label: "Identifiant ou e-mail", type: "text" },
      password: { label: "Mot de passe", type: "password" },
    },
    authorize: async (credentials) => {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const user = await verifyCredentials(parsed.data.identifier, parsed.data.password);
      if (!user) return null;

      const { roles, permissions, awaitingCell } = await loadUserAccess(user.id, { viewMode: null });
      // IPA ou exploitant de l'IPP sans cellule : identifiants justes, mais
      // aucune session (loginAction affiche le message d'attente).
      if (awaitingCell) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        organizationId: user.organizationId,
        poolId: user.poolId,
        roles,
        permissions,
      };
    },
  }),
];

// Google ne sert qu'à authentifier l'identité (§20 du design) : l'accès réel
// reste soumis aux comptes/rôles internes déjà gérés par l'IPP — on ne crée
// jamais de compte automatiquement via Google, on relie seulement à un
// compte existant et actif portant le même email.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

const accessForRequest = cache((userId: string) => loadUserAccess(userId));

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const dbUser = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
        if (!dbUser || dbUser.status !== "ACTIVE") return false;
        if ((await loadUserAccess(dbUser.id, { viewMode: null })).awaitingCell) return "/login?compte=attente-cellule";
        return true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
        if (dbUser) {
          const { roles, permissions } = await loadUserAccess(dbUser.id);
          token.id = dbUser.id;
          token.organizationId = dbUser.organizationId;
          token.poolId = dbUser.poolId;
          token.roles = roles;
          token.permissions = permissions;
        }
        return token;
      }
      if (user) {
        token.id = user.id as string;
        token.organizationId = user.organizationId as string;
        token.poolId = (user.poolId as string | null) ?? null;
        token.roles = (user.roles as SessionRole[]) ?? [];
        token.permissions = (user.permissions as SessionPermission[]) ?? [];
      }
      return token;
    },
    // Droits relus en base à chaque requête (une fois par requête grâce à
    // cache) : un changement de rôle, une suspension ou le mode « Voir comme »
    // du Super Admin s'appliquent immédiatement, menus compris.
    async session({ session, token }) {
      if (session.user && token.id) {
        const access = await accessForRequest(token.id as string);
        session.user.id = token.id as string;
        session.user.organizationId = token.organizationId as string;
        session.user.poolId = access.viewMode ? access.viewMode.poolId : ((token.poolId as string | null) ?? null);
        session.user.roles = access.roles;
        session.user.permissions = access.permissions;
        session.user.isSuperAdmin = access.superAdmin;
        session.user.canViewAs = access.canViewAs;
        session.user.viewMode = access.viewMode;
        session.user.awaitingCell = access.awaitingCell;
      }
      return session;
    },
  },
});
