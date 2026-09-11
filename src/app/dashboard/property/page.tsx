import { getLatestEngine, getPropertySystemicRiskTable, getBankingSystemicRiskTable } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import {
  PROPERTY_STAGES,
  STRUCTURAL_WEIGHTS,
  COMPOSITE_WEIGHTS,
  getLeadingCompositeScore,
  type CountryPropertyRow,
} from "@/lib/engines/propertySystemicRisk";
import { gfmiColor } from "@/components/RegimeBadge";
import { TrendIndicator } from "@/components/TrendIndicator";

function fmt(v: number | null, unit: string, decimals = 2): string {
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

/** Property Valuation vs Financial Stress Matrix (spec §253) — placement
 * uses the same Valuation score (structural, x-axis) against Composite
 * score (overall financial stress, y-axis) already computed per country,
 * split at the midpoint of the 0-100 risk scale. Same "plain buckets, no
 * charting library" approach as Banking's Liquidity-Solvency Matrix. */
function quadrantFor(r: CountryPropertyRow): "healthy" | "hidden_risk" | "distressed" | "critical" | null {
  if (r.valuationScore === null || r.compositeScore === null) return null;
  const highValuation = r.valuationScore >= 50;
  const highStress = r.compositeScore >= 50;
  if (!highValuation && !highStress) return "healthy";
  if (highValuation && !highStress) return "hidden_risk";
  if (!highValuation && highStress) return "distressed";
  return "critical";
}

export default async function PropertyPage() {
  const [legacyRows, { rows, composite }, { rows: bankingRows }] = await Promise.all([
    getLatestEngine("property"),
    getPropertySystemicRiskTable(),
    getBankingSystemicRiskTable(),
  ]);

  const ranked = [...rows].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
  const topRisks = ranked.filter((r) => r.compositeScore !== null).slice(0, 6);
  const hiddenRisks = rows.filter((r) => r.hiddenRisk);
  const marketWarnings = rows.filter((r) => r.marketLedWarning);

  const propertyComposite = legacyRows.find((r) => r.horizon === "short") ?? legacyRows[0] ?? null;

  const leadingComposite = getLeadingCompositeScore(rows);
  const rankedByLeading = [...rows].filter((r) => r.leadingScore !== null).sort((a, b) => (b.leadingScore as number) - (a.leadingScore as number));

  // Property-Bank Convergence (spec §141) — joins this table with the
  // Banking Systemic Risk table on country key (both reuse BANKING_COUNTRIES
  // verbatim, so the join is exact, not fuzzy-matched).
  const bankingByKey = new Map(bankingRows.map((b) => [b.country, b]));
  const convergenceRows = rows
    .map((p) => ({ property: p, banking: bankingByKey.get(p.country) }))
    .filter((r) => (r.property.compositeScore ?? 0) >= 55 && (r.banking?.compositeScore ?? 0) >= 55);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Global Property Systemic Risk</h1>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        Country-level valuation, credit-boom, affordability and property-equity-market tracking across
        nine markets (the G7 plus China and India). This is a new analytical layer — it does not add a
        second vote to GFMI; the existing GFMI-weighted &ldquo;Property&rdquo; engine below (BIS real
        house-price indices plus US mortgage-rate/starts/permits) is unchanged. See the methodology page
        for exactly what free data each layer covers and what granular detail (CRE by sector, developer
        balance sheets, mortgage LTV/DSR, REIT NAV) is genuinely unavailable rather than faked.
      </p>

      {propertyComposite && (
        <section className="gfew-panel mb-6 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Property Stress — BIS Real HPI (8 countries) + US Mortgage/Starts/Permits (feeds GFMI)
          </h3>
          <div className="flex items-baseline gap-3">
            <span className="gfew-mono text-3xl font-bold" style={{ color: scoreColor(propertyComposite.score) }}>
              {propertyComposite.score ?? "—"}
            </span>
            <span className="text-sm uppercase tracking-wide text-text-dim">{propertyComposite.regime}</span>
          </div>
        </section>
      )}

      <section className="gfew-panel mb-8 p-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
          Crisis Stage (equal-weighted across all nine tracked property markets)
        </h3>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Stages 1-6 come from each country&apos;s own Structural (valuation/credit/affordability) +
          Market (property-equity/REIT) + Contagion (cross-country breadth) blend. Stage 7 requires a
          large share of ALL nine countries to already be at Stage 6+ simultaneously — never assigned to
          a single country in isolation.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PROPERTY_STAGES.map((s) => {
            const active = composite.stage?.stage === s.stage;
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
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Where Property Fragility Is Building
          </h3>
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
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Hidden Property Risk (structural rising, market still calm)
          </h3>
          {hiddenRisks.length === 0 ? (
            <p className="text-sm text-text-dim">None currently detected across the tracked universe.</p>
          ) : (
            <ul className="space-y-1">
              {hiddenRisks.map((r) => (
                <li key={r.country} className="text-sm">
                  <span className="font-medium">{r.country}</span>{" "}
                  <span className="text-xs text-text-dim">
                    (structural {r.structuralScore}, market {r.marketScore})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Market Already Warning (market deteriorating ahead of fundamentals)
          </h3>
          {marketWarnings.length === 0 ? (
            <p className="text-sm text-text-dim">None currently detected across the tracked universe.</p>
          ) : (
            <ul className="space-y-1">
              {marketWarnings.map((r) => (
                <li key={r.country} className="text-sm">
                  <span className="font-medium">{r.country}</span>{" "}
                  <span className="text-xs text-text-dim">
                    (market {r.marketScore}, structural {r.structuralScore})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Property-Bank Systemic Convergence
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Spec §141: a country where BOTH this property table AND the Banking Systemic Risk table (see{" "}
          <a href="/dashboard/banking" className="text-accent hover:underline">/dashboard/banking</a>) are
          simultaneously elevated (composite ≥ 55) — joined on the same nine country keys both engines
          share, not fuzzy-matched. Per spec §243/244&apos;s own acceptance tests: property stress alone
          does NOT imply bank systemic risk (a country can appear stressed here without appearing below),
          and the reverse.
        </p>
        {convergenceRows.length === 0 ? (
          <p className="text-sm text-text-dim">No country currently shows both property and banking stress simultaneously.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-raised text-text-dim">
                <tr>
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-3 py-2 font-medium">Property Composite</th>
                  <th className="px-3 py-2 font-medium">Banking Composite</th>
                </tr>
              </thead>
              <tbody>
                {convergenceRows.map(({ property, banking }) => (
                  <tr key={property.country} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{property.country}</td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(property.compositeScore) }}>
                      {property.compositeScore}
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(banking?.compositeScore ?? null) }}>
                      {banking?.compositeScore ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Property Valuation vs Financial Stress Matrix
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Spec §253: places each country by Valuation score (structural, x-axis) against Composite score
          (overall financial stress, y-axis), split at the midpoint of the 0–100 scale. High valuation
          with low current stress is exactly the &ldquo;Hidden Risk&rdquo; case spec §124 asks this
          engine to surface — a market that looks calm but is structurally stretched.
        </p>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-xs">
          <div />
          <div className="text-center font-semibold text-text-dim">Valuation: Low</div>
          <div className="text-center font-semibold text-text-dim">Valuation: High</div>

          <div className="flex items-center justify-end pr-1 font-semibold text-text-dim">Stress: Low</div>
          {(["healthy", "hidden_risk"] as const).map((q) => (
            <div key={q} className="min-h-[90px] rounded border border-border p-2" style={{ background: "#1a1f28" }}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                {q === "healthy" ? "Healthy" : "Hidden Risk"}
              </div>
              <div className="flex flex-wrap gap-1">
                {rows.filter((r) => quadrantFor(r) === q).map((r) => (
                  <span
                    key={r.country}
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                    style={{ background: `${scoreColor(r.compositeScore)}22`, color: scoreColor(r.compositeScore) }}
                  >
                    {r.country}
                  </span>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-end pr-1 font-semibold text-text-dim">Stress: High</div>
          {(["distressed", "critical"] as const).map((q) => (
            <div key={q} className="min-h-[90px] rounded border border-border p-2" style={{ background: "#1a1f28" }}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                {q === "distressed" ? "Distressed / Possible Opportunity" : "Critical"}
              </div>
              <div className="flex flex-wrap gap-1">
                {rows.filter((r) => quadrantFor(r) === q).map((r) => (
                  <span
                    key={r.country}
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                    style={{ background: `${scoreColor(r.compositeScore)}22`, color: scoreColor(r.compositeScore) }}
                  >
                    {r.country}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {rows.some((r) => quadrantFor(r) === null) && (
          <p className="mt-2 text-[11px] text-text-dim">
            Not placed (insufficient valuation/composite data):{" "}
            {rows.filter((r) => quadrantFor(r) === null).map((r) => r.country).join(", ")}
          </p>
        )}
        <p className="mt-2 text-[11px] text-text-dim">
          This model does not label any quadrant an investment recommendation (spec §253&apos;s own
          instruction) — it is a systemic-risk read, not portfolio guidance.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Property Systemic Risk — Country Table
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Valuation = BIS real house-price index, scored as each country&apos;s OWN deviation from its
          15-year trend (not compared cross-sectionally as a raw level). Credit = BIS credit-to-GDP gap
          (total private credit, not mortgage-specific). Affordability = each country&apos;s own
          policy/interbank rate, a financing-cost proxy. Market = a property-sector equity index/REIT or
          representative developer (see methodology for exactly which, per country). Structural =
          Valuation 40% + Credit 30% + Affordability 30%. Composite = Structural 40% + Market 35% +
          Contagion 25%.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Valuation</th>
                <th className="px-3 py-2 font-medium">Credit Gap</th>
                <th className="px-3 py-2 font-medium">Affordability</th>
                <th className="px-3 py-2 font-medium">Market</th>
                <th className="px-3 py-2 font-medium">Structural</th>
                <th className="px-3 py-2 font-medium">Contagion</th>
                <th className="px-3 py-2 font-medium">Composite</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.country} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">{r.country}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {fmt(r.valuationReading.value, "", 1)}
                    <TrendIndicator value={r.valuationReading.value} previous={r.valuationReading.previousValue} />
                    <div className="text-[10px]">{r.valuationReading.asOf?.slice(0, 7) ?? "—"}</div>
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {fmt(r.creditReading.value, "pp", 1)}
                    <TrendIndicator value={r.creditReading.value} previous={r.creditReading.previousValue} />
                    <div className="text-[10px]">{r.creditReading.asOf?.slice(0, 7) ?? "—"}</div>
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {fmt(r.affordabilityReading.value, "%")}
                    <TrendIndicator value={r.affordabilityReading.value} previous={r.affordabilityReading.previousValue} />
                  </td>
                  <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.marketScore) }}>
                    {r.marketScore ?? "—"}
                  </td>
                  <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.structuralScore) }}>
                    {r.structuralScore ?? "—"}
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
                        title={PROPERTY_STAGES[r.stage - 1]?.description}
                      >
                        {r.stage} · {r.stageLabel}
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-dim">{Math.round(r.dataCompleteness * 100)}%</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-text-dim">
                    No data yet — trigger a pipeline run from /admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="gfew-panel mb-8 p-4" id="leading-property-stress-score">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">Leading Property Stress Score</h3>
          <a href="/dashboard/methodology#leading-property-stress-score" className="text-xs text-accent hover:underline">
            Methodology →
          </a>
        </div>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          A re-derivation of numbers already shown above, using only the two inputs the spec&apos;s own
          §137 leading/lagging classification explicitly calls LEADING: Valuation (50%) and Credit-to-GDP
          Gap (50%) — excluding Affordability and Market, which spec doesn&apos;t classify as leading
          here. See the extrapolation disclaimer on the methodology page before treating a high reading
          as a validated forecast.
        </p>
        <div className="mb-4 flex items-baseline gap-3">
          <span className="gfew-mono text-3xl font-bold" style={{ color: scoreColor(leadingComposite) }}>
            {leadingComposite ?? "—"}
          </span>
          <span className="text-sm uppercase tracking-wide text-text-dim">Equal-weighted across the nine tracked markets</span>
        </div>
        <ol className="space-y-1.5">
          {rankedByLeading.map((r, i) => (
            <li key={r.country} className="text-sm">
              <span className="gfew-mono mr-2 text-text-dim">{i + 1}.</span>
              <span className="font-medium">{r.country}</span>{" "}
              <span className="gfew-mono" style={{ color: scoreColor(r.leadingScore) }}>
                {r.leadingScore}
              </span>
            </li>
          ))}
          {rankedByLeading.length === 0 && <li className="text-sm text-text-dim">No data yet.</li>}
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Score Breakdown — Why Is This Composite What It Is?
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          The top bar shows how many of the composite&apos;s points came from Structural, Market and
          Contagion; the bottom bar shows how Structural itself splits across Valuation, Credit and
          Affordability. Weights are fixed (Structural 40% / Market 35% / Contagion 25% of composite;
          Valuation 40% / Credit 30% / Affordability 30% of Structural) — shown for the six
          highest-composite countries.
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
              <div className="mt-3 pl-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                  Structural ({r.structuralScore ?? "—"}) breaks down as
                </div>
                <ContributionBar
                  total={null}
                  segments={[
                    { label: "Valuation", value: contribution(r.valuationScore, STRUCTURAL_WEIGHTS.valuation), color: "#34c085" },
                    { label: "Credit", value: contribution(r.creditScore, STRUCTURAL_WEIGHTS.credit), color: "#e0b93d" },
                    { label: "Affordability", value: contribution(r.affordabilityScore, STRUCTURAL_WEIGHTS.affordability), color: "#8b96a8" },
                  ]}
                />
              </div>
            </div>
          ))}
          {topRisks.length === 0 && <p className="text-sm text-text-dim">No data yet.</p>}
        </div>
      </section>

      <EngineDetail title="Property Stress — BIS Real HPI + US Mortgage/Starts/Permits (feeds GFMI)" rows={legacyRows} />
    </div>
  );
}
