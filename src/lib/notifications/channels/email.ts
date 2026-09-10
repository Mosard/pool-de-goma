import type { NotificationChannelAdapter } from "../types";

// Adaptateur e-mail : tant qu'aucun fournisseur n'est configuré
// (EMAIL_PROVIDER_API_KEY absent), on journalise seulement en console pour
// ne pas simuler une intégration qui n'existe pas encore. Brancher un vrai
// fournisseur (Resend, SendGrid, SMTP...) ne nécessite de toucher que ce
// fichier.
export const emailChannel: NotificationChannelAdapter = {
  key: "EMAIL",
  isConfigured: () => Boolean(process.env.EMAIL_PROVIDER_API_KEY),

  async send(notificationId, payload) {
    if (!emailChannel.isConfigured()) {
      console.log(`[notifications:email:stub] "${payload.title}" -> user ${payload.userId}`);
      return { ok: true };
    }

    // TODO: intégration réelle une fois EMAIL_PROVIDER_API_KEY fourni.
    return { ok: false, error: "Fournisseur e-mail non implémenté." };
  },
};
