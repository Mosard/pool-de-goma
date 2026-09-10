"use server";

import { prisma } from "@/lib/prisma";
import { accountRequestSchema } from "@/lib/validations";

export type AccountRequestState = {
  errors?: Record<string, string>;
  formError?: string;
  success?: boolean;
};

export async function submitAccountRequestAction(
  _prevState: AccountRequestState,
  formData: FormData
): Promise<AccountRequestState> {
  const parsed = accountRequestSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    requestedRoleId: formData.get("requestedRoleId"),
    poolId: formData.get("poolId"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (existingUser) {
    return { formError: "Un compte existe déjà avec cet email." };
  }

  await prisma.accountRequest.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone || null,
      requestedRoleId: parsed.data.requestedRoleId || null,
      poolId: parsed.data.poolId || null,
      message: parsed.data.message || null,
    },
  });

  return { success: true };
}
