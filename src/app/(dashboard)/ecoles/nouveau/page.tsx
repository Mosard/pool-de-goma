import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SchoolForm } from "../school-form";
import { createSchoolAction } from "../actions";

export default async function NouvelleEcolePage() {
  const session = await auth();
  if (session?.user.role !== "CHEF_POOL") redirect("/ecoles");

  return (
    <div>
      <PageHeader title="Nouvelle école" description="Ajouter une école au POOL" />
      <SchoolForm action={createSchoolAction} />
    </div>
  );
}
