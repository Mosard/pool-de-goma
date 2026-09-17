import { clsx } from "clsx";
import { Image as ImageIcon, Mail, MessageCircle, Phone } from "lucide-react";
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

const contactLinkClass =
  "flex items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600";

export function ContactIcons({
  contact,
  size = "sm",
}: {
  contact: LeadershipContact;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? 40 : 32;
  const iconSize = size === "md" ? 18 : 15;
  const { phone, whatsapp, email } = contact;

  if (!phone && !whatsapp && !email) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      {phone && (
        <a
          href={`tel:${phone}`}
          aria-label="Appeler"
          className={contactLinkClass}
          style={{ width: dim, height: dim }}
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
          className={contactLinkClass}
          style={{ width: dim, height: dim }}
        >
          <MessageCircle size={iconSize} strokeWidth={1.75} />
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          aria-label="Envoyer un e-mail"
          className={contactLinkClass}
          style={{ width: dim, height: dim }}
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
