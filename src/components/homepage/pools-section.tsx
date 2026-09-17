import { Reveal } from "@/components/reveal";
import { SectionHeading, InteractiveCard, PersonSummary } from "./ui-blocks";
import { RdcMapCanvas } from "./rdc-map-canvas";
import { POOLS } from "./homepage-data";

export function PoolsSection() {
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

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {POOLS.map((pool, i) => (
            <Reveal key={pool.slug} delay={Math.min(i * 0.03, 0.3)}>
              <InteractiveCard href={`/pools/${pool.slug}`} ariaLabel={`Voir le POOL de ${pool.name}`}>
                <p className="text-sm font-bold text-gray-900">POOL de {pool.name}</p>
                <div className="mt-4">
                  <PersonSummary member={pool.chief} size="sm" />
                </div>
              </InteractiveCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
