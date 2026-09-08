import Link from "next/link";
import { getAllEnginesLatest, getLatestGfmi } from "@/lib/api/engineData";
import { RiskBadge, DirectionArrow, gfmiColor, RISK_LEVEL_LEGEND } from "@/components/RegimeBadge";
import { InlineDisclaimer } from "@/components/Disclaimer";

const ENGINE_META: Record<string, { label: string; href: string }> = {
  global_liquidity: { label: "Global Liquidity (G7 + China)", href: "/dashboard/liquidity" },
  credit: { label: "Credit Markets", href: "/dashboard/credit" },
  equity_fragility: { label: "Equity Fragility", href: "/dashboard/equities" },
  us_treasury_sovereign: { label: "Treasury & Sovereign (G7 + China)", href: "/dashboard/treasury" },
  yen_carry: { label: "Yen Carry Stress", href: "/dashboard/yen-carry" },
  banking: { label: "Banking", href: "/dashboard/banking" },
  property: { label: "Property / CRE", href: "/dashboard/property" },
  emerging_market_debt: { label: "Emerging-Market Debt", href: "/dashboard/em-debt" },
  energy: { label: "Energy", href: "/dashboard/energy" },
  geopolitical: { label: "Geopolitical", href: "/dashboard/geopolitical" },
  derivatives_leverage: { label: "Derivatives / Leverage", href: "/dashboard/derivatives" },
  crypto_stablecoins: { label: "Crypto / Stablecoins", href: "/dashboard/crypto" },
  cyber_infrastructure: { label: "Cyber / Infrastructure", href: "/dashboard/cyber" },
  trade_economic_policy: { label: "Trade / Economic Policy", href: "/dashboard/trade-policy" },
  supply_chains: { label: "Supply Chains", href: "/dashboard/supply-chains" },
  china: { label: "China", href: "/dashboard/china" },
  india_liquidity: { label: "India Liquidity", href: "/dashboard/india-liquidity" },
  india_yield_curve: { label: "India Yield Curve", href: "/dashboard/india-yield-curve" },
  market_concentration: { label: "Market Concentration", href: "/dashboard/market-concentration" },
  private_credit: { label: "Private Credit", href: "/dashboard/private-credit" },
  ai_financial_sustainability: { label: "AI Financial Sustainability", href: "/dashboard/ai-financial-sustainability" },
  ai_valuation: { label: "AI Valuation", href: "/dashboard/ai-valuation" },
  ai_credit_financing: { label: "AI Credit / Financing", href: "/dashboard/ai-credit-financing" },
  ai_debt_maturity_wall: { label: "AI Debt Maturity Wall", href: "/dashboard/ai-debt-maturity" },
};

export default async function DashboardPage() {
  const [gfmiRows, engineRows] = await Promise.all([getLatestGfmi(), getAllEnginesLatest("short")]);

  const seen = new Set<string>();
  const engines = (engineRows ?? []).filter((r) => {
    if (seen.has(r.engine_key)) return false;
    seen.add(r.engine_key);
    return true;
  });

  const ranked = [...engines].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const gfmi = gfmiRows?.[0] ?? null;
  const previousGfmi = gfmiRows?.[1] ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Global Financial Risk</h1>

      <section className="mb-8 grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="gfew-panel flex flex-col items-center justify-center gap-2 p-6">
          <span className="text-xs uppercase tracking-wide text-text-dim">GFMI</span>
          <RiskBadge score={gfmi?.score ?? null} />
          <span className="text-center text-xs text-text-dim">{gfmi?.regime ?? "NO DATA"}</span>
          {previousGfmi && (
            <span className="text-[11px] text-text-dim">
              Previous: {previousGfmi.score} ({previousGfmi.regime}) — Δ{" "}
              {gfmi?.score !== null && gfmi?.score !== undefined && previousGfmi.score !== null
                ? gfmi.score - previousGfmi.score
                : "—"}
            </span>
          )}
          {gfmi?.override_triggered && (
            <span className="rounded bg-[#3d1414] px-2 py-1 text-[11px] text-[#e05a4d]">
              Override: {gfmi.override_triggered}
            </span>
          )}
        </div>
        <div className="gfew-panel p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">GFMI Composition</h2>
          <p className="text-sm text-text-dim">
            Combines {Object.keys(gfmi?.components ?? {}).length} risk engine(s) with a nonlinear
            multi-shock amplifier ({gfmi?.amplifier_applied ?? "—"}×) applied when multiple engines are
            simultaneously elevated. Not a simple average — see{" "}
            <Link href="/dashboard/methodology" className="text-accent hover:underline">Methodology</Link>.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-dim">
            Top Global Risks — Heatmap
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {RISK_LEVEL_LEGEND.map((l) => {
              const { fg } = gfmiColor(l.sampleScore);
              return (
                <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-text-dim">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: fg }} />
                  {l.label}
                </span>
              );
            })}
          </div>
        </div>
        <p className="mb-3 max-w-2xl text-xs text-text-dim">
          Every tile is one risk engine, colored by its current 0-100 score — darker red means
          higher risk. The 3 highest-scoring engines pulse so the biggest systemic risks stand out
          immediately; click any tile for the full detail.
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {ranked.map((e, i) => {
            const { bg, fg } = gfmiColor(e.score);
            const isTopRisk = i < 3 && e.score !== null;
            return (
              <Link
                key={e.engine_key}
                href={ENGINE_META[e.engine_key]?.href ?? "#"}
                title={`${ENGINE_META[e.engine_key]?.label ?? e.engine_key} — score ${e.score ?? "N/A"}, ${e.regime}, ${Math.round((e.confidence ?? 0) * 100)}% confidence`}
                className={`relative flex min-h-[104px] flex-col justify-between rounded-lg p-3 transition-transform hover:z-10 hover:scale-[1.03] ${isTopRisk ? "gfew-flash" : ""}`}
                style={{ background: bg, "--gfew-pulse-color": fg } as React.CSSProperties}
              >
                {isTopRisk && (
                  <span
                    className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: fg, color: bg }}
                    aria-label={`Top systemic risk, rank ${i + 1}`}
                  >
                    {i + 1}
                  </span>
                )}
                <span className="text-xs font-medium leading-tight" style={{ color: fg }}>
                  {ENGINE_META[e.engine_key]?.label ?? e.engine_key}
                </span>
                <div className="flex items-end justify-between">
                  <span className="gfew-mono text-2xl font-bold" style={{ color: fg }}>
                    {e.score ?? "—"}
                  </span>
                  <DirectionArrow direction={e.direction} />
                </div>
                <span className="text-[10px] uppercase tracking-wide" style={{ color: fg, opacity: 0.85 }}>
                  {e.regime}
                </span>
              </Link>
            );
          })}
          {ranked.length === 0 && (
            <div className="col-span-full rounded border border-border px-3 py-6 text-center text-text-dim">
              No engine data yet — trigger a pipeline run from /admin.
            </div>
          )}
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="gfew-panel p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Next 7 Days</h3>
          <p className="text-sm text-text-dim">Event calendar not yet populated (Phase 2).</p>
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Next 30 Days</h3>
          <p className="text-sm text-text-dim">Event calendar not yet populated (Phase 2).</p>
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Next 90 Days</h3>
          <p className="text-sm text-text-dim">Event calendar not yet populated (Phase 2).</p>
        </div>
      </section>

      <InlineDisclaimer text="Current macro/market assessment — not a guaranteed forecast or investment recommendation" />
    </div>
  );
}
