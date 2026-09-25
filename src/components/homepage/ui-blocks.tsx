import Link from "next/link";
import Image from "next/image";
import { clsx } from "clsx";
import { Image as ImageIcon, Mail, MessageCircle, Phone, UserRound } from "lucide-react";
import type { LeadershipContact, LeadershipMember } from "./homepage-data";

// Espace réservé propre et homogène pour les futurs visuels (générés
// ultérieurement) — même gabarit partout pour garantir la cohérence des
// formats tant que les images définitives ne sont pas intégrées.
export function PlaceholderMedia({
  label,
  className,
  rounded = "rounded-2xl",
}: {
  label: string;
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-center justify-center border border-dashed border-gray-300 bg-gray-50",
        rounded,
        className
      )}
    >
      <div className="px-4 text-center">
        <ImageIcon className="mx-auto mb-2 text-gray-300" size={26} strokeWidth={1.5} />
        <p className="text-xs font-medium text-gray-400">{label}</p>
      </div>
    </div>
  );
}

// Icônes nues (pas de bouton, pas de fond) — seule la couleur change au
// survol, très légèrement, pour rester discret sur les cartes de direction.
export function ContactIcons({
  contact,
  size = "sm",
}: {
  contact: LeadershipContact;
  size?: "sm" | "md";
}) {
  const iconSize = size === "md" ? 18 : 16;
  const { phone, whatsapp, email } = contact;

  if (!phone && !whatsapp && !email) return null;

  return (
    <div className="flex items-center justify-center gap-3">
      {phone && (
        <a
          href={`tel:${phone}`}
          aria-label="Appeler"
          className="text-gray-400 transition-colors duration-200 hover:text-blue-600"
        >
          <Phone size={iconSize} strokeWidth={1.75} />
        </a>
      )}
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Contacter sur WhatsApp"
          className="text-gray-400 transition-colors duration-200 hover:text-emerald-600"
        >
          <MessageCircle size={iconSize} strokeWidth={1.75} />
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          aria-label="Envoyer un e-mail"
          className="text-gray-400 transition-colors duration-200 hover:text-blue-600"
        >
          <Mail size={iconSize} strokeWidth={1.75} />
        </a>
      )}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "dark",
  shadow = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "dark" | "light";
  // Ombre portée pour le texte clair posé directement sur une photo (plutôt
  // qu'un fond uni) — les zones claires d'une vraie photo (fenêtre, mur)
  // peuvent sinon rendre le texte illisible même avec un voile sombre.
  shadow?: boolean;
}) {
  return (
    <div className={clsx("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <p
          className={clsx(
            "mb-2 text-xs font-semibold uppercase tracking-widest",
            tone === "light" ? "text-blue-300" : "text-blue-600",
            shadow && "[text-shadow:0_1px_10px_rgba(0,0,0,0.85)]"
          )}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={clsx(
          "text-2xl font-bold sm:text-3xl",
          tone === "light" ? "text-white" : "text-gray-900",
          shadow && "[text-shadow:0_2px_18px_rgba(0,0,0,0.9),0_1px_4px_rgba(0,0,0,0.95)]"
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={clsx(
            "mt-3 text-sm sm:text-base",
            tone === "light" ? "text-gray-200" : "text-gray-600",
            shadow && "[text-shadow:0_1px_10px_rgba(0,0,0,0.85)]"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

// Avatar générique (icône SVG sur fond uni) pour les membres de la direction
// dont la photo réelle n'est pas encore disponible — volontairement neutre,
// pour ne jamais faire passer une photo de tiers pour la leur.
export function GenericAvatar({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center justify-center rounded-full bg-blue-50 text-blue-300", className)}>
      <UserRound className="h-1/2 w-1/2" strokeWidth={1.5} />
    </div>
  );
}

// Langage visuel commun (inspiré de Rapyogo) pour toutes les cartes
// cliquables/interactives du site : bordure fine, lumière intérieure très
// discrète et petite translation au survol, contraste légèrement renforcé —
// pas de rebond ni d'effet agressif. Utilisé par les cartes IPP/IPPA et les
// cartes POOL pour qu'elles appartiennent visiblement à la même famille.
export function InteractiveCard({
  href,
  ariaLabel,
  className,
  children,
}: {
  href?: string;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "group relative rounded-2xl border border-gray-200 bg-white/80 p-6 transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg",
        className
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 0 28px rgba(37,99,235,0.06)",
        }}
      />
      {href && (
        <Link href={href} aria-label={ariaLabel} className="absolute inset-0 z-0 rounded-2xl">
          <span className="sr-only">{ariaLabel}</span>
        </Link>
      )}
      {/* With a card link, the content lets clicks through to it; nested
          links (tel:, mailto:) stay clickable. */}
      <div className={clsx("relative z-10", href && "pointer-events-none [&_a]:pointer-events-auto")}>
        {children}
      </div>
    </div>
  );
}

// Contenu d'une fiche personne (photo ou avatar générique, nom, fonction,
// attribution, contacts) — sans chrome de carte, pour être réutilisé aussi
// bien à l'intérieur d'une InteractiveCard (IPP, IPPA, chef de POOL sur une
// carte POOL) que dans une vue détaillée.
export function PersonSummary({ member, size }: { member: LeadershipMember; size: "lg" | "sm" }) {
  const isLg = size === "lg";
  const photoSize = isLg ? "w-40 sm:w-48" : "w-24";

  return (
    <div className={clsx("flex flex-col items-center text-center", isLg && "mx-auto max-w-xs")}>
      {member.photo ? (
        <div className={clsx("relative aspect-square overflow-hidden rounded-full bg-gray-100", photoSize)}>
          <Image
            src={member.photo}
            alt={member.name}
            fill
            sizes={isLg ? "192px" : "96px"}
            unoptimized={member.photoUnoptimized}
            className="object-cover"
          />
        </div>
      ) : (
        <GenericAvatar className={clsx("aspect-square", photoSize)} />
      )}
      <h3 className={clsx("font-bold text-gray-900", isLg ? "mt-5 text-lg" : "mt-4 text-sm")}>{member.name}</h3>
      <p className={clsx("text-gray-500", isLg ? "mt-1 text-sm" : "mt-0.5 text-xs")}>{member.role}</p>
      {member.attribution && <p className="mt-0.5 text-xs italic text-gray-400">{member.attribution}</p>}
      <div className={clsx("relative z-10", isLg ? "mt-3" : "mt-2")}>
        <ContactIcons contact={member.contact} size={isLg ? "md" : "sm"} />
      </div>
    </div>
  );
}

export function YoutubeEmbed({
  videoId,
  title,
  caption,
}: {
  videoId: string;
  title: string;
  caption?: string;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="relative aspect-video w-full bg-gray-100">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      {caption && <figcaption className="px-5 py-4 text-sm text-gray-600">{caption}</figcaption>}
    </figure>
  );
}
