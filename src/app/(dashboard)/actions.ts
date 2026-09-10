"use server";

import { revalidatePath } from "next/cache";
import { signOut, auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function markNotificationReadAction(notificationId: string) {
  const session = await auth();
  if (!session?.user) return;

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { readAt: new Date() },
  });

  revalidatePath("/", "layout");
}
