export type NotificationChannelKey = "IN_APP" | "EMAIL" | "WHATSAPP" | "SMS";

export type NotificationPayload = {
  userId: string;
  event: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export interface NotificationChannelAdapter {
  key: NotificationChannelKey;
  isConfigured(): boolean;
  send(notificationId: string, payload: NotificationPayload): Promise<{ ok: boolean; error?: string }>;
}
