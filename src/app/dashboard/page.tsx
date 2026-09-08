import Link from "next/link";
import { getAllEnginesLatest, getLatestGfmi } from "@/lib/api/engineData";
import { DirectionArrow, gfmiColor, RISK_LEVEL_LEGEND } from "@/components/RegimeBadge";
import { InlineDisclaimer } from "@/components/Disclaimer";
import { squarifyTreemap } from "@/lib/treemap";
import { GFMI_STAGES, gfmiStageForScore } from "@/lib/engines/gfmi";

// Nominal layout canvas the treemap is computed against, then expressed as
// CSS percentages — this is what "one big box, tiles sized by score" needs:
// a real 2D squarified treemap (Bruls/Huizing/van Wijk), not a uniform grid.
// Chosen wide (~2.3:1) to suit a ~24-tile mosaic under a full-width dashboard.
const TREEMAP_W = 1200;
const TREEMAP_H = 520;
// A null score (INSUFFICIENT_DATA) can't be sized by risk — it gets the
// smallest possible footprint instead of being hidden, so missing data is
// still visible as "small and gray," never silently dropped from the map.
const NULL_SCORE_TREEMAP_VALUE = 3;
// Below these nominal pixel thresholds a tile's text would clip or overflow
// (the anti-pattern this guards against) — so smaller tiles progressively
// drop the regime line, then the label, then fall back to color + a
// tooltip/aria-label only. Each tier is content that's guaranteed to fit
// fully or not render at all — never a partially clipped line.
const FULL_LABEL_MIN = { w: 110, h: 92 };
const MEDIUM_LABEL_MIN = { w: 90, h: 60 };
const COMPACT_LABEL_MIN = { w: 55, h: 36 };

// Representative score inside each of the 7 crisis-stage bands, so stage
// color reuses gfmiColor's own thresholds instead of a second hand-picked
// palette that could drift out of sync with the rest of the app.
const STAGE_SAMPLE_SCORE = [10, 25, 40, 55, 70, 85, 95];

function stageColor(stage: number | null): { bg: string; fg: string } {
  if (stage === null || stage < 1 || stage > 7) return { bg: "#1a1f28", fg: "#8b96a8" };
  return gfmiColor(STAGE_SAMPLE_SCORE[stage - 1]);
}

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
  const gfmiHeroColor = gfmiColor(gfmi?.score ?? null);
  const currentStage = gfmiStageForScore(gfmi?.score ?? null);

  const rowByKey = new Map(ranked.map((e) => [e.engine_key, e]));
  const rankByKey = new Map(ranked.map((e, i) => [e.engine_key, i]));
  const treemapLayout = squarifyTreemap(
    ranked.map((e) => ({
      key: e.engine_key,
      value: e.score === null ? NULL_SCORE_TREEMAP_VALUE : Math.max(e.score, 2),
    })),
    TREEMAP_W,
    TREEMAP_H
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Global Financial Risk</h1>

      <section className="mb-8">
        <div className="gfew-panel relative overflow-hidden px-6 py-12 text-center sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: gfmiHeroColor.fg, opacity: 0.16 }}
          />
          <div className="relative text-xl font-bold tracking-wide text-accent sm:text-3xl">
            Global Financial Meltdown Index <span className="text-text-dim">(GFMI)</span>
          </div>
          <div
            className="gfew-mono relative mt-2 font-bold tabular-nums"
            style={{ fontSize: "clamp(4rem, 13vw, 8rem)", lineHeight: 1, color: gfmiHeroColor.fg }}
          >
            {gfmi?.score ?? "—"}
          </div>
          <div
            className="relative mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-wide sm:text-base"
            style={{ background: `${gfmiHeroColor.fg}22`, color: gfmiHeroColor.fg }}
          >
            {gfmi?.regime?.replace(/_/g, " ") ?? "NO DATA"}
          </div>

          {(previousGfmi || gfmi?.override_triggered) && (
            <div className="relative mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-8">
              {previousGfmi && (() => {
                const delta =
                  gfmi?.score !== null && gfmi?.score !== undefined && previousGfmi.score !== null
                    ? gfmi.score - previousGfmi.score
                    : null;
                const deltaColor = delta === null || delta === 0 ? "#8b96a8" : delta > 0 ? "#e05a4d" : "#34c085";
                const deltaSign = delta !== null && delta > 0 ? "+" : "";
                return (
                  <span className="text-sm text-text-dim sm:text-base">
                    Previous:{" "}
                    <span className="gfew-mono font-semibold text-text">{previousGfmi.score}</span>{" "}
                    <span className="text-text-dim">({previousGfmi.regime.replace(/_/g, " ")})</span>{" "}
                    — <span className="font-semibold" style={{ color: deltaColor }}>
                      Δ {delta !== null ? `${deltaSign}${delta}` : "—"}
                    </span>
                  </span>
                );
              })()}
              {gfmi?.override_triggered && (
                <span className="rounded bg-[#3d1414] px-3 py-1.5 text-sm font-semibold text-[#e05a4d] sm:text-base">
                  Override: {gfmi.override_triggered}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="gfew-panel mb-8 p-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
          Crisis Stage
        </h3>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          A 7-stage progression over the same 0-100 composite score above — not a separately
          detected regime. Stage 7 marks the top of what this composite can measure; it is a score
          band reflecting how broadly and severely the tracked engines are reading right now, not a
          declared historical crisis.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {GFMI_STAGES.map((s) => {
            const active = currentStage?.stage === s.stage;
            const { bg, fg } = stageColor(s.stage);
            return (
              <div
                key={s.stage}
                className="min-w-[110px] flex-1 rounded px-2 py-2 text-center"
                style={{
                  background: active ? bg : "#1a1f28",
                  color: active ? fg : "#5a6472",
                  outline: active ? `2px solid ${fg}` : "none",
                  outlineOffset: "-2px",
                }}
                title={s.description}
              >
                <div className="gfew-mono text-[10px] font-semibold uppercase tracking-wide">
                  Stage {s.stage}
                </div>
                <div className="text-[11px] font-medium">{s.shortLabel}</div>
              </div>
            );
          })}
        </div>
        {currentStage ? (
          <p className="text-sm">
            Composite reading:{" "}
            <span className="font-semibold" style={{ color: gfmiColor(gfmi?.score ?? null).fg }}>
              {currentStage.label}
            </span>
            {gfmi?.override_triggered && (
              <span className="text-text-dim"> — override active: {gfmi.override_triggered}</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-text-dim">Insufficient data for a composite reading yet.</p>
        )}
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
          One box, sized <em>and</em> colored by score — the biggest tiles are the biggest
          systemic risks, darker red means higher risk, and the 3 highest-scoring engines pulse
          so they stand out immediately even at a glance. Click any tile for the full detail.
        </p>
        {ranked.length === 0 ? (
          <div className="gfew-panel rounded border border-border px-3 py-6 text-center text-text-dim">
            No engine data yet — trigger a pipeline run from /admin.
          </div>
        ) : (
          <div
            className="gfew-panel relative w-full overflow-visible p-1"
            style={{ aspectRatio: `${TREEMAP_W} / ${TREEMAP_H}` }}
          >
            {treemapLayout.map((cell) => {
              const e = rowByKey.get(cell.key);
              if (!e) return null;
              const rank = rankByKey.get(cell.key) ?? Infinity;
              const isTopRisk = rank < 3 && e.score !== null;
              const { bg, fg } = gfmiColor(e.score);
              const showFull = cell.w >= FULL_LABEL_MIN.w && cell.h >= FULL_LABEL_MIN.h;
              const showMedium = !showFull && cell.w >= MEDIUM_LABEL_MIN.w && cell.h >= MEDIUM_LABEL_MIN.h;
              const showCompact = !showFull && !showMedium && cell.w >= COMPACT_LABEL_MIN.w && cell.h >= COMPACT_LABEL_MIN.h;
              const label = ENGINE_META[e.engine_key]?.label ?? e.engine_key;

              return (
                <Link
                  key={cell.key}
                  href={ENGINE_META[e.engine_key]?.href ?? "#"}
                  title={`${label} — score ${e.score ?? "N/A"}, ${e.regime}, ${Math.round((e.confidence ?? 0) * 100)}% confidence`}
                  aria-label={`${label}: score ${e.score ?? "not available"}, ${e.regime}${isTopRisk ? `, top systemic risk rank ${rank + 1}` : ""}`}
                  className={`absolute rounded-md transition-transform hover:z-20 hover:scale-[1.04] ${isTopRisk ? "gfew-flash" : ""}`}
                  style={
                    {
                      left: `calc(${(cell.x / TREEMAP_W) * 100}% + 2px)`,
                      top: `calc(${(cell.y / TREEMAP_H) * 100}% + 2px)`,
                      width: `calc(${(cell.w / TREEMAP_W) * 100}% - 4px)`,
                      height: `calc(${(cell.h / TREEMAP_H) * 100}% - 4px)`,
                      "--gfew-pulse-color": fg,
                    } as React.CSSProperties
                  }
                >
                  {/* Rank badge sits on the Link itself (no overflow-hidden here) so its
                      negative-offset corner position never gets clipped by the tile's own
                      rounded/overflow-hidden content layer below. */}
                  {isTopRisk && (
                    <span
                      className="absolute -left-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ background: fg, color: bg }}
                      aria-hidden="true"
                    >
                      {rank + 1}
                    </span>
                  )}
                  <div
                    className="flex h-full w-full flex-col justify-start gap-1 overflow-hidden rounded-md p-2"
                    style={{ background: bg }}
                  >
                    {(showFull || showMedium) && (
                      <>
                        <span className="text-xs font-medium leading-tight" style={{ color: fg }}>
                          {label}
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="gfew-mono text-2xl font-bold" style={{ color: fg }}>
                            {e.score ?? "—"}
                          </span>
                          <DirectionArrow direction={e.direction} />
                        </div>
                        {showFull && (
                          <span className="text-[10px] uppercase tracking-wide" style={{ color: fg, opacity: 0.85 }}>
                            {e.regime}
                          </span>
                        )}
                      </>
                    )}
                    {showCompact && (
                      <div className="flex h-full items-center justify-between">
                        <span className="gfew-mono text-sm font-bold" style={{ color: fg }}>
                          {e.score ?? "—"}
                        </span>
                        <DirectionArrow direction={e.direction} />
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-right text-xs text-text-dim">
          Not a simple average — see{" "}
          <Link href="/dashboard/methodology" className="text-accent hover:underline">Methodology</Link>.
        </p>
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
