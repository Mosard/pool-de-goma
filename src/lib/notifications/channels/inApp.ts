import type { NotificationChannelAdapter } from "../types";

// Le canal in-app est toujours actif : la notification est simplement lue
// depuis la table Notification (cloche du Topbar), il n'y a rien à "envoyer".
export const inAppChannel: NotificationChannelAdapter = {
  key: "IN_APP",
  isConfigured: () => true,
  async send() {
    return { ok: true };
  },
};
