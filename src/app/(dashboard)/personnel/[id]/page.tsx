import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Avatar, Badge, Button, Card, PageHeader } from "@/components/ui";
import { ForbiddenError } from "@/lib/permissions";
import { getPersonnelRecord } from "@/lib/personnel/server";
import {
  STATUS_LABELS,
  displayBirthDate,
  displaySex,
  displayText,
  displayYesNo,
  functionLabels,
} from "@/lib/personnel/record";

// Fiche du personnel en LECTURE SEULE (décisions du 2026-10-10) : aucun droit
// de modification ni d'export n'est ajouté. Consultation journalisée.

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{children}</dl>
    </Card>
  );
}

export default async function PersonnelRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  let r;
  try {
    r = await getPersonnelRecord(session.user.id, id);
  } catch (e) {
    if (e instanceof ForbiddenError) redirect("/dashboard");
    throw e;
  }
  if (!r) notFound();
  const functions = functionLabels(r);

  return (
    <div className="space-y-6">
      <PageHeader
        title={r.name}
        description="Fiche du personnel — lecture seule"
        actions={
          <Link href="/personnel">
            <Button type="button" variant="secondary">Retour à la recherche</Button>
          </Link>
        }
      />

      <Card className="flex items-center gap-4">
        <Avatar name={r.name} src={r.photoUrl} className="h-16 w-16 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-gray-900">{r.name}</p>
          <Badge color={r.status === "ACTIVE" ? "green" : "gray"}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
        </div>
      </Card>

      <Section title="Identité">
        <Field label="Nom complet" value={displayText(r.name)} />
        <Field label="Postnom" value={displayText(r.postnom)} />
        <Field label="Prénom" value={displayText(r.prenom)} />
        <Field label="Sexe" value={displaySex(r.sex)} />
        <Field label="Date de naissance" value={displayBirthDate(r.dateNaissance)} />
      </Section>

      <Section title="Coordonnées">
        <Field label="Adresse e-mail" value={displayText(r.email)} />
        <Field label="Téléphone" value={displayText(r.phone)} />
      </Section>

      <Section title="Fonction et affectation">
        <div className="sm:col-span-2">
          <dt className="text-gray-500">Fonction(s)</dt>
          <dd className="font-medium text-gray-900">
            {functions.length === 0 ? "Aucune fonction" : (
              <ul className="space-y-1">
                {functions.map((f, i) => (
                  <li key={`${f}-${i}`}>{f}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <Field label="POOL de rattachement" value={displayText(r.pool?.name)} />
      </Section>

      <Section title="Informations familiales">
        <Field label="Nombre d'enfants" value={displayText(r.nombreEnfants)} />
      </Section>

      <Section title="Informations administratives">
        <Field label="Matricule" value={displayText(r.matricule)} />
        <Field label="Statut administratif" value={displayText(r.statutAdministratif)} />
        <Field label="Mécanisé" value={displayYesNo(r.mecanise)} />
      </Section>

      <p className="text-xs text-gray-400">
        Informations enregistrées dans l&apos;application, telles que saisies. Cette consultation est inscrite au journal d&apos;audit.
      </p>
    </div>
  );
}
