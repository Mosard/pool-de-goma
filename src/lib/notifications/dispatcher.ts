import { prisma } from "@/lib/prisma";
import type { NotificationChannel } from "@prisma/client";
import { inAppChannel } from "./channels/inApp";
import { emailChannel } from "./channels/email";
import { whatsappChannel } from "./channels/whatsapp";
import { smsChannel } from "./channels/sms";
import type { NotificationChannelAdapter } from "./types";

const ADAPTERS: Record<NotificationChannel, NotificationChannelAdapter> = {
  IN_APP: inAppChannel,
  EMAIL: emailChannel,
  WHATSAPP: whatsappChannel,
  SMS: smsChannel,
};

// Canaux déclenchés par défaut pour un événement métier. IN_APP est toujours
// utile ; EMAIL/WHATSAPP ne s'activent réellement que si leur adaptateur est
// configuré (sinon la notification est marquée DISABLED, voir plus bas).
const DEFAULT_CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL", "WHATSAPP"];

export async function notify(params: {
  userId: string;
  event: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
}) {
  const channels = params.channels ?? DEFAULT_CHANNELS;

  for (const channel of channels) {
    const adapter = ADAPTERS[channel];
    const enabled = channel === "IN_APP" || adapter.isConfigured();

    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        channel,
        event: params.event,
        title: params.title,
        body: params.body,
        payload: params.data ? (params.data as object) : undefined,
        status: enabled ? "PENDING" : "DISABLED",
      },
    });

    if (!enabled) continue;

    const result = await adapter.send(notification.id, {
      userId: params.userId,
      event: params.event,
      title: params.title,
      body: params.body,
      data: params.data,
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: result.ok ? "SENT" : "FAILED",
        sentAt: result.ok ? new Date() : undefined,
      },
    });
  }
}

/** Notifie tous les détenteurs d'une permission (provinciale, ou scopée à un pool donné). */
export async function notifyUsersWithPermission(params: {
  permissionKey: string;
  poolId?: string | null;
  event: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  const poolFilter = params.poolId ? [{ poolId: null }, { poolId: params.poolId }] : [{ poolId: null }];

  const userRoles = await prisma.userRole.findMany({
    where: {
      role: { rolePermissions: { some: { permission: { key: params.permissionKey } } } },
      OR: poolFilter,
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  await Promise.all(
    userRoles.map((ur) =>
      notify({
        userId: ur.userId,
        event: params.event,
        title: params.title,
        body: params.body,
        data: params.data,
      })
    )
  );
}
