import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">POOL de Goma</h1>
          <p className="mt-1 text-sm text-gray-500">
            Plateforme de gestion du POOL d&apos;inspection scolaire
          </p>
        </div>
        <LoginForm />
        <div className="mt-6 rounded-xl bg-blue-50 p-4 text-xs text-blue-700">
          <p className="font-semibold">Comptes de démonstration :</p>
          <p>chef@poolgoma.test — Chef de POOL</p>
          <p>inspecteur@poolgoma.test — Inspecteur</p>
          <p>exploitant@poolgoma.test — Exploitant</p>
          <p className="mt-1">Mot de passe : Demo1234!</p>
        </div>
      </div>
    </div>
  );
}
