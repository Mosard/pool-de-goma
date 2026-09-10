import type { NotificationChannelAdapter } from "../types";

// Canal optionnel (§16) : adaptateur stub tant qu'aucun fournisseur SMS
// n'est configuré.
export const smsChannel: NotificationChannelAdapter = {
  key: "SMS",
  isConfigured: () => Boolean(process.env.SMS_PROVIDER_API_KEY),

  async send(notificationId, payload) {
    if (!smsChannel.isConfigured()) {
      console.log(`[notifications:sms:stub] "${payload.title}" -> user ${payload.userId}`);
      return { ok: true };
    }

    // TODO: intégration réelle une fois SMS_PROVIDER_API_KEY fourni.
    return { ok: false, error: "Fournisseur SMS non implémenté." };
  },
};
