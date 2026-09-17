import Image from "next/image";
import { Reveal } from "@/components/reveal";
import { SectionHeading, GenericAvatar, ContactIcons } from "./ui-blocks";
import { IPP_LEADER, IPPA_MEMBERS, type LeadershipMember } from "./homepage-data";

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

        <Reveal delay={0.05} className="mx-auto mt-12 flex max-w-xs flex-col items-center text-center">
          <div className="relative aspect-square w-40 overflow-hidden rounded-full bg-gray-100 sm:w-48">
            <Image
              src="/scrollytelling/ipp.png"
              alt={IPP_LEADER.name}
              fill
              sizes="192px"
              className="object-cover"
            />
          </div>
          <h3 className="mt-5 text-lg font-bold text-gray-900">{IPP_LEADER.name}</h3>
          <p className="mt-1 text-sm text-gray-500">{IPP_LEADER.role}</p>
          <div className="mt-3">
            <ContactIcons contact={IPP_LEADER.contact} size="md" />
          </div>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
          {IPPA_MEMBERS.map((member, i) => (
            <Reveal key={member.id} delay={Math.min(i * 0.04, 0.3)}>
              <IppaCard member={member} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function IppaCard({ member }: { member: LeadershipMember }) {
  return (
    <div className="flex flex-col items-center text-center">
      <GenericAvatar className="aspect-square w-24" />
      <h4 className="mt-4 text-sm font-semibold text-gray-900">{member.name}</h4>
      <p className="mt-0.5 text-xs text-gray-500">{member.role}</p>
      {member.attribution && <p className="mt-0.5 text-xs italic text-gray-400">{member.attribution}</p>}
      <div className="mt-2">
        <ContactIcons contact={member.contact} />
      </div>
    </div>
  );
}
