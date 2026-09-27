"use server";

import bcrypt from "bcryptjs";
import { getDefaultOrganization } from "@/lib/organization";
import { accountRequestSchema } from "@/lib/validations";
import { submitAccountRequest, toUserMessage } from "@/lib/accounts";

export type AccountRequestState = {
  errors?: Record<string, string>;
  formError?: string;
  success?: boolean;
  username?: string;
};

export async function submitAccountRequestAction(
  _prevState: AccountRequestState,
  formData: FormData
): Promise<AccountRequestState> {
  const parsed = accountRequestSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    username: formData.get("username"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
    phone: formData.get("phone"),
    requestedRoleId: formData.get("requestedRoleId"),
    poolId: formData.get("poolId"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { errors: Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""])) };
  }

  const organization = await getDefaultOrganization();

  try {
    // Seule l'empreinte du mot de passe est conservée ; personne ne le voit.
    await submitAccountRequest({
      organizationId: organization.id,
      name: parsed.data.name,
      email: parsed.data.email,
      username: parsed.data.username,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      phone: parsed.data.phone || null,
      requestedRoleId: parsed.data.requestedRoleId || null,
      poolId: parsed.data.poolId || null,
      message: parsed.data.message || null,
    });
  } catch (e) {
    const message = toUserMessage(e);
    return message.startsWith("L'identifiant") ? { errors: { username: message } } : { formError: message };
  }

  return { success: true, username: parsed.data.username };
}
