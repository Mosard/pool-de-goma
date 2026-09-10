import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { authConfig, type SessionRole, type SessionPermission } from "@/lib/auth.config";
import { loadUserAccess } from "@/lib/permissions";

const providers: Provider[] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Mot de passe", type: "password" },
    },
    authorize: async (credentials) => {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
      });
      if (!user || user.status !== "ACTIVE") return null;

      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!valid) return null;

      const { roles, permissions } = await loadUserAccess(user.id);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const dbUser = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
        return Boolean(dbUser && dbUser.status === "ACTIVE");
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
        if (dbUser) {
          const { roles, permissions } = await loadUserAccess(dbUser.id);
          token.id = dbUser.id;
          token.poolId = dbUser.poolId;
          token.roles = roles;
          token.permissions = permissions;
        }
        return token;
      }
      if (user) {
        token.id = user.id as string;
        token.poolId = (user.poolId as string | null) ?? null;
        token.roles = (user.roles as SessionRole[]) ?? [];
        token.permissions = (user.permissions as SessionPermission[]) ?? [];
      }
      return token;
    },
    session: authConfig.callbacks!.session,
  },
});
