import {
  getLatestEngine,
  getCentralBankLiquidityTable,
  getLiquiditySystemicRiskTable,
  getGlobalDollarLiquidityIndex,
  getNbfiChecks,
  getLiquidityTransmissionPanel,
  NBFI_MONITORING_REGISTRY,
} from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import type { LiquidityRegimeLabel, MomentumLabel, ForecastCell } from "@/lib/engines/liquidityRegime";
import {
  LIQUIDITY_STAGES,
  STRUCTURAL_WEIGHTS,
  MARKET_WEIGHTS,
  COMPOSITE_WEIGHTS,
  LIQUIDITY_REGION_ORDER,
  type DollarLiquidityReading,
} from "@/lib/engines/liquiditySystemicRisk";
import { gfmiColor } from "@/components/RegimeBadge";
import { TrendIndicator } from "@/components/TrendIndicator";

const REGIME_COLORS: Record<LiquidityRegimeLabel, string> = {
  AMPLE: "#34c085",
  ADEQUATE: "#3fa9f5",
  NORMAL: "#8b96a8",
  TIGHTENING: "#e0b93d",
  DEFICIT: "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
};

function RegimePill({ regime }: { regime: LiquidityRegimeLabel }) {
  const color = REGIME_COLORS[regime];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ background: `${color}22`, color }}
    >
      {regime.replace("_", " ")}
    </span>
  );
}

const MOMENTUM_ARROW: Record<MomentumLabel, string> = {
  EASING: "↓",
  STABLE: "→",
  TIGHTENING: "↑",
  INSUFFICIENT_DATA: "—",
};

const MOMENTUM_COLOR: Record<MomentumLabel, string> = {
  EASING: "#34c085",
  STABLE: "#8b96a8",
  TIGHTENING: "#e0b93d",
  INSUFFICIENT_DATA: "#5a6472",
};

function ForecastCellView({ cell }: { cell: ForecastCell }) {
  return (
    <div className="flex items-center gap-1.5">
      <RegimePill regime={cell.regime} />
      <span className="text-xs" style={{ color: MOMENTUM_COLOR[cell.momentum] }} title={cell.momentum.replace("_", " ").toLowerCase()}>
        {MOMENTUM_ARROW[cell.momentum]}
      </span>
    </div>
  );
}

function fmt(v: number | null, unit: string): string {
  if (v === null) return "—";
  const rounded = Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : v.toFixed(v === Math.trunc(v) ? 0 : 2);
  return `${rounded}${unit ? " " + unit : ""}`;
}

function scoreColor(score: number | null): string {
  if (score === null) return "#5a6472";
  if (score < 20) return "#34c085";
  if (score < 40) return "#3fa9f5";
  if (score < 60) return "#e0b93d";
  if (score < 80) return "#e0793d";
  return "#e05a4d";
}

const STAGE_SAMPLE_SCORE = [10, 25, 40, 55, 70, 85, 95];

function stageColor(stage: number | null): { bg: string; fg: string } {
  if (stage === null || stage < 1 || stage > 7) return { bg: "#1a1f28", fg: "#8b96a8" };
  return gfmiColor(STAGE_SAMPLE_SCORE[stage - 1]);
}

function checkStatusBadge(status: string | undefined): { label: string; color: string } {
  if (status === "current") return { label: "Verified", color: "#34c085" };
  if (status === "needs_review") return { label: "Needs review", color: "#e0793d" };
  if (status === "check_failed") return { label: "Check failed", color: "#5a6472" };
  return { label: "Not yet checked", color: "#5a6472" };
}

const DOLLAR_READING_COLOR: Record<DollarLiquidityReading, string> = {
  EXPANDING: "#34c085",
  MODERATING: "#3fa9f5",
  DECELERATING: "#e0b93d",
  CONTRACTING: "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
};

function contribution(score: number | null, weight: number): number | null {
  if (score === null) return null;
  return Math.round(score * weight * 10) / 10;
}

type Segment = { label: string; value: number | null; color: string };

function ContributionBar({ segments, total }: { segments: Segment[]; total: number | null }) {
  const known = segments.filter((s) => s.value !== null) as { label: string; value: number; color: string }[];
  const sum = known.reduce((a, b) => a + b.value, 0);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded bg-panel-raised">
        {known.map((s) => (
          <div key={s.label} style={{ width: `${sum > 0 ? (s.value / sum) * 100 : 0}%`, background: s.color }} title={`${s.label}: ${s.value} pts`} />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-dim">
        {segments.map((s) => (
          <span key={s.label}>
            {s.label} <span className="gfew-mono">{s.value ?? "—"}</span>
          </span>
        ))}
        {total !== null && (
          <span className="ml-auto font-semibold text-text">
            = <span className="gfew-mono">{total}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export default async function LiquidityPage() {
  const [rows, bankTable, liquidityEngine, dollarIndex, nbfiChecks, transmission] = await Promise.all([
    getLatestEngine("global_liquidity"),
    getCentralBankLiquidityTable(),
    getLiquiditySystemicRiskTable(),
    getGlobalDollarLiquidityIndex(),
    getNbfiChecks(),
    getLiquidityTransmissionPanel(),
  ]);
  const { rows: countryRows, composite } = liquidityEngine;
  const ranked = [...countryRows].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
  const topRisks = ranked.filter((r) => r.compositeScore !== null).slice(0, 5);
  const hiddenRisks = countryRows.filter((r) => r.hiddenRisk);
  const marketWarnings = countryRows.filter((r) => r.marketLedWarning);
  const nbfiCheckByKey = new Map(nbfiChecks.map((c) => [c.key, c]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Global Liquidity Systemic Risk</h1>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        Central-bank reserves, money-market/repo, and bond/FX market-liquidity tracking across 22 countries
        (G7 + China/India, plus a G20/ASEAN/CEE expansion — Brazil, Mexico, Indonesia, South Korea, South
        Africa, Türkiye, Australia, Poland, Czech Republic, Hungary, Malaysia, Thailand, Philippines), a
        separate BIS-sourced global dollar/euro/yen credit index, and an NBFI (non-bank financial
        intermediation) monitoring panel — plus a Transmission panel showing how a liquidity shock connects
        to this app&apos;s other systemic-risk engines. Checked and excluded (no free interbank-rate or FX
        series found — pegged currencies or untracked markets, not merely unattempted): Saudi Arabia, UAE,
        Singapore, Argentina, Russia, plus Chile, Colombia, Israel, Romania, Peru, Egypt, Kenya, Nigeria,
        Vietnam, Qatar and the major offshore financial centres. This is a new analytical layer; the
        existing GFMI-weighted &ldquo;Global Liquidity&rdquo; engine and per-bank Ample/Adequate/Deficit
        classifier further below are unchanged. See the methodology page for exactly what&apos;s built and
        what (repo volumes, collateral haircuts, margin, country-level NBFI balance sheets, FX reserves
        beyond China, bond yields beyond the original nine) is genuinely unavailable free rather than faked.
      </p>

      <section className="gfew-panel mb-8 p-4" id="global-liquidity-systemic-risk">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            Liquidity Systemic Risk — Crisis Stage (equal-weighted across all nine tracked countries)
          </h3>
          <a href="/dashboard/methodology#global-liquidity-systemic-risk" className="text-xs text-accent hover:underline">
            Methodology →
          </a>
        </div>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Stages 1-6 come from each country&apos;s own Structural (central-bank reserves + money-market/repo
          spread) + Market (bond-yield + FX realized volatility) + Contagion (cross-country breadth) blend.
          Stage 7 requires a large share of ALL nine countries to already be at Stage 6+ simultaneously —
          never assigned to a single country in isolation.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {LIQUIDITY_STAGES.map((s) => {
            const active = composite.stage?.stage === s.stage;
            const { bg, fg } = stageColor(s.stage);
            return (
              <div
                key={s.stage}
                className="min-w-[110px] flex-1 rounded px-2 py-2 text-center"
                style={{ background: active ? bg : "#1a1f28", color: active ? fg : "#5a6472", outline: active ? `2px solid ${fg}` : "none", outlineOffset: "-2px" }}
                title={s.description}
              >
                <div className="gfew-mono text-[10px] font-semibold uppercase tracking-wide">Stage {s.stage}</div>
                <div className="text-[11px] font-medium">{s.shortLabel}</div>
              </div>
            );
          })}
        </div>
        {composite.stage ? (
          <p className="text-sm">
            Composite reading:{" "}
            <span className="gfew-mono font-semibold" style={{ color: scoreColor(composite.score) }}>
              {composite.score}
            </span>{" "}
            <span className="font-semibold" style={{ color: stageColor(composite.stage.stage).fg }}>
              {composite.stage.label}
            </span>
          </p>
        ) : (
          <p className="text-sm text-text-dim">Insufficient data for a composite reading yet.</p>
        )}
      </section>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Where Liquidity Risk Is Building</h3>
          {topRisks.length === 0 && <p className="text-sm text-text-dim">No data yet.</p>}
          <ol className="space-y-2">
            {topRisks.map((r, i) => (
              <li key={r.country} className="text-sm">
                <span className="gfew-mono mr-2 text-text-dim">{i + 1}.</span>
                <span className="font-medium">{r.country}</span>{" "}
                <span className="gfew-mono" style={{ color: scoreColor(r.compositeScore) }}>
                  {r.compositeScore}
                </span>
                <div className="ml-5 text-xs text-text-dim">Stage {r.stage} · {r.stageLabel}</div>
              </li>
            ))}
          </ol>
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Hidden Liquidity Risk (structural rising, market calm)</h3>
          {hiddenRisks.length === 0 ? (
            <p className="text-sm text-text-dim">None currently detected across the tracked universe.</p>
          ) : (
            <ul className="space-y-1">
              {hiddenRisks.map((r) => (
                <li key={r.country} className="text-sm">
                  <span className="font-medium">{r.country}</span>{" "}
                  <span className="text-xs text-text-dim">(structural {r.structuralScore}, market {r.marketScore})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Market-Led Warning (market ahead of fundamentals)</h3>
          {marketWarnings.length === 0 ? (
            <p className="text-sm text-text-dim">None currently detected across the tracked universe.</p>
          ) : (
            <ul className="space-y-1">
              {marketWarnings.map((r) => (
                <li key={r.country} className="text-sm">
                  <span className="font-medium">{r.country}</span>{" "}
                  <span className="text-xs text-text-dim">(market {r.marketScore}, structural {r.structuralScore})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Liquidity Systemic Risk — Country Table</h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Central Bank Liquidity = each country&apos;s own reserves/balance-sheet series (same as the
          Banking engine&apos;s Liquidity domain). Repo/Money-Market = the SOFR/SONIA/€STR/CORRA-vs-policy-
          rate spread for five countries; a rate LEVEL (no clean policy-rate pairing found) for Japan, China
          and India — labeled per row. Bond Vol / FX Vol = realized volatility of the 10Y yield / USD cross,
          own-history z-scored. Structural = Central Bank Liquidity 50% + Repo 50%. Market = Bond Vol 50% +
          FX Vol 50%. Composite = Structural 40% + Market 35% + Contagion 25%.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Central Bank Liquidity</th>
                <th className="px-3 py-2 font-medium">Repo / Money Market</th>
                <th className="px-3 py-2 font-medium">Bond Vol</th>
                <th className="px-3 py-2 font-medium">FX Vol</th>
                <th className="px-3 py-2 font-medium">Structural</th>
                <th className="px-3 py-2 font-medium">Market</th>
                <th className="px-3 py-2 font-medium">Contagion</th>
                <th className="px-3 py-2 font-medium">Composite</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {LIQUIDITY_REGION_ORDER.flatMap((region) => {
                const entries = countryRows.filter((r) => r.region === region).sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
                if (entries.length === 0) return [];
                return [
                  <tr key={`region-${region}`} className="border-t border-border bg-panel-raised">
                    <td colSpan={11} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                      {region} ({entries.length})
                    </td>
                  </tr>,
                  ...entries.map((r) => (
                    <tr key={r.country} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">{r.country}</td>
                      <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(r.centralBankLiquidityScore) }}>
                        {r.centralBankLiquidityScore ?? "—"}
                      </td>
                      <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(r.repoScore) }} title={r.repoBasisLabel}>
                        {r.repoScore ?? "—"}
                        <div className="text-[10px] font-normal text-text-dim">{r.repoBasisLabel}</div>
                      </td>
                      <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(r.bondVolScore) }}>
                        {r.bondVolScore ?? "—"}
                      </td>
                      <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(r.fxVolScore) }}>
                        {r.fxVolScore ?? "—"}
                      </td>
                      <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.structuralScore) }}>
                        {r.structuralScore ?? "—"}
                      </td>
                      <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.marketScore) }}>
                        {r.marketScore ?? "—"}
                      </td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">{r.contagionScore ?? "—"}</td>
                      <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.compositeScore) }}>
                        {r.compositeScore ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.stage !== null ? (
                          <span
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold"
                            style={{ background: `${stageColor(r.stage).fg}22`, color: stageColor(r.stage).fg }}
                            title={LIQUIDITY_STAGES[r.stage - 1]?.description}
                          >
                            {r.stage} · {r.stageLabel}
                          </span>
                        ) : (
                          <span className="text-text-dim">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-dim">{Math.round(r.dataCompleteness * 100)}%</td>
                    </tr>
                  )),
                ];
              })}
              {countryRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-text-dim">
                    No data yet — trigger a pipeline run from /admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Score Breakdown — Why Is This Composite What It Is?</h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Weights are fixed and shown for the five highest-composite countries — Structural 40% / Market
          35% / Contagion 25% of composite; Central Bank Liquidity 50% / Repo 50% of Structural; Bond Vol
          50% / FX Vol 50% of Market.
        </p>
        <div className="space-y-4">
          {topRisks.map((r) => (
            <div key={r.country} className="gfew-panel p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-medium">{r.country}</span>
                <span className="text-xs text-text-dim">Stage {r.stage} · {r.stageLabel}</span>
              </div>
              <ContributionBar
                total={r.compositeScore}
                segments={[
                  { label: "Structural", value: contribution(r.structuralScore, COMPOSITE_WEIGHTS.structural), color: "#3fa9f5" },
                  { label: "Market", value: contribution(r.marketScore, COMPOSITE_WEIGHTS.market), color: "#e0793d" },
                  { label: "Contagion", value: contribution(r.contagionScore, COMPOSITE_WEIGHTS.contagion), color: "#e05a4d" },
                ]}
              />
              <div className="mt-3 grid gap-3 pl-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                    Structural ({r.structuralScore ?? "—"}) breaks down as
                  </div>
                  <ContributionBar
                    total={null}
                    segments={[
                      { label: "Central Bank Liquidity", value: contribution(r.centralBankLiquidityScore, STRUCTURAL_WEIGHTS.centralBankLiquidity), color: "#34c085" },
                      { label: "Repo", value: contribution(r.repoScore, STRUCTURAL_WEIGHTS.repoStress), color: "#8b96a8" },
                    ]}
                  />
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                    Market ({r.marketScore ?? "—"}) breaks down as
                  </div>
                  <ContributionBar
                    total={null}
                    segments={[
                      { label: "Bond Vol", value: contribution(r.bondVolScore, MARKET_WEIGHTS.bondVol), color: "#e0b93d" },
                      { label: "FX Vol", value: contribution(r.fxVolScore, MARKET_WEIGHTS.fxVol), color: "#3fa9f5" },
                    ]}
                  />
                </div>
              </div>
            </div>
          ))}
          {topRisks.length === 0 && <p className="text-sm text-text-dim">No data yet.</p>}
        </div>
      </section>

      <section className="mb-8" id="global-dollar-liquidity-index">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Global Dollar / Euro / Yen Liquidity Index</h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Real BIS Global Liquidity Indicators (dataflow WS_GLI) — year-on-year growth of credit (bank
          loans + international debt securities) to non-bank borrowers OUTSIDE each currency&apos;s home
          jurisdiction, BIS&apos;s own headline &ldquo;global {"{USD/EUR/JPY}"} liquidity&rdquo; series, plus
          the EMDE-specific USD slice. This is a genuinely different kind of signal from the country table
          above: it&apos;s compiled by BIS at the currency/region level, not per-country, so it is shown
          separately rather than folded into any one country&apos;s score. A DECELERATING or CONTRACTING
          reading — cross-border credit growth slowing or reversing — is this app&apos;s own reading of
          spec&apos;s &ldquo;Dollar Liquidity Acceleration&rdquo; early-warning concept (rapid contraction
          in cross-border credit = early warning), not a BIS-published classification.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dollarIndex.map((r) => (
            <div key={r.metricKey} className="gfew-panel p-3">
              <div className="mb-1 text-xs font-semibold text-text-dim">{r.label}</div>
              <div className="gfew-mono text-2xl font-bold" style={{ color: DOLLAR_READING_COLOR[r.reading] }}>
                {r.latestYoyPct !== null ? `${r.latestYoyPct > 0 ? "+" : ""}${r.latestYoyPct.toFixed(1)}%` : "—"}
                <TrendIndicator value={r.latestYoyPct} previous={r.previousYoyPct} />
              </div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: DOLLAR_READING_COLOR[r.reading] }}>
                {r.reading.replace("_", " ")}
              </div>
              <div className="mt-1 text-[10px] text-text-dim">YoY, as of {r.asOf ?? "—"}</div>
            </div>
          ))}
          {dollarIndex.length === 0 && <p className="text-sm text-text-dim">No data yet.</p>}
        </div>
      </section>

      <section className="gfew-panel mb-8 p-4" id="nbfi-monitoring">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">NBFI Monitoring</h3>
          <a href="/dashboard/methodology#global-liquidity-systemic-risk" className="text-xs text-accent hover:underline">
            Methodology →
          </a>
        </div>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Non-bank financial intermediation is treated as a first-class liquidity amplifier here, not a
          footnote — tracked via the Financial Stability Board&apos;s own annual Global Monitoring Report
          (the one genuinely global, cross-jurisdiction NBFI data source that exists), with the same
          automated freshness check the Central Bank FSR registry uses. This is curated headline data from
          the report itself, not a live numeric feed — no free source publishes country-level NBFI
          balance-sheet series this app could ingest directly.
        </p>
        {NBFI_MONITORING_REGISTRY.map((entry) => {
          const check = nbfiCheckByKey.get(entry.key);
          const badge = checkStatusBadge(check?.check_status);
          return (
            <div key={entry.key} className="rounded border border-border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <a href={entry.reportUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                  {entry.reportName}
                </a>
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
                  style={{ background: `${badge.color}22`, color: badge.color }}
                  title={check?.note ?? "This entry has not yet been checked by a pipeline run."}
                >
                  {badge.label}
                </span>
              </div>
              <div className="mb-3 text-xs text-text-dim">
                {entry.institution} · Published {entry.publishedDate} · {entry.cadenceLabel} · Coverage: {entry.coverageNote}
              </div>
              <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-text-dim">Total NBFI Assets</div>
                  <div className="gfew-mono text-lg font-semibold">${entry.totalAssetsUsdTn.toFixed(1)}tn</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-text-dim">Share of Global Financial Assets</div>
                  <div className="gfew-mono text-lg font-semibold">{entry.shareOfGlobalFinancialAssetsPct.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-text-dim">YoY Growth</div>
                  <div className="gfew-mono text-lg font-semibold">+{entry.totalAssetsGrowthYoyPct.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-text-dim">Narrow Measure (bank-like risk)</div>
                  <div className="gfew-mono text-lg font-semibold">${entry.narrowMeasureUsdTn.toFixed(1)}tn (+{entry.narrowMeasureGrowthYoyPct.toFixed(0)}%)</div>
                </div>
              </div>
              <p className="text-xs text-text-dim">{entry.stance}</p>
            </div>
          );
        })}
      </section>

      <section className="gfew-panel mb-8 p-4" id="liquidity-transmission">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
          Liquidity Transmission — Cross-Engine Convergence
        </h3>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          The design intent behind this engine: liquidity is a TRANSMISSION mechanism connecting this
          app&apos;s other systemic-risk engines, not just a sixth independent score. A sovereign-yield
          shock (G7 Debt) repricing collateral, a bank funding squeeze (Banking), a property-collateral
          decline (Property), an EM capital-flow reversal (EM Debt) and a carry unwind (Carry Trade) can
          all show up here as deteriorating repo spreads, reserve drawdowns or bond/FX volatility — and a
          liquidity shock can just as easily transmit the other way. Rather than fabricate a new
          cross-engine correlation model, this panel reads each engine&apos;s ALREADY-COMPUTED composite
          score directly and flags when several are elevated (≥60) at the same time — a real, if simple,
          reading of spec&apos;s own &ldquo;Liquidity Fragility Convergence&rdquo; concept applied at engine
          granularity.
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {transmission.rows.map((r) => (
            <div key={r.engine} className="rounded border border-border p-2 text-center" style={{ outline: r.elevated ? "2px solid #e0793d" : "none", outlineOffset: "-2px" }}>
              <div className="text-[10px] uppercase tracking-wide text-text-dim">{r.engine}</div>
              <div className="gfew-mono text-xl font-bold" style={{ color: scoreColor(r.score) }}>
                {r.score ?? "—"}
              </div>
            </div>
          ))}
        </div>
        {transmission.convergence ? (
          <p className="rounded border border-border bg-panel-raised p-3 text-sm font-medium" style={{ color: "#e0793d" }}>
            Systemic Liquidity Convergence: Liquidity plus {transmission.elevatedCount - 1} other engine
            {transmission.elevatedCount - 1 === 1 ? " is" : "s are"} simultaneously elevated (≥60) right now.
          </p>
        ) : (
          <p className="text-sm text-text-dim">
            No convergence currently detected — {transmission.elevatedCount} of 6 tracked engines are
            elevated (≥60) right now (convergence requires Liquidity itself elevated plus at least two others).
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Central Bank Liquidity: Ample, Adequate or Deficit
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Each bank is classified by its money-market rate vs. its own policy rate (SOFR−IORB,
          SONIA−Bank Rate, €STR−Deposit Facility Rate, CORRA−Target) — the actual framework central
          banks use to judge whether reserves are ample (market rate trades below policy rate, as
          designed) or scarce (market rate prints at or above it). Japan and China are classified on
          their own rate level trend instead, since no free daily policy/target-rate series exists to
          pair against — disclosed per row, not blended in silently. Every regime label is
          relative to that <em>same</em> bank&apos;s own trailing ~1-year range, not a universal
          scale — read each row as &ldquo;unusually tight or loose for this bank lately,&rdquo; not
          as directly comparable across banks (see Methodology for why, e.g., a modest-looking ECB
          spread can still score DEFICIT after the ECB&apos;s 2024 rate-corridor narrowing).
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Central Bank</th>
                <th className="px-3 py-2 font-medium">Balance Sheet / Reserves</th>
                <th className="px-3 py-2 font-medium">As Of</th>
                <th className="px-3 py-2 font-medium">Basis</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Regime</th>
              </tr>
            </thead>
            <tbody>
              {bankTable.map((r) => (
                <tr key={r.bank} className="border-t border-border">
                  <td className="px-3 py-2">{r.bank}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {r.balanceSheetValue === null ? r.balanceSheetLabel : `${fmt(r.balanceSheetValue, r.balanceSheetUnit)}`}
                    <TrendIndicator value={r.balanceSheetValue} previous={r.balanceSheetPreviousValue} />
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{r.balanceSheetAsOf ?? "—"}</td>
                  <td className="px-3 py-2 text-text-dim">{r.basisLabel}</td>
                  <td className="gfew-mono px-3 py-2">
                    {fmt(r.basisValue, r.basisUnit)}
                    <TrendIndicator value={r.basisValue} previous={r.basisPreviousValue} />
                  </td>
                  <td className="px-3 py-2">
                    <RegimePill regime={r.regime} />
                  </td>
                </tr>
              ))}
              {bankTable.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-dim">
                    No data yet — trigger a pipeline run from /admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Central Bank Liquidity Forecast
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Not a prediction — a trend extrapolation. Each cell fits a real ordinary-least-squares
          line to that bank&apos;s own basis series (the same spread or rate used in the table
          above) over the trailing 30/120/400 days, projects it forward ~2 weeks / ~2 months / ~6
          months, and re-scores the projected value against the same trailing baseline. The arrow
          shows momentum (↑ tightening, ↓ easing, → stable) and the pill shows where that trend
          would land the regime if it continued unchanged. A policy move, QT taper/restart, or
          funding shock is not modeled and can invalidate this instantly — see Methodology.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Central Bank</th>
                <th className="px-3 py-2 font-medium">Short Term (~2 wks)</th>
                <th className="px-3 py-2 font-medium">Medium Term (~2 mo)</th>
                <th className="px-3 py-2 font-medium">Long Term (~6 mo)</th>
              </tr>
            </thead>
            <tbody>
              {bankTable.map((r) => (
                <tr key={r.bank} className="border-t border-border">
                  <td className="px-3 py-2">{r.bank}</td>
                  <td className="px-3 py-2">
                    <ForecastCellView cell={r.forecast.shortTerm} />
                  </td>
                  <td className="px-3 py-2">
                    <ForecastCellView cell={r.forecast.mediumTerm} />
                  </td>
                  <td className="px-3 py-2">
                    <ForecastCellView cell={r.forecast.longTerm} />
                  </td>
                </tr>
              ))}
              {bankTable.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-text-dim">
                    No data yet — trigger a pipeline run from /admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EngineDetail title="Global Liquidity" rows={rows} />
    </div>
  );
}
