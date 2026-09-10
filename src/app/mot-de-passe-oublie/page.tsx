import { ForgotPasswordForm } from "./forgot-password-form";

export default function MotDePasseOubliePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-gray-500">
            Indiquez votre email professionnel pour recevoir un lien de réinitialisation.
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
