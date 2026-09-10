import { getLatestEngine, getBankingSystemicRiskTable, getBankLevelTable } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import { BANKING_STAGES, STRUCTURAL_WEIGHTS, COMPOSITE_WEIGHTS, type CountryBankingRow } from "@/lib/engines/bankingSystemicRisk";
import { gfmiColor } from "@/components/RegimeBadge";

function fmt(v: number | null, unit: string, decimals = 2): string {
  if (v === null) return "—";
  return `${v.toFixed(decimals)}${unit ? " " + unit : ""}`;
}

function fmtUsdBn(v: number | null): string {
  if (v === null) return "—";
  return `$${(v / 1e9).toFixed(1)}B`;
}

function fmtPct(v: number | null, decimals = 1): string {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(decimals)}%`;
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

/** Weighted point contribution of one domain score to a parent composite —
 * i.e. what that domain actually added to the final number, not the domain's
 * own 0-100 reading. Used by the score-breakdown panel below (spec §110/135
 * "why is this score X"). Returns null (rather than 0) when the domain has
 * no data, so a missing input is visibly absent rather than silently
 * contributing zero. */
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
          <div
            key={s.label}
            style={{ width: `${sum > 0 ? (s.value / sum) * 100 : 0}%`, background: s.color }}
            title={`${s.label}: ${s.value} pts`}
          />
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

/** Liquidity-Solvency Matrix quadrant (spec §109/165) — placement uses the
 * same Capital score (solvency proxy) and Liquidity score already computed
 * per country, split at the midpoint of the 0-100 risk scale. Not a true
 * scatter plot (no charting library in this app — see other dashboard pages,
 * which use plain tables/steppers throughout), just the four buckets the
 * spec itself asks for. */
function quadrantFor(r: CountryBankingRow): "healthy" | "solvency_watch" | "liquidity_stress" | "crisis" | null {
  if (r.capitalScore === null || r.liquidityScore === null) return null;
  const highSolvencyRisk = r.capitalScore >= 50;
  const highLiquidityRisk = r.liquidityScore >= 50;
  if (!highSolvencyRisk && !highLiquidityRisk) return "healthy";
  if (highSolvencyRisk && !highLiquidityRisk) return "solvency_watch";
  if (!highSolvencyRisk && highLiquidityRisk) return "liquidity_stress";
  return "crisis";
}

export default async function BankingPage() {
  const [bankingRows, { rows, composite }, bankRows] = await Promise.all([
    getLatestEngine("banking"),
    getBankingSystemicRiskTable(),
    getBankLevelTable(),
  ]);
  const rankedBanks = [...bankRows].sort((a, b) => (b.riskScore ?? -1) - (a.riskScore ?? -1));

  const ranked = [...rows].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
  const topRisks = ranked.filter((r) => r.compositeScore !== null).slice(0, 6);
  const hiddenRisks = rows.filter((r) => r.hiddenRisk);
  const marketWarnings = rows.filter((r) => r.marketLedWarning);

  const bankingComposite = bankingRows.find((r) => r.horizon === "short") ?? bankingRows[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Global Banking Systemic Risk</h1>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        Country-level capital, credit, funding, liquidity and bank-equity-market tracking across nine
        banking systems (the G7 plus China and India). This is a new analytical layer — it does not add
        a second vote to GFMI; the existing GFMI-weighted &ldquo;Banking&rdquo; engine below (US
        delinquency/charge-off/CRE data plus Euro-area/UK funding-cost context) is unchanged. See the
        methodology page for exactly what free data each layer covers and what bank-level detail (CET1,
        LCR, NSFR, deposit concentration, interbank network) is genuinely unavailable rather than faked.
      </p>

      {bankingComposite && (
        <section className="gfew-panel mb-6 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Banking Stress — US Asset Quality + Euro-Area/UK Funding Cost (feeds GFMI)
          </h3>
          <div className="flex items-baseline gap-3">
            <span className="gfew-mono text-3xl font-bold" style={{ color: scoreColor(bankingComposite.score) }}>
              {bankingComposite.score ?? "—"}
            </span>
            <span className="text-sm uppercase tracking-wide text-text-dim">{bankingComposite.regime}</span>
          </div>
        </section>
      )}

      <section className="gfew-panel mb-8 p-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
          Crisis Stage (equal-weighted across all nine tracked banking systems)
        </h3>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Stages 1-6 come from each country&apos;s own Structural (capital/credit/funding/liquidity) +
          Market (bank-equity) + Contagion (cross-country breadth) blend. Stage 7 requires a large share
          of ALL nine countries to already be at Stage 6+ simultaneously — never assigned to a single
          country in isolation.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {BANKING_STAGES.map((s) => {
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
            Where Banking Risk Is Building
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
            Hidden Banking Risk (structural rising, market still calm)
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
            Market Warning (market deteriorating ahead of fundamentals)
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
          Liquidity–Solvency Matrix
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Places each tracked banking system by Capital score (solvency risk, x-axis) against Liquidity
          score (liquidity risk, y-axis), split at the midpoint of the 0–100 scale — the same four buckets
          the spec asks for: illiquid-but-solvent and insolvent-but-liquid are genuinely different problems
          from a system that is both, and this matrix is what keeps that distinction visible instead of
          collapsing everything into one composite number.
        </p>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-xs">
          <div />
          <div className="text-center font-semibold text-text-dim">Solvency: Low Risk</div>
          <div className="text-center font-semibold text-text-dim">Solvency: High Risk</div>

          <div className="flex items-center justify-end pr-1 font-semibold text-text-dim">Liquidity: Low Risk</div>
          {(["healthy", "solvency_watch"] as const).map((q) => (
            <div key={q} className="min-h-[90px] rounded border border-border p-2" style={{ background: "#1a1f28" }}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                {q === "healthy" ? "Healthy" : "Solvency Watch"}
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

          <div className="flex items-center justify-end pr-1 font-semibold text-text-dim">Liquidity: High Risk</div>
          {(["liquidity_stress", "crisis"] as const).map((q) => (
            <div key={q} className="min-h-[90px] rounded border border-border p-2" style={{ background: "#1a1f28" }}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                {q === "liquidity_stress" ? "Liquidity Stress" : "Banking Crisis Risk"}
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
            Not placed (insufficient capital/liquidity data):{" "}
            {rows.filter((r) => quadrantFor(r) === null).map((r) => r.country).join(", ")}
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Banking Systemic Risk — Country Table
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Capital = World Bank bank capital/assets ratio (a leverage ratio, not risk-weighted CET1),
          cross-sectional. Credit = World Bank NPL ratio, blended with US delinquency/charge-off/CRE data
          for the US and the BIS credit-to-GDP gap for UK/Canada/Japan. Funding = each country&apos;s own
          policy/interbank rate. Liquidity = each country&apos;s own central-bank balance-sheet/reserves
          series. Market = a bank-sector equity index or representative bank (see methodology for exactly
          which, per country). Structural = Capital 35% + Credit 30% + Funding 15% + Liquidity 20%.
          Composite = Structural 40% + Market 35% + Contagion 25%.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Capital</th>
                <th className="px-3 py-2 font-medium">NPL Ratio</th>
                <th className="px-3 py-2 font-medium">Funding Rate</th>
                <th className="px-3 py-2 font-medium">Liquidity</th>
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
                    {fmt(r.capitalRatio.value, "%", 1)}
                    <div className="text-[10px]">{r.capitalRatio.asOf?.slice(0, 4) ?? "—"}</div>
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {fmt(r.nplRatio.value, "%", 1)}
                    <div className="text-[10px]">{r.nplRatio.asOf?.slice(0, 4) ?? "—"}</div>
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.fundingRate.value, "%")}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {r.liquidityReading.score !== null ? (
                      <span style={{ color: scoreColor(r.liquidityScore) }}>{r.liquidityScore}</span>
                    ) : (
                      "—"
                    )}
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
                        title={BANKING_STAGES[r.stage - 1]?.description}
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
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Score Breakdown — Why Is This Composite What It Is?
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Every contribution below is traceable to an underlying observation (spec §110/135): the top bar
          shows how many of the composite&apos;s points came from Structural, Market and Contagion; the
          bottom bar shows how Structural itself splits across Capital, Credit, Funding and Liquidity.
          Weights are fixed (Structural 40% / Market 35% / Contagion 25% of composite; Capital 35% /
          Credit 30% / Funding 15% / Liquidity 20% of Structural) — shown for the six highest-composite
          countries.
        </p>
        <div className="space-y-4">
          {topRisks.map((r) => (
            <div key={r.country} className="gfew-panel p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-medium">{r.country}</span>
                <span className="text-xs text-text-dim">
                  Stage {r.stage} · {r.stageLabel}
                </span>
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
                    { label: "Capital", value: contribution(r.capitalScore, STRUCTURAL_WEIGHTS.capital), color: "#34c085" },
                    { label: "Credit", value: contribution(r.creditScore, STRUCTURAL_WEIGHTS.credit), color: "#e0b93d" },
                    { label: "Funding", value: contribution(r.fundingScore, STRUCTURAL_WEIGHTS.funding), color: "#3fa9f5" },
                    { label: "Liquidity", value: contribution(r.liquidityScore, STRUCTURAL_WEIGHTS.liquidity), color: "#8b96a8" },
                  ]}
                />
              </div>
            </div>
          ))}
          {topRisks.length === 0 && <p className="text-sm text-text-dim">No data yet.</p>}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Bank-Level Detail — US G-SIBs &amp; Large Regionals
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Real per-bank data from SEC EDGAR XBRL filings (Total Assets, Equity, Deposits, Loans, Net
          Income — standard GAAP concepts, not estimates). The literal Basel III CET1 ratio, LCR and
          NSFR are NOT shown here: they are regulatory concepts each bank tags with its own custom
          XBRL element names rather than a common comparable tag, and the free bulk source that does
          carry them (FFIEC&apos;s CDR) is Cloudflare-blocked for a plain automated request — a
          registered CDR account&apos;s credentials would unlock the fuller version, a disclosed future
          upgrade, not built this pass. Leverage Ratio (Equity/Assets) is a genuine but different
          capital-adequacy measure computed from these two clean GAAP figures instead. Risk Score
          blends Leverage (40%), Deposit Growth (30%) and an ROA proxy (30%), cross-sectionally
          z-scored against these same eleven peer banks — a first-pass bank screen, not the full
          five-domain model the country table above uses.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Bank</th>
                <th className="px-3 py-2 font-medium">Total Assets</th>
                <th className="px-3 py-2 font-medium">Equity</th>
                <th className="px-3 py-2 font-medium">Leverage Ratio</th>
                <th className="px-3 py-2 font-medium">Deposits</th>
                <th className="px-3 py-2 font-medium">Deposit Growth (YoY)</th>
                <th className="px-3 py-2 font-medium">Loans</th>
                <th className="px-3 py-2 font-medium">ROA (TTM)</th>
                <th className="px-3 py-2 font-medium">Risk Score</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {rankedBanks.map((b) => (
                <tr key={b.key} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">
                    {b.name}
                    {b.gsib && (
                      <span className="ml-1.5 inline-block rounded bg-panel-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-dim">
                        G-SIB
                      </span>
                    )}
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmtUsdBn(b.totalAssets.value)}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmtUsdBn(b.totalEquity.value)}</td>
                  <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(b.leverageScore) }}>
                    {fmt(b.leverageRatio, "%")}
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmtUsdBn(b.totalDeposits.value)}</td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(b.depositGrowthScore) }}>
                    {fmtPct(b.depositGrowthYoy)}
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmtUsdBn(b.totalLoans.value)}</td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(b.roaScore) }}>
                    {fmt(b.roa, "%")}
                  </td>
                  <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(b.riskScore) }}>
                    {b.riskScore ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-text-dim">{Math.round(b.dataCompleteness * 100)}%</td>
                </tr>
              ))}
              {bankRows.length === 0 && (
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

      <EngineDetail title="Banking Stress — US Asset Quality + Euro-Area/UK Funding Cost (feeds GFMI)" rows={bankingRows} />
    </div>
  );
}
