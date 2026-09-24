import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: true },
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">IPP Nord-Kivu 1</h1>
          <p className="mt-1 text-sm text-gray-500">
            Plateforme de l&apos;Inspection Principale Provinciale — Nord-Kivu 1
          </p>
        </div>
        <LoginForm />
        <div className="mt-6 rounded-xl bg-blue-50 p-4 text-xs text-blue-700">
          <p className="font-semibold">Comptes de démonstration :</p>
          <p>ipp@ipp-nordkivu1.test — Inspecteur Principal Provincial</p>
          <p>informaticien@ipp-nordkivu1.test — Informaticien</p>
          <p>chef.goma@ipp-nordkivu1.test — Chef de pool (Goma)</p>
          <p>exploitant.goma@ipp-nordkivu1.test — Exploitant de pool (Goma)</p>
          <p>inspecteur.goma@ipp-nordkivu1.test — Inspecteur itinérant (Goma)</p>
          <p>exploitant.ipp@ipp-nordkivu1.test — Exploitant IPP</p>
          <p className="mt-1">Mot de passe : Demo1234!</p>
        </div>
      </div>
    </div>
  );
}
