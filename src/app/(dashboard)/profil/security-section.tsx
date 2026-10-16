"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, History, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { Alert, Button, Card, FieldError, Input, Label, Notice } from "@/components/ui";
import { signInWithGoogleAction } from "@/app/login/actions";
import {
  checkUsernameAction,
  updatePasswordAction,
  updateUsernameAction,
  type PasswordFormState,
  type UsernameFormState,
} from "./actions";

type HistoryItem = { at: string; label: string; detail: string | null };
type Proof = { googleMinutesLeft: number; recentMinutes: number };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lubumbashi" });

/** Preuve d'identité : mot de passe actuel, ou rien si la connexion Google est récente. */
function ProofField({ id, googleMinutesLeft, recentMinutes, error }: Proof & { id: string; error?: string }) {
  if (googleMinutesLeft > 0) {
    return (
      <Notice tone="info">
        Connexion Google récente vérifiée : votre mot de passe actuel n&apos;est pas demandé (encore {googleMinutesLeft} min).
      </Notice>
    );
  }
  return (
    <div>
      <Label htmlFor={id}>Mot de passe actuel</Label>
      <Input id={id} name="currentPassword" type="password" autoComplete="current-password" />
      <p className="mt-1 text-xs text-gray-500">
        Vous vous connectez uniquement avec Google ? Utilisez « Me reconnecter avec Google » ci-dessous, puis revenez ici dans
        les {recentMinutes} minutes : le mot de passe actuel ne sera pas demandé.
      </p>
      <FieldError message={error} />
    </div>
  );
}

function UsernameEditor({
  current,
  usernameRule,
  proof,
  onDone,
  onCancel,
}: {
  current: string | null;
  usernameRule: string;
  proof: Proof;
  onDone: (s: NonNullable<UsernameFormState["success"]>) => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateUsernameAction, {} as UsernameFormState);
  const [value, setValue] = useState(current ?? "");
  const [check, setCheck] = useState<{ value: string; status: string; message: string } | null>(null);
  const latest = useRef("");

  useEffect(() => {
    if (state.success) onDone(state.success);
  }, [state.success, onDone]);

  // Disponibilité vérifiée pendant la saisie (après une courte pause).
  useEffect(() => {
    const v = value.trim().toLowerCase();
    latest.current = v;
    if (!v) return;
    const t = setTimeout(async () => {
      const res = await checkUsernameAction(v);
      if (latest.current === v) setCheck({ value: v, ...res });
    }, 400);
    return () => clearTimeout(t);
  }, [value]);

  const normalized = value.trim().toLowerCase();
  const shown = check && check.value === normalized ? check : null;
  const blocked = !normalized || (shown !== null && shown.status !== "available");

  return (
    <form action={formAction} className="mt-3 space-y-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <div>
        <Label htmlFor="sec-username">Nouveau nom d&apos;utilisateur</Label>
        <Input
          id="sec-username"
          name="username"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-describedby="sec-username-etat"
        />
        <p id="sec-username-etat" aria-live="polite" className="mt-1 min-h-4 text-xs">
          {shown ? (
            <span className={shown.status === "available" ? "text-emerald-700" : "text-amber-700"}>{shown.message}</span>
          ) : (
            <span className="text-gray-500">{usernameRule}</span>
          )}
        </p>
        <FieldError message={state.errors?.username} />
      </div>
      <ProofField id="sec-username-current" {...proof} error={state.errors?.currentPassword} />
      {state.formError && <Alert variant="error">{state.formError}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || blocked}>
          {pending ? "Enregistrement…" : "Enregistrer le nom"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

function PasswordEditor({ proof, onDone, onCancel }: { proof: Proof; onDone: () => void; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(updatePasswordAction, {} as PasswordFormState);

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="mt-3 space-y-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sec-password">Nouveau mot de passe</Label>
          <Input id="sec-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          <p className="mt-1 text-xs text-gray-500">8 caractères minimum.</p>
          <FieldError message={state.errors?.password} />
        </div>
        <div>
          <Label htmlFor="sec-confirmation">Confirmez le mot de passe</Label>
          <Input id="sec-confirmation" name="confirmation" type="password" autoComplete="new-password" required />
          <FieldError message={state.errors?.confirmation} />
        </div>
      </div>
      <ProofField id="sec-password-current" {...proof} error={state.errors?.currentPassword} />
      {state.formError && <Alert variant="error">{state.formError}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

export function SecuritySection({
  username,
  email,
  usernameRule,
  recentMinutes,
  googleMinutesLeft,
  googleEnabled,
  history,
}: {
  username: string | null;
  email: string;
  usernameRule: string;
  recentMinutes: number;
  /** > 0 : connexion Google récente, le mot de passe actuel n'est pas demandé. */
  googleMinutesLeft: number;
  googleEnabled: boolean;
  history: HistoryItem[];
}) {
  const [editing, setEditing] = useState<"username" | "password" | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const proof = { googleMinutesLeft, recentMinutes };

  const open = (what: "username" | "password") => {
    setConfirmation(null);
    setEditing(what);
  };

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <ShieldCheck size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Sécurité et identifiants</h2>
          <p className="mt-0.5 text-pretty text-xs text-gray-500">
            Pour vous connecter : votre nom d&apos;utilisateur (ou votre e-mail) et votre mot de passe, ou Google. Changer
            de nom d&apos;utilisateur ne modifie ni votre compte, ni vos données, ni l&apos;historique de vos opérations.
          </p>
        </div>
      </div>

      {confirmation && (
        <div className="mt-4">
          <Alert variant="success">
            <span className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
              {confirmation}
            </span>
          </Alert>
        </div>
      )}

      <dl className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200">
        <div className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <UserRound size={18} className="shrink-0 text-gray-400" aria-hidden />
              <div className="min-w-0">
                <dt className="text-xs text-gray-500">Nom d&apos;utilisateur</dt>
                <dd className="font-medium text-gray-900">{username ? <span className="font-mono">{username}</span> : "Aucun"}</dd>
              </div>
            </div>
            {editing !== "username" && (
              <Button type="button" variant="outline" size="sm" onClick={() => open("username")}>
                {username ? "Modifier" : "Choisir un nom d'utilisateur"}
              </Button>
            )}
          </div>
          {editing === "username" && (
            <UsernameEditor
              current={username}
              usernameRule={usernameRule}
              proof={proof}
              onCancel={() => setEditing(null)}
              onDone={(s) => {
                setEditing(null);
                setConfirmation(
                  s.previous
                    ? `Nom d'utilisateur modifié : « ${s.previous} » est remplacé par « ${s.username} ». Utilisez désormais « ${s.username} » pour vous connecter.`
                    : `Nom d'utilisateur enregistré : « ${s.username} ». Vous pouvez l'utiliser pour vous connecter.`
                );
              }}
            />
          )}
        </div>

        <div className="flex min-w-0 items-center gap-3 px-4 py-3">
          <span className="w-[18px] shrink-0 text-center text-gray-400" aria-hidden>
            @
          </span>
          <div className="min-w-0">
            <dt className="text-xs text-gray-500">E-mail (utilisable aussi pour vous connecter)</dt>
            <dd className="truncate font-medium text-gray-900">{email}</dd>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <KeyRound size={18} className="shrink-0 text-gray-400" aria-hidden />
              <div>
                <dt className="text-xs text-gray-500">Mot de passe</dt>
                <dd className="font-medium tracking-widest text-gray-900">
                  <span aria-hidden>••••••••</span>
                  <span className="sr-only">Masqué</span>
                </dd>
              </div>
            </div>
            {editing !== "password" && (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => open("password")}>
                  Modifier le mot de passe
                </Button>
                <button
                  type="button"
                  onClick={() => setShowForgot((v) => !v)}
                  aria-expanded={showForgot}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}
          </div>
          {showForgot && editing !== "password" && (
            <div className="mt-3 space-y-1 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
              <p>
                <strong className="font-medium text-gray-800">Compte relié à Google :</strong> reconnectez-vous avec Google
                ci-dessous, puis « Modifier le mot de passe » : l&apos;ancien ne sera pas demandé pendant {recentMinutes} minutes.
              </p>
              <p>
                <strong className="font-medium text-gray-800">Sinon :</strong> demandez à l&apos;informaticien de
                l&apos;Inspection un lien de réinitialisation (valable 24 h, utilisable une seule fois).
              </p>
            </div>
          )}
          {editing === "password" && (
            <PasswordEditor
              proof={proof}
              onCancel={() => setEditing(null)}
              onDone={() => {
                setEditing(null);
                setConfirmation("Mot de passe modifié. Utilisez votre nouveau mot de passe à la prochaine connexion.");
              }}
            />
          )}
        </div>
      </dl>

      {googleMinutesLeft === 0 && googleEnabled && (
        <form action={signInWithGoogleAction} className="mt-3">
          <input type="hidden" name="callbackUrl" value="/profil" />
          <Button type="submit" variant="ghost" size="sm">
            Me reconnecter avec Google
          </Button>
        </form>
      )}

      <div className="mt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <History size={16} className="text-gray-400" aria-hidden />
          Historique de sécurité
        </h3>
        {history.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">Aucune modification enregistrée pour l&apos;instant.</p>
        ) : (
          <ol className="mt-2 divide-y divide-gray-100">
            {history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
                <span className="text-gray-800">
                  {h.label}
                  {h.detail && <span className="ml-2 font-mono text-xs text-gray-500">{h.detail}</span>}
                </span>
                <time dateTime={h.at} className="text-xs tabular-nums text-gray-500">
                  {dateFormat.format(new Date(h.at))}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
