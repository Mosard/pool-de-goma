import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card, PageHeader, Badge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/permissions";
import { toggleUserActiveAction } from "./actions";

export default async function UtilisateursPage() {
  const session = await auth();
  if (session?.user.role !== "CHEF_POOL") redirect("/dashboard");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description={`${users.length} utilisateur(s)`}
        actions={
          <Link href="/utilisateurs/nouveau">
            <Button>Nouvel utilisateur</Button>
          </Link>
        }
      />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
            <tr>
              <th className="px-6 py-3">Nom</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Rôle</th>
              <th className="px-6 py-3">Statut</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-blue-50/40">
                <td className="px-6 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-6 py-3 text-gray-600">{u.email}</td>
                <td className="px-6 py-3 text-gray-600">{ROLE_LABELS[u.role]}</td>
                <td className="px-6 py-3">
                  <Badge color={u.active ? "green" : "gray"}>
                    {u.active ? "Actif" : "Désactivé"}
                  </Badge>
                </td>
                <td className="px-6 py-3 text-right">
                  <form action={toggleUserActiveAction.bind(null, u.id)}>
                    <button
                      type="submit"
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      {u.active ? "Désactiver" : "Activer"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
