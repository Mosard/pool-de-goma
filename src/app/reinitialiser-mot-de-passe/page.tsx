import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export default async function ReinitialiserMotDePassePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Réinitialiser le mot de passe</h1>
        </div>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-center text-sm text-red-600">Lien de réinitialisation manquant ou invalide.</p>
        )}
      </div>
    </div>
  );
}
