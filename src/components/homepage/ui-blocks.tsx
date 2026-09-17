import { clsx } from "clsx";
import { Image as ImageIcon, Mail, MessageCircle, Phone, UserRound } from "lucide-react";
import type { LeadershipContact } from "./homepage-data";

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
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "dark" | "light";
}) {
  return (
    <div className={clsx("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <p
          className={clsx(
            "mb-2 text-xs font-semibold uppercase tracking-widest",
            tone === "light" ? "text-blue-300" : "text-blue-600"
          )}
        >
          {eyebrow}
        </p>
      )}
      <h2 className={clsx("text-2xl font-bold sm:text-3xl", tone === "light" ? "text-white" : "text-gray-900")}>
        {title}
      </h2>
      {description && (
        <p className={clsx("mt-3 text-sm sm:text-base", tone === "light" ? "text-gray-300" : "text-gray-600")}>
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
