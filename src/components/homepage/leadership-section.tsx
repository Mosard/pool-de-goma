import { Reveal } from "@/components/reveal";
import { SectionHeading, InteractiveCard, PersonSummary } from "./ui-blocks";
import { IPP_LEADER, IPPA_MEMBERS } from "./homepage-data";

export function LeadershipSection() {
  return (
    <section id="direction" className="bg-white px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-6xl">
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
            <PersonSummary member={IPP_LEADER} size="lg" />
          </InteractiveCard>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
          {IPPA_MEMBERS.map((member, i) => (
            <Reveal key={member.id} delay={Math.min(i * 0.04, 0.3)}>
              <InteractiveCard>
                <PersonSummary member={member} size="sm" />
              </InteractiveCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
