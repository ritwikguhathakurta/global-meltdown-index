import { getLatestEngine, getEnergySystemicRiskResult } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import { ENERGY_STAGES, STRUCTURAL_WEIGHTS, COMPOSITE_WEIGHTS, type EnergyRegimeLabel } from "@/lib/engines/energySystemicRisk";
import { gfmiColor } from "@/components/RegimeBadge";
import { TrendIndicator } from "@/components/TrendIndicator";

const REGIME_COLORS: Record<EnergyRegimeLabel, string> = {
  AMPLE_SUPPLY: "#34c085",
  BALANCED: "#3fa9f5",
  TIGHTENING: "#e0b93d",
  SHOCK_RISK: "#e0793d",
  ACTIVE_CRISIS: "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
};

function RegimePill({ regime }: { regime: EnergyRegimeLabel }) {
  const color = REGIME_COLORS[regime];
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
      {regime.replace(/_/g, " ")}
    </span>
  );
}

function fmt(v: number | null, unit: string, decimals = 1): string {
  if (v === null) return "—";
  return `${v.toFixed(decimals)}${unit ? " " + unit : ""}`;
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

export default async function EnergyPage() {
  const [rows, gesri] = await Promise.all([getLatestEngine("energy"), getEnergySystemicRiskResult()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Energy</h1>
      <EngineDetail title="Energy" rows={rows} />

      <h2 className="mb-2 mt-12 text-xl font-semibold">Global Energy Systemic Risk (GESRI)</h2>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        Where is the global energy system becoming fragile, and is that stress converging across
        commodities — a genuinely different question from the flat spot-price composite above. Four
        structural domains (Oil, Natural Gas, Critical Minerals/Nuclear Fuel, Shipping/Supply Chain), a
        market domain (energy-sector equities), and a Convergence score measuring how many of those
        four domains are independently elevated at once. Country-level energy balances, OPEC+ quota
        tracking, a futures-curve/backwardation signal, grid/chokepoint data and a network graph are
        checked, not found free at this granularity, and disclosed rather than faked — see the
        methodology page for the full list.
      </p>

      {gesri === null ? (
        <p className="text-sm text-text-dim">No data yet — trigger a pipeline run from /admin.</p>
      ) : (
        <>
          <section className="gfew-panel mb-8 p-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Crisis Stage</h3>
            <p className="mb-3 max-w-3xl text-xs text-text-dim">
              Stages 1-6 come from the global Structural (oil/gas/minerals/shipping) + Market
              (energy-sector equities) blend. Stage 7 requires a high Convergence reading — most
              structural domains elevated simultaneously — alongside an already-high composite.
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {ENERGY_STAGES.map((s) => {
                const active = gesri.stage === s.stage;
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
                    <div className="gfew-mono text-[10px] font-semibold uppercase tracking-wide">Stage {s.stage}</div>
                    <div className="text-[11px] font-medium">{s.shortLabel}</div>
                  </div>
                );
              })}
            </div>
            {gesri.compositeScore !== null ? (
              <p className="text-sm">
                Composite reading:{" "}
                <span className="gfew-mono font-semibold" style={{ color: scoreColor(gesri.compositeScore) }}>
                  {gesri.compositeScore}
                </span>{" "}
                <RegimePill regime={gesri.regime} />{" "}
                {gesri.hiddenRisk && <span className="ml-2 text-xs text-[#e0b93d]">Hidden Energy Risk: structural rising, market still calm</span>}
                {gesri.marketLedWarning && <span className="ml-2 text-xs text-[#e0793d]">Market-led warning: market deteriorating ahead of fundamentals</span>}
              </p>
            ) : (
              <p className="text-sm text-text-dim">Insufficient data for a composite reading yet.</p>
            )}
          </section>

          <section className="mb-8">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Domain Readings</h2>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel-raised text-text-dim">
                  <tr>
                    <th className="px-3 py-2 font-medium">Domain</th>
                    <th className="px-3 py-2 font-medium">Key Reading</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Oil</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      Brent {fmt(gesri.oilReading.brent.value, "USD/bbl")}
                      <TrendIndicator value={gesri.oilReading.brent.value} previous={gesri.oilReading.brent.previousValue} />
                      {" · "}WTI {fmt(gesri.oilReading.wti.value, "USD/bbl")}
                      <TrendIndicator value={gesri.oilReading.wti.value} previous={gesri.oilReading.wti.previousValue} />
                      {" · "}OVX {fmt(gesri.oilReading.ovx.value, "", 1)}
                      <TrendIndicator value={gesri.oilReading.ovx.value} previous={gesri.oilReading.ovx.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(gesri.oilScore) }}>
                      {gesri.oilScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Natural Gas</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      Henry Hub {fmt(gesri.gasReading.value, "USD/MMBtu", 2)}
                      <TrendIndicator value={gesri.gasReading.value} previous={gesri.gasReading.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(gesri.gasScore) }}>
                      {gesri.gasScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Critical Minerals / Nuclear Fuel</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      Copper {fmt(gesri.mineralsReading.copper.value, "USD/t", 0)}
                      <TrendIndicator value={gesri.mineralsReading.copper.value} previous={gesri.mineralsReading.copper.previousValue} />
                      {" · "}Uranium {fmt(gesri.mineralsReading.uranium.value, "USD/lb", 2)}
                      <TrendIndicator value={gesri.mineralsReading.uranium.value} previous={gesri.mineralsReading.uranium.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(gesri.mineralsScore) }}>
                      {gesri.mineralsScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Shipping / Supply Chain</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      GSCPI {fmt(gesri.shippingReading.value, "std dev", 2)}
                      <TrendIndicator value={gesri.shippingReading.value} previous={gesri.shippingReading.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(gesri.shippingScore) }}>
                      {gesri.shippingScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Market (Energy-Sector Equities)</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      XLE {fmt(gesri.marketReading.value, "USD", 2)}
                      <TrendIndicator value={gesri.marketReading.value} previous={gesri.marketReading.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(gesri.marketScore) }}>
                      {gesri.marketScore ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Score Breakdown</h2>
            <p className="mb-3 max-w-3xl text-xs text-text-dim">
              Weights are fixed (Structural 40% / Market 35% / Convergence 25% of composite; Oil 35% /
              Natural Gas 25% / Critical Minerals 20% / Shipping 20% of Structural).
            </p>
            <div className="gfew-panel p-3">
              <ContributionBar
                total={gesri.compositeScore}
                segments={[
                  { label: "Structural", value: contribution(gesri.structuralScore, COMPOSITE_WEIGHTS.structural), color: "#3fa9f5" },
                  { label: "Market", value: contribution(gesri.marketScore, COMPOSITE_WEIGHTS.market), color: "#e0793d" },
                  { label: "Convergence", value: contribution(gesri.convergenceScore, COMPOSITE_WEIGHTS.convergence), color: "#e05a4d" },
                ]}
              />
              <div className="mt-3 pl-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                  Structural ({gesri.structuralScore ?? "—"}) breaks down as
                </div>
                <ContributionBar
                  total={null}
                  segments={[
                    { label: "Oil", value: contribution(gesri.oilScore, STRUCTURAL_WEIGHTS.oil), color: "#34c085" },
                    { label: "Natural Gas", value: contribution(gesri.gasScore, STRUCTURAL_WEIGHTS.gas), color: "#e0b93d" },
                    { label: "Minerals", value: contribution(gesri.mineralsScore, STRUCTURAL_WEIGHTS.minerals), color: "#8b96a8" },
                    { label: "Shipping", value: contribution(gesri.shippingScore, STRUCTURAL_WEIGHTS.shipping), color: "#3fa9f5" },
                  ]}
                />
              </div>
              <div className="mt-2 text-xs text-text-dim">
                Data completeness: {Math.round(gesri.dataCompleteness * 100)}%
              </div>
            </div>
          </section>

          <section className="gfew-panel p-4 text-xs text-text-dim">
            <strong className="text-text">Still not built (checked, disclosed rather than faked):</strong>{" "}
            country-level energy balances/import-dependency/spare-capacity accounting (needs licensed
            IEA/EIA bulk data), OPEC+ quota/compliance tracking, a genuine futures-curve/backwardation
            signal (needs a paid futures-chain feed), natural gas storage levels (needs a keyed EIA API
            registration this app does not have configured), electricity/grid reserve-margin and
            blackout-risk data, nuclear reactor-level outage tracking, renewable capacity/generation by
            country (IRENA&apos;s datasets not yet integrated), a real chokepoint-throughput/vessel-
            tracking system, critical-mineral mining/refining concentration breakdowns, a global energy
            trade network graph, a scenario library with a policy simulator, historical backtesting, and
            a daily report/AI Q&amp;A layer. See the{" "}
            <a href="/dashboard/methodology#energy-systemic-risk" className="text-accent hover:underline">
              methodology page
            </a>{" "}
            for the complete list.
          </section>
        </>
      )}
    </div>
  );
}
