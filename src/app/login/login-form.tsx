"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, Label, FieldError } from "@/components/ui";
import { loginAction, signInWithGoogleAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="vous@ipp-nordkivu1.test" required />
          <FieldError message={state.errors?.email} />
        </div>
        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" name="password" type="password" required />
          <FieldError message={state.errors?.password} />
          <Link href="/mot-de-passe-oublie" className="mt-1.5 inline-block text-xs font-medium text-blue-600 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        {state.formError && <FieldError message={state.formError} />}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Connexion..." : "Se connecter"}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">ou</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <form action={signInWithGoogleAction}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Button type="submit" variant="ghost" className="w-full border border-gray-200">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v3h3.87c2.26-2.08 3.55-5.14 3.55-8.82z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09C3.25 21.3 7.31 24 12 24z" />
            <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.63H1.28A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.28 5.37l3.99-3.09z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.63l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
          </svg>
          Continuer avec Google
        </Button>
      </form>
    </Card>
  );
}
