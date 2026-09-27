"use client";

import { Card, Button } from "@/components/ui";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <h2 className="text-lg font-semibold text-gray-900">Un problème est survenu</h2>
        <p className="mt-2 text-sm text-gray-600">
          L&apos;action n&apos;a pas pu aboutir : connexion indisponible, erreur temporaire, ou action refusée
          pour votre compte (un compte de démonstration ne peut pas modifier les données officielles). Vos
          informations n&apos;ont pas été perdues.
        </p>
        <Button className="mt-6" onClick={() => reset()}>
          Réessayer
        </Button>
      </Card>
    </div>
  );
}
