import Link from "next/link";
import { Button } from "@/components/ui";

export function SiteHeader({ isConnected }: { isConnected: boolean }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[var(--color-navy)] px-6 py-4 text-white sm:px-10">
      <Link href="/" className="text-base font-bold">
        IPP Nord-Kivu 1
      </Link>
      <nav className="hidden items-center gap-6 text-sm text-gray-300 md:flex">
        <Link href="/#accueil" className="hover:text-white">Accueil</Link>
        <Link href="/#inspection" className="hover:text-white">L&apos;Inspection</Link>
        <Link href="/#actualites" className="hover:text-white">Actualités</Link>
        <Link href="/#contacts" className="hover:text-white">Contacts</Link>
      </nav>
      <Link href={isConnected ? "/dashboard" : "/login"}>
        <Button className="!min-h-0 !bg-white !text-blue-700 px-4 py-2 text-sm hover:!bg-gray-100">
          {isConnected ? "Mon espace" : "Connexion"}
        </Button>
      </Link>
    </header>
  );
}
