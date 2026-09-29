import { Reveal } from "@/components/reveal";
import { SectionHeading, InteractiveCard, PersonSummary } from "./ui-blocks";
import { RdcMapCanvas } from "./rdc-map-canvas";
import type { LeadershipMember } from "./homepage-data";
import { getPublicDirection, type PublicDirectionCard, type PublicDirectionPerson } from "@/lib/public-direction";

const IPP_ROLE = "Inspecteur Principal Provincial — Nord-Kivu 1";
const IPA_ROLE = "Inspecteur Principal Adjoint";

// Données officielles du back-office (src/lib/public-direction.ts) : une place
// non publiée reste neutre (fonction, attribution saisie), jamais de faux nom
// ni de faux portrait.
function ippMember(ipp: PublicDirectionPerson | null): LeadershipMember {
  if (!ipp) return { id: "ipp", name: "Inspecteur Principal Provincial", role: "Nord-Kivu 1 — nom à publier", contact: {} };
  return {
    id: ipp.key,
    name: ipp.name,
    role: IPP_ROLE,
    photo: ipp.photoPath ?? undefined,
    photoUnoptimized: true,
    contact: {},
  };
}

function adjointMember(card: PublicDirectionCard): LeadershipMember {
  if (card.kind === "vacant") {
    return { id: card.key, name: IPA_ROLE, role: "Nom à publier", attribution: card.attribution, contact: {} };
  }
  return {
    id: card.person.key,
    name: card.person.name,
    role: IPA_ROLE,
    photo: card.person.photoPath ?? undefined,
    photoUnoptimized: true,
    attribution: card.attributions.length > 0 ? card.attributions.join(", ") : undefined,
    contact: {},
  };
}

export async function LeadershipSection() {
  const { ipp, adjoints } = await getPublicDirection();

  return (
    <section id="direction" className="relative overflow-hidden px-6 py-20 sm:px-10">
      <div className="pointer-events-none absolute inset-0">
        <RdcMapCanvas />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading
            eyebrow="Gouvernance"
            title="Direction de l'Inspection"
            description="L'équipe qui pilote l'Inspection Principale Provinciale — Nord-Kivu 1."
            align="center"
          />
        </Reveal>

        <Reveal delay={0.05} className="mx-auto mt-12 max-w-xs">
          <InteractiveCard>
            <PersonSummary member={ippMember(ipp)} size="lg" />
          </InteractiveCard>
        </Reveal>

        {adjoints.length > 0 ? (
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
            {adjoints.map((card, i) => {
              const member = adjointMember(card);
              return (
                <Reveal key={member.id} delay={Math.min(i * 0.04, 0.3)}>
                  <InteractiveCard className="h-full !p-4 sm:!p-6">
                    <PersonSummary member={member} size="sm" />
                  </InteractiveCard>
                </Reveal>
              );
            })}
          </div>
        ) : (
          <p className="mt-12 text-center text-sm text-gray-500">
            Les Inspecteurs Principaux Adjoints seront présentés ici dès leur publication.
          </p>
        )}
      </div>
    </section>
  );
}
