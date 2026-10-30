import type { Metadata } from "next";
import Link from "next/link";
import { getLatestGfmi, getLatestIndiaRegime } from "@/lib/api/engineData";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RiskBadge } from "@/components/RegimeBadge";
import { StatusPill } from "@/components/StatusPill";

const SITE_URL = "https://globalmeltdownindex.net";

const PAGE_TITLE = "Global Financial Early-Warning Intelligence Terminal";
// Kept under ~160 chars - Google truncates a longer meta description in the
// SERP snippet, cutting it off mid-sentence rather than at a clean boundary.
const PAGE_DESCRIPTION =
  "24 deterministic risk engines roll into one composite GFMI score — every number real, source-linked, " +
  "and computed automatically, never faked.";
const JSON_LD_DESCRIPTION =
  "24 deterministic risk engines — Global Liquidity, Credit, Equity Fragility, Treasury/Sovereign, Banking, " +
  "Property, EM Debt, Energy, Geopolitical and more — roll up into one composite GFMI score. Every number is " +
  "real, sourced from a free/official API and computed deterministically; nothing is faked or estimated.";

/**
 * The one route this app allows a signed-out visitor — or a crawler — to
 * reach (see the proxy allowlist in src/lib/supabase/middleware.ts), so it's
 * the only page that opts back into indexing against the app-wide
 * `robots: { index: false }` default in the root layout.
 */
export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: `${PAGE_TITLE} · Global Meltdown Index`,
    description: PAGE_DESCRIPTION,
    url: "/",
    type: "website",
  },
};

// Real, visible on the page below (not schema-only) — Google's own guidance
// is that FAQPage markup must mirror what a visitor actually sees.
const FAQ_ITEMS = [
  {
    q: "What is the GFMI score?",
    a: "The Global Financial Meltdown Index (GFMI) is a 0–100 composite of 24 independent risk engines — " +
      "Global Liquidity, Credit, Equity Fragility, Treasury/Sovereign, Banking, Property, Emerging-Market Debt, " +
      "Energy, Geopolitical and more — each computed deterministically and rolled into one score.",
  },
  {
    q: "Is the data real, or estimated?",
    a: "Every number is sourced from a free or official API — FRED, central banks, SEC EDGAR, the World Bank — " +
      "and computed deterministically. Nothing is faked, estimated or backfilled; when a free source doesn't " +
      "exist for something, it's labeled UNAVAILABLE or STALE instead of guessed at.",
  },
  {
    q: "How often does it update?",
    a: "A daily pipeline recomputes every engine and the composite GFMI score automatically from the latest " +
      "available data.",
  },
  {
    q: "Is this investment advice?",
    a: "No. Global Meltdown Index publishes a current macro/market assessment, not a forecast, prediction, or " +
      "recommendation to buy, sell or hold any security or financial product.",
  },
  {
    q: "Do I need an account to see it?",
    a: "No — this page shows the live GFMI score and India market regime without signing up. A free account " +
      "unlocks the full dashboard: every engine in detail, trend charts and source citations.",
  },
];

async function getShortHorizonEngineRows() {
  if (!isSupabaseConfigured) return [] as { engine_key: string; score: number | null; regime: string }[];
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("risk_engine_scores")
      .select("engine_key, as_of, score, regime, direction, confidence")
      .eq("horizon", "short")
      .order("as_of", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (e) {
    console.error((e as Error).message);
    return [];
  }
}

async function getHomeData() {
  const [gfmiRows, engineRows, indiaRows] = await Promise.all([
    getLatestGfmi(),
    getShortHorizonEngineRows(),
    getLatestIndiaRegime(),
  ]);

  const seen = new Set<string>();
  const engines = (engineRows ?? []).filter((r) => {
    if (seen.has(r.engine_key)) return false;
    seen.add(r.engine_key);
    return true;
  });

  return { gfmi: gfmiRows?.[0] ?? null, previousGfmi: gfmiRows?.[1] ?? null, engines, india: indiaRows ?? [] };
}

const ENGINE_LABELS: Record<string, string> = {
  global_liquidity: "Global Liquidity",
  credit: "Credit",
  equity_fragility: "Equity Fragility",
  us_treasury_sovereign: "Treasury & Sovereign (G7 + China)",
  yen_carry: "Carry Trade Stress",
  banking: "Banking",
  property: "Property / CRE",
  emerging_market_debt: "Emerging-Market Debt",
  energy: "Energy",
  geopolitical: "Geopolitical",
  derivatives_leverage: "Derivatives / Leverage",
  crypto_stablecoins: "Crypto / Stablecoins",
  cyber_infrastructure: "Cyber / Infrastructure",
  trade_economic_policy: "Trade / Economic Policy",
  supply_chains: "Supply Chains",
  china: "China",
  market_concentration: "Market Concentration",
  private_credit: "Private Credit",
  ai_financial_sustainability: "AI Financial Sustainability",
  ai_valuation: "AI Valuation",
  ai_credit_financing: "AI Credit / Financing",
  ai_debt_maturity_wall: "AI Debt Maturity Wall",
};

export default async function HomePage() {
  const { gfmi, previousGfmi, engines, india } = await getHomeData();
  const hasData = gfmi !== null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Global Meltdown Index",
        url: SITE_URL,
        logo: `${SITE_URL}/icon`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Global Meltdown Index",
        url: SITE_URL,
        description: JSON_LD_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        author: { "@id": `${SITE_URL}/#organization` },
        ...(gfmi ? { dateModified: gfmi.as_of } : {}),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mb-10">
        <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-accent">
            Global Meltdown Index
          </span>
          See financial stress before it becomes a market story.
        </h1>
        <p className="mt-3 max-w-2xl text-text-dim">
          A leading-indicator early-warning system for global systemic risk and the India market regime —
          not another lagging dashboard.
        </p>
        <p className="mt-2 text-xs text-text-dim">
          Published by Global Meltdown Index{gfmi ? ` · Updated ${gfmi.as_of}` : ""}
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-dim">
          <li>24 deterministic risk engines</li>
          <li>Every number real &amp; source-linked</li>
          <li>Recomputed automatically every day</li>
        </ul>
      </section>

      {!hasData && (
        <div className="gfew-panel mb-8 px-4 py-3 text-sm text-text-dim">
          <StatusPill status="UNAVAILABLE" /> No pipeline run has completed yet. Once the daily pipeline
          runs (or is triggered manually — see <code className="gfew-mono">/admin</code>), GFMI and engine
          scores will populate here.
        </div>
      )}

      {hasData && (
        <section className="mb-10 grid gap-4 sm:grid-cols-[220px_1fr]">
          <div className="gfew-panel flex flex-col items-center justify-center gap-2 p-6">
            <span className="text-xs uppercase tracking-wide text-text-dim">GFMI</span>
            <RiskBadge score={gfmi!.score} />
            <span className="text-center text-xs text-text-dim">{gfmi!.regime}</span>
            {previousGfmi && (
              <span className="text-[11px] text-text-dim">
                Previous: {previousGfmi.score} ({previousGfmi.regime})
              </span>
            )}
            <span className="text-[11px] text-text-dim">Confidence: {Math.round((gfmi!.confidence ?? 0) * 100)}%</span>
          </div>
          <div className="gfew-panel grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            {engines.map((e) => (
              <div key={e.engine_key} className="flex flex-col gap-1 rounded border border-border p-3">
                <span className="text-xs text-text-dim">{ENGINE_LABELS[e.engine_key] ?? e.engine_key}</span>
                <RiskBadge score={e.score} />
                <span className="text-[11px] text-text-dim">{e.regime}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {india.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">India Market Regime</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {india.map((r) => (
              <div key={r.horizon} className="gfew-panel p-4">
                <span className="text-xs uppercase text-text-dim">{r.horizon} term</span>
                <div className="mt-1 text-lg font-semibold">{r.classification ?? "N/A"}</div>
                <div className="text-xs text-text-dim">Score: {r.score ?? "N/A"} · Confidence: {Math.round((r.confidence ?? 0) * 100)}%</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10 grid gap-6 sm:grid-cols-2">
        <div className="gfew-panel p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">What Has Already Happened</h2>
          <p className="text-sm text-text-dim">
            Verified, observed data points from official sources such as{" "}
            <a href="https://fred.stlouisfed.org/" className="text-accent hover:underline" rel="noopener">
              FRED
            </a>{" "}
            and SEC EDGAR — see each engine page for its leading, coincident and lagging indicator breakdown.
          </p>
        </div>
        <div className="gfew-panel p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">What May Matter Next</h2>
          <p className="text-sm text-text-dim">
            Forward-looking interpretation, scenario analysis and central-bank forward guidance — always
            labeled distinctly from verified fact. See <Link href="/dashboard/methodology" className="text-accent hover:underline">Methodology</Link>.
          </p>
        </div>
      </section>

      <section className="gfew-panel mb-10 flex flex-col gap-3 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-dim">Ask Global Meltdown Index Anything</h2>
        <p className="text-sm text-text-dim">
          The conversational AI research agent is planned for a later phase — it requires its own LLM API
          key and billing, kept separate from the core risk-engine data below.
        </p>
        <div className="rounded border border-border bg-panel-raised px-3 py-2 text-sm text-text-dim opacity-60">
          Coming soon — &ldquo;Is the yen carry trade becoming dangerous?&rdquo;
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-dim">Frequently Asked Questions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} className="gfew-panel p-4">
              <h3 className="mb-1 text-sm font-semibold">{item.q}</h3>
              <p className="text-sm text-text-dim">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 flex flex-wrap items-center gap-4">
        <Link href="/signup" className="rounded bg-accent px-5 py-2.5 text-sm font-medium text-[#061018] hover:opacity-90">
          Start free trial
        </Link>
        <Link href="/dashboard/methodology" className="text-sm text-text-dim hover:text-text">
          Read the methodology →
        </Link>
        <Link href="/about" className="text-sm text-text-dim hover:text-text">
          About
        </Link>
      </section>
    </div>
  );
}
