"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { Alert, Button, Card, FieldError, Input, Label, Notice } from "@/components/ui";
import { signInWithGoogleAction } from "@/app/login/actions";
import { updateLoginCredentialsAction, type LoginCredentialsState } from "./actions";

const initialState: LoginCredentialsState = {};

export function LoginCredentialsForm({
  currentUsername,
  email,
  usernameRule,
  recentMinutes,
  googleMinutesLeft,
  googleEnabled,
}: {
  currentUsername: string | null;
  email: string;
  usernameRule: string;
  /** Durée pendant laquelle une connexion Google remplace le mot de passe actuel. */
  recentMinutes: number;
  /** > 0 : connexion Google récente, le mot de passe actuel n'est pas demandé. */
  googleMinutesLeft: number;
  googleEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateLoginCredentialsAction, initialState);
  const errors = state.errors ?? {};
  const username = state.success?.username ?? currentUsername ?? "";

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <KeyRound size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">Connexion par identifiant</h3>
          <p className="mt-0.5 text-pretty text-xs text-gray-500">
            Pour vous connecter sans Google (appareil partagé, navigateur sans compte Google) : saisissez votre identifiant
            (ou votre e-mail) et votre mot de passe sur la page de connexion. La connexion avec Google reste possible.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-gray-500">Identifiant actuel</dt>
          <dd className="font-medium text-gray-900">{username ? <span className="font-mono">{username}</span> : "Aucun"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-gray-500">E-mail (utilisable aussi comme identifiant)</dt>
          <dd className="truncate font-medium text-gray-900">{email}</dd>
        </div>
      </dl>

      {state.success && (
        <div className="mt-4">
          <Alert variant="success">
            Enregistré. Vous pouvez vous connecter avec l&apos;identifiant{" "}
            <strong className="font-mono">{state.success.username}</strong>
            {state.success.passwordChanged ? " et votre nouveau mot de passe." : " et votre mot de passe actuel."}
          </Alert>
        </div>
      )}
      {state.formError && (
        <div className="mt-4">
          <Alert variant="error">{state.formError}</Alert>
        </div>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <Label htmlFor="cred-username">Identifiant de connexion</Label>
          <Input
            id="cred-username"
            name="username"
            key={username}
            defaultValue={username}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ex. jean.kambale"
            required
          />
          <p className="mt-1 text-xs text-gray-500">{usernameRule}</p>
          <FieldError message={errors.username} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cred-password">Nouveau mot de passe</Label>
            <Input id="cred-password" name="password" type="password" autoComplete="new-password" />
            <p className="mt-1 text-xs text-gray-500">8 caractères minimum. Laissez vide pour ne changer que l&apos;identifiant.</p>
            <FieldError message={errors.password} />
          </div>
          <div>
            <Label htmlFor="cred-confirmation">Confirmez le mot de passe</Label>
            <Input id="cred-confirmation" name="confirmation" type="password" autoComplete="new-password" />
            <FieldError message={errors.confirmation} />
          </div>
        </div>

        {googleMinutesLeft > 0 ? (
          <Notice tone="info">
            Connexion Google récente vérifiée : votre mot de passe actuel n&apos;est pas demandé (encore {googleMinutesLeft} min).
          </Notice>
        ) : (
          <div>
            <Label htmlFor="cred-current">Mot de passe actuel</Label>
            <Input id="cred-current" name="currentPassword" type="password" autoComplete="current-password" />
            <p className="mt-1 text-xs text-gray-500">
              Vous vous connectez uniquement avec Google et n&apos;avez jamais eu de mot de passe ? Reconnectez-vous avec Google
              ci-dessous, puis revenez ici dans les {recentMinutes} minutes : le mot de passe actuel ne sera pas demandé.
            </p>
            <FieldError message={errors.currentPassword} />
          </div>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>

      {googleMinutesLeft === 0 && googleEnabled && (
        <form action={signInWithGoogleAction} className="mt-3">
          <input type="hidden" name="callbackUrl" value="/profil" />
          <Button type="submit" variant="outline" size="sm">
            Me reconnecter avec Google
          </Button>
        </form>
      )}
    </Card>
  );
}
