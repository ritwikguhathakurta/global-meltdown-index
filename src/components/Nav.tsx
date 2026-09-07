import Link from "next/link";
import { getCurrentUserAndRole } from "@/lib/supabase/session";
import { signOut } from "@/app/login/actions";

const LINKS = [
  { href: "/dashboard", label: "Global Risk" },
  { href: "/dashboard/yen-carry", label: "Yen Carry" },
  { href: "/dashboard/liquidity", label: "Liquidity" },
  { href: "/dashboard/credit", label: "Credit" },
  { href: "/dashboard/treasury", label: "Treasury" },
  { href: "/dashboard/em-debt", label: "EM Debt" },
  { href: "/dashboard/banking", label: "Banking" },
  { href: "/dashboard/property", label: "Property" },
  { href: "/dashboard/china", label: "China" },
  { href: "/dashboard/energy", label: "Energy" },
  { href: "/dashboard/geopolitical", label: "Geopolitical" },
  { href: "/dashboard/derivatives", label: "Derivatives" },
  { href: "/dashboard/crypto", label: "Crypto" },
  { href: "/dashboard/cyber", label: "Cyber" },
  { href: "/dashboard/trade-policy", label: "Trade Policy" },
  { href: "/dashboard/supply-chains", label: "Supply Chains" },
  { href: "/dashboard/market-concentration", label: "Market Concentration" },
  { href: "/dashboard/private-credit", label: "Private Credit" },
  { href: "/dashboard/ai-financial-sustainability", label: "AI Sustainability" },
  { href: "/dashboard/ai-valuation", label: "AI Valuation" },
  { href: "/dashboard/ai-credit-financing", label: "AI Credit" },
  { href: "/dashboard/ai-debt-maturity", label: "AI Debt Maturity" },
  { href: "/dashboard/equities", label: "Equities" },
  { href: "/dashboard/india", label: "India" },
  { href: "/dashboard/india-liquidity", label: "India Liquidity" },
  { href: "/dashboard/central-banks", label: "Central Banks" },
  { href: "/dashboard/methodology", label: "Methodology" },
  { href: "/dashboard/sources", label: "Sources" },
];

export async function Nav() {
  const { user, isAdmin } = await getCurrentUserAndRole();

  return (
    <header className="border-b border-border bg-panel">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-sm font-bold tracking-wide text-text">
          Global Meltdown Index
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-dim">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-text">
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" className="text-accent hover:underline">
              Admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs">
          {user ? (
            <form action={signOut}>
              <span className="mr-3 text-text-dim">{user.email}</span>
              <button type="submit" className="text-accent hover:underline">
                Sign out
              </button>
            </form>
          ) : (
            <>
              <Link href="/login" className="text-text-dim hover:text-text">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded bg-accent px-3 py-1.5 font-medium text-[#061018] hover:opacity-90"
              >
                Start free trial
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
