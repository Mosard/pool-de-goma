import { Reveal } from "@/components/reveal";
import { SectionHeading, InteractiveCard, PersonSummary } from "./ui-blocks";
import { RdcMapCanvas } from "./rdc-map-canvas";
import type { LeadershipMember } from "./homepage-data";
import { getPublicPools, type PublicPerson } from "@/lib/public-pools";

/** Carte d'un agent publié : nom, fonction, photo autorisée ou visuel neutre. */
export function personMember(person: PublicPerson): LeadershipMember {
  return {
    id: person.key,
    name: person.name,
    role: person.functionLabel,
    photo: person.photoPath ?? undefined,
    photoUnoptimized: true,
    contact: {},
  };
}

/**
 * Bloc « Chef de POOL » : nom et fonction issus de la nomination en base,
 * seulement avec l'accord de l'agent et l'autorisation de publication ;
 * sinon visuel neutre et aucun nom inventé.
 */
export function chiefMember(slug: string, chief: PublicPerson | null): LeadershipMember {
  if (!chief) {
    return { id: `chef-${slug}`, name: "Chef de POOL", role: "Nom à publier", contact: {} };
  }
  return personMember(chief);
}

export async function PoolsSection() {
  const pools = await getPublicPools();

  return (
    <section id="pools" className="relative overflow-hidden px-6 py-20 sm:px-10">
      <div className="pointer-events-none absolute inset-0">
        <RdcMapCanvas />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading
            eyebrow="Organisation territoriale"
            title="Les POOL de l'Inspection"
            description="La Province Éducationnelle Nord-Kivu 1 est organisée en plusieurs POOL, chacun avec son Chef de POOL."
            align="center"
          />
        </Reveal>

        {pools.length === 0 ? (
          <p className="mt-10 text-center text-sm text-gray-500">
            Les fiches des POOL sont en cours de confirmation par l&apos;Inspection.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pools.map((pool, i) => (
              <Reveal key={pool.slug} delay={Math.min(i * 0.03, 0.3)}>
                <InteractiveCard href={`/pools/${pool.slug}`} ariaLabel={`Voir le POOL de ${pool.name}`}>
                  <p className="text-sm font-bold text-gray-900">POOL de {pool.name}</p>
                  <div className="mt-4">
                    <PersonSummary member={chiefMember(pool.slug, pool.chief)} size="sm" />
                  </div>
                </InteractiveCard>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
