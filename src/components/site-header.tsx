import Link from "next/link";
import { Button } from "@/components/ui";
import { PublicMobileNav, PublicNav } from "@/components/public-nav";

export function SiteHeader({ isConnected }: { isConnected: boolean }) {
  const accountHref = isConnected ? "/dashboard" : "/login";
  const accountLabel = isConnected ? "Mon espace" : "Connexion";
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[var(--color-navy)] px-6 py-4 text-white sm:px-10">
      <Link href="/" className="text-base font-bold">
        IPP Nord-Kivu 1
      </Link>
      <PublicNav />
      <div className="flex items-center gap-1">
        <Link href={accountHref}>
          <Button className="!min-h-0 !bg-white !text-blue-700 px-4 py-2 text-sm hover:!bg-gray-100">
            {accountLabel}
          </Button>
        </Link>
        <PublicMobileNav accountHref={accountHref} accountLabel={accountLabel} />
      </div>
    </header>
  );
}
