import Image from "next/image";
import { clsx } from "clsx";
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

        <Reveal delay={0.05} className="mx-auto mt-12">
          <PersonCard member={IPP_LEADER} size="lg" />
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
          {IPPA_MEMBERS.map((member, i) => (
            <Reveal key={member.id} delay={Math.min(i * 0.04, 0.3)}>
              <PersonCard member={member} size="sm" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// Un seul gabarit pour l'IPP et les IPPA : même structure (photo ou avatar
// générique, nom, fonction, attribution, contacts), seule la taille change.
// Prêt à être alimenté par une vraie liste "direction" venant d'une base de
// données plutôt que de ce fichier, sans réécrire le rendu.
function PersonCard({ member, size }: { member: LeadershipMember; size: "lg" | "sm" }) {
  const isLg = size === "lg";
  const photoSize = isLg ? "w-40 sm:w-48" : "w-24";

  return (
    <div className={clsx("mx-auto flex flex-col items-center text-center", isLg && "max-w-xs")}>
      {member.photo ? (
        <div className={clsx("relative aspect-square overflow-hidden rounded-full bg-gray-100", photoSize)}>
          <Image
            src={member.photo}
            alt={member.name}
            fill
            sizes={isLg ? "192px" : "96px"}
            className="object-cover"
          />
        </div>
      ) : (
        <GenericAvatar className={clsx("aspect-square", photoSize)} />
      )}
      <h3 className={clsx("font-bold text-gray-900", isLg ? "mt-5 text-lg" : "mt-4 text-sm")}>{member.name}</h3>
      <p className={clsx("text-gray-500", isLg ? "mt-1 text-sm" : "mt-0.5 text-xs")}>{member.role}</p>
      {member.attribution && <p className="mt-0.5 text-xs italic text-gray-400">{member.attribution}</p>}
      <div className={isLg ? "mt-3" : "mt-2"}>
        <ContactIcons contact={member.contact} size={isLg ? "md" : "sm"} />
      </div>
    </div>
  );
}
