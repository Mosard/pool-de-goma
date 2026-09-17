import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

const NAV_LINKS = [
  { label: "Accueil", href: "#accueil" },
  { label: "L'Inspection", href: "#inspection" },
  { label: "Direction", href: "#direction" },
  { label: "Actualités", href: "#actualites" },
];

const RESOURCE_LINKS = [
  { label: "Espace professionnel", href: "/login" },
  { label: "Demande d'accès", href: "/demande-de-compte" },
  { label: "Les POOL", href: "#pools" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer id="contacts" className="bg-[var(--color-navy)] px-6 pt-16 text-gray-300 sm:px-10">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 pb-12 sm:grid-cols-3">
        <div>
          <p className="text-base font-bold text-white">IPP Nord-Kivu 1</p>
          <p className="mt-3 max-w-xs text-sm text-gray-400">
            Inspection Principale Provinciale de l&apos;Enseignement — Province Éducationnelle Nord-Kivu 1,
            République Démocratique du Congo.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Navigation</p>
            <ul className="mt-4 space-y-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-sm text-gray-300 hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Ressources</p>
            <ul className="mt-4 space-y-2.5">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-300 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Coordonnées</p>
          <ul className="mt-4 space-y-3 text-sm text-gray-300">
            <li className="flex items-start gap-2.5">
              <MapPin size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-gray-500" />
              Goma, Nord-Kivu, République Démocratique du Congo
            </li>
            <li className="flex items-center gap-2.5">
              <Phone size={16} strokeWidth={1.75} className="shrink-0 text-gray-500" />
              Contact à préciser
            </li>
            <li className="flex items-center gap-2.5">
              <Mail size={16} strokeWidth={1.75} className="shrink-0 text-gray-500" />
              Contact à préciser
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-xs text-gray-500 sm:flex-row">
        <p>© {year} Inspection Principale Provinciale — Nord-Kivu 1</p>
        <p className="flex items-center gap-3">
          <span>Mentions légales</span>
          <span aria-hidden>·</span>
          <span>Confidentialité</span>
          <span aria-hidden>·</span>
          <span>Accessibilité</span>
        </p>
      </div>
    </footer>
  );
}
