// Identifiant et mot de passe choisis depuis « Mon profil » : preuve
// d'identité (mot de passe actuel ou connexion Google récente) et règles.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isRecentGoogleLogin,
  ownCredentialsSchema,
  recentGoogleMinutesLeft,
  RECENT_GOOGLE_LOGIN_MINUTES,
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

const base = { username: "agent.test", password: "", confirmation: "", currentPassword: "" };

test("identifiant seul accepté, normalisé en minuscules", () => {
  const r = ownCredentialsSchema.safeParse({ ...base, username: "  Agent.Test " });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.username, "agent.test");
});

test("identifiant invalide refusé (e-mail, accents, trop court)", () => {
  for (const username of ["agent@exemple.cd", "agént", "ab", "1agent"]) {
    assert.equal(ownCredentialsSchema.safeParse({ ...base, username }).success, false, username);
  }
});

test("mot de passe : 8 caractères, confirmation identique, différent de l'identifiant", () => {
  assert.equal(ownCredentialsSchema.safeParse({ ...base, password: "court", confirmation: "court" }).success, false);
  assert.equal(ownCredentialsSchema.safeParse({ ...base, password: "motdepasse1", confirmation: "autre12345" }).success, false);
  assert.equal(ownCredentialsSchema.safeParse({ ...base, password: "Agent.Test", confirmation: "Agent.Test" }).success, false);
  assert.equal(ownCredentialsSchema.safeParse({ ...base, password: "motdepasse1", confirmation: "motdepasse1" }).success, true);
});
