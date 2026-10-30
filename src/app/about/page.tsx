import type { Metadata } from "next";
import Link from "next/link";

const PAGE_TITLE = "About";
const PAGE_DESCRIPTION =
  "Global Meltdown Index turns free, official macro-financial data into one transparent composite " +
  "score — 24 deterministic risk engines, every number real and source-linked.";

/**
 * The second route (after "/") the proxy allowlist in
 * src/lib/supabase/middleware.ts lets a signed-out visitor or crawler reach
 * without a redirect to /login — added so "/" has a visible, crawlable
 * /about link to point to, same reasoning as the homepage's own opt-in.
 */
export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/about" },
  robots: { index: true, follow: true },
  openGraph: {
    title: `${PAGE_TITLE} · Global Meltdown Index`,
    description: PAGE_DESCRIPTION,
    url: "/about",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">About Global Meltdown Index</h1>
      <p className="mt-4 text-text-dim">
        Global Meltdown Index is a systemic-risk terminal that turns free, official macro-financial data
        into one transparent composite score. The question it answers: what is changing now that could
        matter later?
      </p>

      <h2 className="mt-10 mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">How it works</h2>
      <p className="text-text-dim">
        24 independent risk engines — covering global liquidity, credit, equity fragility, sovereign
        treasury markets, banking, property, emerging-market debt, energy, geopolitics and more — are each
        computed deterministically from their own data source. A daily automated pipeline recomputes every
        engine and rolls them up into one 0–100 composite GFMI score.
      </p>

      <h2 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">The data-honesty rule</h2>
      <p className="text-text-dim">
        Every number is sourced from a free or official API — FRED, central banks, SEC EDGAR, the World
        Bank, and others — and nothing is faked, estimated or backfilled. When a free source genuinely
        doesn&apos;t exist for something, the platform shows UNAVAILABLE or STALE instead of guessing.
      </p>

      <h2 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">Who this is for</h2>
      <p className="text-text-dim">
        Anyone who wants a leading-indicator read on systemic financial risk — and the India market regime
        specifically — without waiting for a lagging headline to confirm it. See the{" "}
        <Link href="/dashboard/methodology" className="text-accent hover:underline">
          methodology
        </Link>{" "}
        for how each engine and the composite score are built.
      </p>

      <p className="mt-10 text-xs text-text-dim">
        This is a current macro/market assessment, not a guaranteed forecast or investment recommendation
        — see the disclaimer at the bottom of every page.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href="/signup" className="rounded bg-accent px-5 py-2.5 text-sm font-medium text-[#061018] hover:opacity-90">
          Start free trial
        </Link>
        <Link href="/" className="text-sm text-text-dim hover:text-text">
          ← Back to homepage
        </Link>
      </div>
    </div>
  );
}
