import { getLatestEngine, getChinaSystemicRiskResult } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import { CHINA_STAGES, STRUCTURAL_WEIGHTS, COMPOSITE_WEIGHTS, type ChinaRegimeLabel } from "@/lib/engines/chinaSystemicRisk";
import { gfmiColor } from "@/components/RegimeBadge";
import { TrendIndicator } from "@/components/TrendIndicator";

const REGIME_COLORS: Record<ChinaRegimeLabel, string> = {
  STABLE: "#34c085",
  VULNERABILITY_BUILDING: "#3fa9f5",
  IMBALANCE_BUILDING: "#e0b93d",
  MARKET_STRESS: "#e0793d",
  SYSTEMIC_CRISIS: "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
};

function RegimePill({ regime }: { regime: ChinaRegimeLabel }) {
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

export default async function ChinaPage() {
  const [rows, csri] = await Promise.all([getLatestEngine("china"), getChinaSystemicRiskResult()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">China</h1>
      <EngineDetail title="China" rows={rows} />

      <h2 className="mb-2 mt-12 text-xl font-semibold">China Systemic Risk</h2>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        Where is financial and macroeconomic fragility building inside China, and is it converging
        across sectors — a genuinely different question from the flat, GFMI-weighted composite above.
        Six structural domains (Property, Banking, Fiscal/LGFV, Deflation, External/FX, Liquidity), a
        market domain (Shanghai Composite), and a Convergence score measuring how many of those six
        domains are independently elevated at once. Property and Banking domains read China&apos;s own
        row straight out of the existing Property/Banking Systemic Risk engines rather than
        re-deriving them. Province-level maps, LGFV/developer default tracking, a policy-response
        simulator, historical backtesting and a daily report are checked, not found free at this
        granularity, and disclosed rather than faked — see the methodology page for the full list.
      </p>

      {csri === null ? (
        <p className="text-sm text-text-dim">No data yet — trigger a pipeline run from /admin.</p>
      ) : (
        <>
          <section className="gfew-panel mb-8 p-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Crisis Stage</h3>
            <p className="mb-3 max-w-3xl text-xs text-text-dim">
              Stages 1-6 come from China&apos;s own Structural (property/banking/fiscal-LGFV/deflation/
              external/liquidity) + Market (Shanghai Composite) blend. Stage 7 requires a high
              Convergence reading — most structural domains elevated simultaneously — alongside an
              already-high composite.
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {CHINA_STAGES.map((s) => {
                const active = csri.stage === s.stage;
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
            {csri.compositeScore !== null ? (
              <p className="text-sm">
                Composite reading:{" "}
                <span className="gfew-mono font-semibold" style={{ color: scoreColor(csri.compositeScore) }}>
                  {csri.compositeScore}
                </span>{" "}
                <RegimePill regime={csri.regime} />{" "}
                {csri.hiddenRisk && <span className="ml-2 text-xs text-[#e0b93d]">Hidden China Risk: structural rising, market still calm</span>}
                {csri.marketLedWarning && <span className="ml-2 text-xs text-[#e0793d]">Market-led warning: market deteriorating ahead of fundamentals</span>}
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
                    <td className="px-3 py-2 font-medium">Property</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      Sales flow {fmt(csri.propertyReading.salesValue, "mn m²")} · Dev. investment{" "}
                      {fmt(csri.propertyReading.financingValue, "% YoY")}
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(csri.propertyScore) }}>
                      {csri.propertyScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Banking</td>
                    <td className="px-3 py-2 text-text-dim">China&apos;s row from the Banking Systemic Risk engine</td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(csri.bankingScore) }}>
                      {csri.bankingScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Fiscal / LGFV</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      {fmt(csri.fiscalReading.value, "% of GDP")}
                      <TrendIndicator value={csri.fiscalReading.value} previous={csri.fiscalReading.previousValue} />
                      <span className="ml-1 text-text-dim">(IMF augmented debt, annual)</span>
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(csri.fiscalScore) }}>
                      {csri.fiscalScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Deflation</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      CPI {fmt(csri.deflationReading.value, "% YoY", 2)}
                      <TrendIndicator value={csri.deflationReading.value} previous={csri.deflationReading.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(csri.deflationScore) }}>
                      {csri.deflationScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">External / FX</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      USDCNY {fmt(csri.externalFxReading.cny.value, "", 3)}
                      <TrendIndicator value={csri.externalFxReading.cny.value} previous={csri.externalFxReading.cny.previousValue} />
                      {" · "}Reserves ex-gold {fmt(csri.externalFxReading.reserves.value ? csri.externalFxReading.reserves.value / 1e6 : null, "USD tn", 2)}
                      <TrendIndicator value={csri.externalFxReading.reserves.value} previous={csri.externalFxReading.reserves.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(csri.externalScore) }}>
                      {csri.externalScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Liquidity / Money Market</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      3M interbank {fmt(csri.liquidityReading.value, "%", 2)}
                      <TrendIndicator value={csri.liquidityReading.value} previous={csri.liquidityReading.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(csri.liquidityScore) }}>
                      {csri.liquidityScore ?? "—"}
                    </td>
                  </tr>
                  <tr className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">Market (Shanghai Composite)</td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      {fmt(csri.marketReading.value, "", 1)}
                      <TrendIndicator value={csri.marketReading.value} previous={csri.marketReading.previousValue} />
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(csri.marketScore) }}>
                      {csri.marketScore ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">Score Breakdown</h2>
            <p className="mb-3 max-w-3xl text-xs text-text-dim">
              Weights are fixed (Structural 40% / Market 35% / Convergence 25% of composite; Property
              25% / Banking 20% / Fiscal-LGFV 15% / Deflation 15% / External 15% / Liquidity 10% of
              Structural).
            </p>
            <div className="gfew-panel p-3">
              <ContributionBar
                total={csri.compositeScore}
                segments={[
                  { label: "Structural", value: contribution(csri.structuralScore, COMPOSITE_WEIGHTS.structural), color: "#3fa9f5" },
                  { label: "Market", value: contribution(csri.marketScore, COMPOSITE_WEIGHTS.market), color: "#e0793d" },
                  { label: "Convergence", value: contribution(csri.convergenceScore, COMPOSITE_WEIGHTS.convergence), color: "#e05a4d" },
                ]}
              />
              <div className="mt-3 pl-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                  Structural ({csri.structuralScore ?? "—"}) breaks down as
                </div>
                <ContributionBar
                  total={null}
                  segments={[
                    { label: "Property", value: contribution(csri.propertyScore, STRUCTURAL_WEIGHTS.property), color: "#34c085" },
                    { label: "Banking", value: contribution(csri.bankingScore, STRUCTURAL_WEIGHTS.banking), color: "#e0b93d" },
                    { label: "Fiscal/LGFV", value: contribution(csri.fiscalScore, STRUCTURAL_WEIGHTS.fiscal), color: "#8b96a8" },
                    { label: "Deflation", value: contribution(csri.deflationScore, STRUCTURAL_WEIGHTS.deflation), color: "#3fa9f5" },
                    { label: "External", value: contribution(csri.externalScore, STRUCTURAL_WEIGHTS.external), color: "#e0793d" },
                    { label: "Liquidity", value: contribution(csri.liquidityScore, STRUCTURAL_WEIGHTS.liquidity), color: "#e05a4d" },
                  ]}
                />
              </div>
              <div className="mt-2 text-xs text-text-dim">
                Data completeness: {Math.round(csri.dataCompleteness * 100)}%
              </div>
            </div>
          </section>

          <section className="gfew-panel p-4 text-xs text-text-dim">
            <strong className="text-text">Still not built (checked, disclosed rather than faked):</strong>{" "}
            province-level LGFV/property/fiscal/banking risk maps (no free province-level breakdown
            found for any of these), Total Social Financing computed from raw PBOC flow data (BIS&apos;s
            own official Credit-to-GDP Gap is used as the established free proxy), individual LGFV
            bond/developer default event tracking, a genuine bank/property/LGFV exposure-weighted
            contagion network graph (the Convergence score above is a breadth proxy, not a network),
            dedicated shadow-banking/NBFI tracking, a China policy-space/fiscal-monetary-FX ammunition
            index, a 15-scenario stress-test library with a policy-response simulator, historical
            backtesting with lead-time validation, and a daily report/AI Q&amp;A layer. See the{" "}
            <a href="/dashboard/methodology#china-systemic-risk" className="text-accent hover:underline">
              methodology page
            </a>{" "}
            for the complete list.
          </section>
        </>
      )}
    </div>
  );
}
