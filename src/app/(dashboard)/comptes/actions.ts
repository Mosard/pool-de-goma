"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { approveAccountRequest, rejectAccountRequest, toUserMessage } from "@/lib/accounts";
import { getBaseUrl } from "@/lib/request-url";

export type ReviewState = {
  error?: string;
  done?: "approved" | "rejected";
  email?: string;
  username?: string | null;
  /** Compte actif d'emblée : la personne se connecte avec son identifiant. */
  activated?: boolean;
  emailed?: boolean;
  isDemo?: boolean;
  activationUrl?: string;
  expiresAt?: string;
};

export async function approveAccountRequestAction(
  requestId: string,
  _prevState: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  try {
    const result = await approveAccountRequest({
      actorId: session.user.id,
      organizationId: session.user.organizationId,
      requestId,
      roleId: String(formData.get("roleId") ?? ""),
      poolId: String(formData.get("poolId") ?? "") || null,
      baseUrl: await getBaseUrl(),
    });
    // Pas de revalidatePath ici : la ligne doit rester affichée avec le lien
    // d'activation jusqu'à ce que l'administrateur clique « Terminé ».
    return {
      done: "approved",
      email: result.email,
      username: result.username,
      activated: result.activated,
      emailed: result.emailed,
      isDemo: result.isDemo,
      activationUrl: result.activation?.url,
      expiresAt: result.activation?.expiresAt.toISOString(),
    };
  } catch (e) {
    return { error: toUserMessage(e) };
  }
}

export async function rejectAccountRequestAction(requestId: string): Promise<ReviewState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  try {
    await rejectAccountRequest({ actorId: session.user.id, organizationId: session.user.organizationId, requestId });
    revalidatePath("/comptes");
    return { done: "rejected" };
  } catch (e) {
    return { error: toUserMessage(e) };
  }
}
