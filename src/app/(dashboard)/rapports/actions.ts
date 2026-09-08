"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/validations";
import { assertRole } from "@/lib/permissions";

export type CommentState = {
  errors?: Record<string, string>;
  formError?: string;
};

export async function addCommentAction(
  reportId: string,
  _prevState: CommentState,
  formData: FormData
): Promise<CommentState> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  assertRole(session.user.role, ["EXPLOITANT", "CHEF_POOL"]);

  const parsed = commentSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string> };
  }

  await prisma.comment.create({
    data: {
      reportId,
      authorId: session.user.id,
      content: parsed.data.content,
    },
  });

  if (session.user.role === "EXPLOITANT") {
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "EN_REVUE" },
    });
  }

  revalidatePath(`/rapports/${reportId}`);
  return {};
}

export async function validateReportAction(reportId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  assertRole(session.user.role, ["EXPLOITANT"]);

  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status: "VALIDE", validatedAt: new Date() },
  });

  await prisma.inspection.update({
    where: { id: report.inspectionId },
    data: { status: "VALIDEE" },
  });

  revalidatePath(`/rapports/${reportId}`);
  revalidatePath("/rapports");
}
