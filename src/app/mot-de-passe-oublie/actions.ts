"use server";

import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations";
import { emailChannel } from "@/lib/notifications/channels/email";
import { generateToken, passwordResetUrl } from "@/lib/activation-token";
import { getBaseUrl } from "@/lib/request-url";

export type ForgotPasswordState = {
  errors?: Record<string, string>;
  success?: boolean;
  /** Vrai tant qu'aucun fournisseur e-mail n'est branché : réinitialisation assistée. */
  assisted?: boolean;
};

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ identifier: formData.get("identifier") });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  // Sans fournisseur e-mail, aucun lien ne peut partir : on n'en crée pas et
  // on oriente vers la réinitialisation assistée par l'informaticien (même
  // réponse que le compte existe ou non).
  if (!emailChannel.isConfigured()) return { success: true, assisted: true };

  const { identifier } = parsed.data;
  const user = await prisma.user.findUnique({
    where: identifier.includes("@") ? { email: identifier } : { username: identifier },
  });

  if (user && user.status === "ACTIVE") {
    const { rawToken, tokenHash } = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    await emailChannel.send(`reset-${user.id}`, {
      userId: user.id,
      event: "account.password_reset_requested",
      title: "Réinitialisation de mot de passe — IPP Nord-Kivu 1",
      body: `Lien de réinitialisation (valable 1h) : ${passwordResetUrl(await getBaseUrl(), rawToken)}`,
    });
  }

  // Message générique, que le compte existe ou non — ne jamais révéler.
  return { success: true };
}
