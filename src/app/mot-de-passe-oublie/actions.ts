"use server";

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations";
import { emailChannel } from "@/lib/notifications/channels/email";

export type ForgotPasswordState = {
  errors?: Record<string, string>;
  success?: boolean;
};

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });

  if (user && user.status === "ACTIVE") {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "";
    const resetUrl = `${baseUrl}/reinitialiser-mot-de-passe?token=${rawToken}`;

    await emailChannel.send(`reset-${user.id}`, {
      userId: user.id,
      event: "account.password_reset_requested",
      title: "Réinitialisation de mot de passe — IPP Nord-Kivu 1",
      body: `Lien de réinitialisation (valable 1h) : ${resetUrl}`,
    });
  }

  // Message générique, que le compte existe ou non — ne jamais révéler.
  return { success: true };
}
