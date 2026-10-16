// « Mon compte » — Sécurité et identifiants : preuve d'identité (mot de passe
// actuel ou connexion Google récente), règles de saisie, historique lisible.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeSecurityEvent,
  isRecentGoogleLogin,
  passwordChangeSchema,
  recentGoogleMinutesLeft,
  RECENT_GOOGLE_LOGIN_MINUTES,
  usernameChangeSchema,
  usernameFormatOk,
} from "./login-credentials-rules";

const now = Date.UTC(2026, 9, 16, 12, 0, 0);
const min = 60 * 1000;

test("seule une connexion Google de moins de 15 minutes vaut preuve", () => {
  assert.equal(isRecentGoogleLogin("google", now - 2 * min, now), true);
  assert.equal(isRecentGoogleLogin("google", now - RECENT_GOOGLE_LOGIN_MINUTES * min, now), true);
  assert.equal(isRecentGoogleLogin("google", now - (RECENT_GOOGLE_LOGIN_MINUTES * min + 1), now), false);
  assert.equal(isRecentGoogleLogin("credentials", now - min, now), false);
  // Session ouverte avant cette version (aucune heure de connexion) : jamais récente.
  assert.equal(isRecentGoogleLogin("google", undefined, now), false);
  assert.equal(isRecentGoogleLogin(undefined, undefined, now), false);
  // Heure dans le futur : refusée.
  assert.equal(isRecentGoogleLogin("google", now + min, now), false);
});

test("minutes restantes affichées", () => {
  assert.equal(recentGoogleMinutesLeft("google", now - 2 * min, now), 13);
  assert.equal(recentGoogleMinutesLeft("google", now - 20 * min, now), 0);
});

test("nom d'utilisateur normalisé en minuscules", () => {
  const r = usernameChangeSchema.safeParse({ username: "  Agent.Test ", currentPassword: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.username, "agent.test");
});

test("nom d'utilisateur invalide refusé (e-mail, accents, trop court, chiffre initial)", () => {
  for (const username of ["agent@exemple.cd", "agént", "ab", "1agent"]) {
    assert.equal(usernameChangeSchema.safeParse({ username, currentPassword: "" }).success, false, username);
    assert.equal(usernameFormatOk(username), false, username);
  }
  assert.equal(usernameFormatOk("agent.test"), true);
});

test("mot de passe : 8 caractères et confirmation identique", () => {
  const p = (password: string, confirmation: string) => passwordChangeSchema.safeParse({ password, confirmation, currentPassword: "" }).success;
  assert.equal(p("court", "court"), false);
  assert.equal(p("motdepasse1", "autre12345"), false);
  assert.equal(p("motdepasse1", "motdepasse1"), true);
});

test("historique : l'ancien et le nouveau nom sont affichés, jamais de mot de passe", () => {
  const at = new Date(now);
  const changed = describeSecurityEvent({
    action: "user.username_change",
    createdAt: at,
    oldValue: { username: "ancien.nom" },
    newValue: { username: "nouveau.nom" },
    metadata: { proof: "password" },
  });
  assert.equal(changed.detail, "ancien.nom → nouveau.nom");

  const first = describeSecurityEvent({ action: "user.username_change", createdAt: at, oldValue: { username: null }, newValue: { username: "premier.nom" }, metadata: null });
  assert.equal(first.detail, "défini : premier.nom");

  const pwd = describeSecurityEvent({ action: "user.password_change", createdAt: at, oldValue: null, newValue: null, metadata: { proof: "google_recent" } });
  assert.equal(pwd.label, "Mot de passe modifié");
  assert.equal(pwd.detail, null);

  const legacy = describeSecurityEvent({
    action: "user.login_credentials_update",
    createdAt: at,
    oldValue: null,
    newValue: null,
    metadata: { usernameChanged: true, passwordChanged: true },
  });
  assert.equal(legacy.detail, "nom d'utilisateur et mot de passe");
});
