"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { hasPendingRequestFor, verifyCredentials } from "@/lib/accounts";
import { loadUserAccess } from "@/lib/permissions";
import { AWAITING_CELL_MESSAGE } from "@/lib/cells/rules";

export type LoginState = {
  errors?: { identifier?: string; password?: string };
  formError?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      errors: {
        identifier: fieldErrors.identifier?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  const callbackUrl = (formData.get("callbackUrl") as string) || "/dashboard";

  try {
    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      // Identifiants justes, mais IPA ou exploitant de l'IPP sans cellule : seul ce message.
      const user = await verifyCredentials(parsed.data.identifier, parsed.data.password);
      if (user && (await loadUserAccess(user.id, { viewMode: null })).awaitingCell) {
        return { formError: AWAITING_CELL_MESSAGE };
      }
      // Seul l'auteur d'une demande en attente (qui connaît son mot de passe)
      // apprend qu'elle n'est pas encore validée ; sinon message neutre.
      if (await hasPendingRequestFor(parsed.data.identifier, parsed.data.password)) {
        return {
          formError:
            "Votre demande de compte est en attente de validation par l'informaticien de l'Inspection. Vous pourrez vous connecter dès qu'elle sera validée.",
        };
      }
      return { formError: "Identifiant ou mot de passe incorrect, ou compte non validé." };
    }
    throw error;
  }
}

export async function signInWithGoogleAction(formData: FormData) {
  const callbackUrl = (formData.get("callbackUrl") as string) || "/dashboard";
  await signIn("google", { redirectTo: callbackUrl });
}
