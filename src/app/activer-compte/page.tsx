import type { Metadata } from "next";
import { ResetPasswordForm } from "../reinitialiser-mot-de-passe/reset-password-form";

// L'URL porte un jeton d'activation : jamais indexée ni suivie.
export const metadata: Metadata = {
  title: "Activer mon compte",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ActiverComptePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Activer mon compte</h1>
          <p className="mt-2 text-sm text-gray-600">
            Choisissez votre mot de passe. Personne d&apos;autre que vous ne le connaîtra.
          </p>
        </div>
        {token ? (
          <ResetPasswordForm token={token} mode="activate" />
        ) : (
          <p className="text-center text-sm text-red-600">Lien d&apos;activation manquant ou invalide.</p>
        )}
      </div>
    </div>
  );
}
