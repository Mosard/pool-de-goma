import { Reveal } from "@/components/reveal";
import { SectionHeading, InteractiveCard, PersonSummary } from "./ui-blocks";
import { RdcMapCanvas } from "./rdc-map-canvas";
import type { LeadershipMember } from "./homepage-data";
import { getPoolCards, type PoolCard } from "@/lib/pool-showcase";

/**
 * Bloc « Chef de POOL » d'une carte : nom et fonction issus de la nomination
 * officielle (avec accord et autorisation de publication) ; sinon visuel
 * neutre. Une maquette n'affiche jamais de personne fictive sur l'accueil.
 */
function chiefMember(card: PoolCard): LeadershipMember {
  if (!card.chief) {
    return {
      id: `chef-${card.slug}`,
      name: "Chef de POOL",
      role: card.mode === "demo" ? "Page en maquette" : "Nom à publier",
      contact: {},
    };
  }
  return {
    id: card.chief.key,
    name: card.chief.name,
    role: card.chief.functionLabel,
    photo: card.chief.photo ?? undefined,
    photoUnoptimized: true,
    contact: {},
  };
}

export async function PoolsSection() {
  const cards = await getPoolCards();

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

        {cards.length === 0 ? (
          <p className="mt-10 text-center text-sm text-gray-500">
            Les fiches des POOL sont en cours de confirmation par l&apos;Inspection.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, i) => (
              <Reveal key={card.slug} delay={Math.min(i * 0.03, 0.3)}>
                <InteractiveCard href={`/pools/${card.slug}`} ariaLabel={`Voir le POOL de ${card.name}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900">POOL de {card.name}</p>
                    {card.mode === "demo" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        Maquette
                      </span>
                    )}
                    {card.mode === "pending" && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                        Fiche en cours de confirmation
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <PersonSummary member={chiefMember(card)} size="sm" />
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
