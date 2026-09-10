import type { NotificationChannelAdapter } from "../types";

// Canal prioritaire selon le document produit (§16), mais aucune intégration
// WhatsApp Business API n'est disponible pour l'instant : adaptateur stub,
// clairement séparé, prêt à recevoir un vrai fournisseur plus tard.
export const whatsappChannel: NotificationChannelAdapter = {
  key: "WHATSAPP",
  isConfigured: () => Boolean(process.env.WHATSAPP_PROVIDER_API_KEY),

  async send(notificationId, payload) {
    if (!whatsappChannel.isConfigured()) {
      console.log(`[notifications:whatsapp:stub] "${payload.title}" -> user ${payload.userId}`);
      return { ok: true };
    }

    // TODO: intégration réelle une fois WHATSAPP_PROVIDER_API_KEY fourni.
    return { ok: false, error: "Fournisseur WhatsApp non implémenté." };
  },
};
