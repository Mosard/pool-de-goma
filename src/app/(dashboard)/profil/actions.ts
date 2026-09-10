"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

export type ProfileFormState = {
  errors?: Record<string, string>;
  formError?: string;
  success?: boolean;
};

export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const parsed = profileSchema.safeParse({
    prenom: formData.get("prenom"),
    postnom: formData.get("postnom"),
    sex: formData.get("sex"),
    phone: formData.get("phone"),
    dateNaissance: formData.get("dateNaissance"),
    nombreEnfants: formData.get("nombreEnfants"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      prenom: parsed.data.prenom || null,
      postnom: parsed.data.postnom || null,
      sex: parsed.data.sex || null,
      phone: parsed.data.phone || null,
      dateNaissance: parsed.data.dateNaissance ? new Date(parsed.data.dateNaissance) : null,
      nombreEnfants: parsed.data.nombreEnfants ? Number(parsed.data.nombreEnfants) : null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "profile.update",
    entityType: "User",
    entityId: session.user.id,
  });

  revalidatePath("/profil");
  return { success: true };
}
