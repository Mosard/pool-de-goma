import { Reveal } from "@/components/reveal";
import { SectionHeading } from "./ui-blocks";

export function PoolsSection({ pools }: { pools: { id: string; name: string }[] }) {
  return (
    <section id="pools" className="bg-gray-50 px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading
            eyebrow="Organisation territoriale"
            title="Les POOL de l'Inspection"
            description="La Province Éducationnelle Nord-Kivu 1 est organisée en plusieurs POOL, chacun couvrant un territoire et ses établissements scolaires."
            align="center"
          />
        </Reveal>

        {pools.length > 0 ? (
          <Reveal delay={0.05} className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {pools.map((pool) => (
              <div
                key={pool.id}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-5 text-center text-sm font-semibold text-gray-900 shadow-sm"
              >
                POOL de {pool.name}
              </div>
            ))}
          </Reveal>
        ) : (
          <p className="mt-10 text-center text-sm text-gray-500">
            La liste des POOL sera affichée dès qu&apos;elle sera configurée dans l&apos;administration.
          </p>
        )}

        <p className="mt-8 text-center text-xs text-gray-400">
          Chaque POOL dispose d&apos;une équipe dédiée. Les pages détaillées par POOL seront ajoutées prochainement.
        </p>
      </div>
    </section>
  );
}
