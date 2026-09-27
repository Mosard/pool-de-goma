"use server";

import bcrypt from "bcryptjs";
import { resetPasswordSchema } from "@/lib/validations";
import { setPasswordWithToken, toUserMessage } from "@/lib/accounts";

export type ResetPasswordState = {
  errors?: Record<string, string>;
  formError?: string;
  success?: boolean;
};

// Sert aussi à l'activation d'un compte (/activer-compte) : même jeton à
// usage unique, le compte en attente devient actif.
export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation") ?? formData.get("password"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  try {
    await setPasswordWithToken(parsed.data.token, await bcrypt.hash(parsed.data.password, 10));
    return { success: true };
  } catch (e) {
    return { formError: toUserMessage(e) };
  }
}
