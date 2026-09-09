import { getLatestEngine, getG7DebtTable } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import { G7_CRISIS_STAGES, g7Breadth } from "@/lib/engines/g7DebtRegime";
import type { G7DebtRegimeLabel, CountryG7DebtRow } from "@/lib/engines/g7DebtRegime";
import { gfmiColor } from "@/components/RegimeBadge";

const REGIME_COLORS: Record<G7DebtRegimeLabel, string> = {
  WELL_ABSORBED: "#34c085",
  NORMAL: "#3fa9f5",
  SOFTENING_DEMAND: "#e0b93d",
  FUNDING_STRESS: "#e0793d",
  DISLOCATED: "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
};

function RegimePill({ regime }: { regime: G7DebtRegimeLabel }) {
  const color = REGIME_COLORS[regime];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ background: `${color}22`, color }}
    >
      {regime.replace(/_/g, " ")}
    </span>
  );
}

function scoreColor(score: number | null): string {
  if (score === null) return "#5a6472";
  if (score < 20) return "#34c085";
  if (score < 40) return "#3fa9f5";
  if (score < 60) return "#e0b93d";
  if (score < 80) return "#e0793d";
  return "#e05a4d";
}

function fmt(v: number | null, unit: string, decimals = 1): string {
  if (v === null) return "—";
  return `${v.toFixed(decimals)}${unit ? " " + unit : ""}`;
}

function fmtScore(v: number | null): string {
  return v === null ? "—" : String(v);
}

const STAGE_SAMPLE_SCORE = [10, 25, 40, 55, 70, 85, 95];

function stageColor(stage: number | null): { bg: string; fg: string } {
  if (stage === null || stage < 1 || stage > 7) return { bg: "#1a1f28", fg: "#8b96a8" };
  return gfmiColor(STAGE_SAMPLE_SCORE[stage - 1]);
}

export default async function G7DebtPage() {
  const [treasuryRows, { rows: countryTable, composite }] = await Promise.all([
    getLatestEngine("us_treasury_sovereign"),
    getG7DebtTable(),
  ]);

  const ranked = [...countryTable].sort((a, b) => (b.vulnerabilityScore ?? -1) - (a.vulnerabilityScore ?? -1));
  const topRisks = ranked.filter((r) => r.vulnerabilityScore !== null).slice(0, 5);
  const hiddenRisks = countryTable.filter((r) => r.hiddenRisk);
  const marketLed = countryTable.filter((r) => r.marketLedWarning);
  const { stressedCount, totalWithData } = g7Breadth(countryTable);

  const treasuryComposite = treasuryRows.find((r) => r.horizon === "short") ?? treasuryRows[0] ?? null;
  const usDetail = countryTable.find((r) => r.country === "United States")?.usDetail ?? null;

  function fmtUsd(v: number | null): string {
    if (v === null) return "—";
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    return `$${v.toLocaleString()}`;
  }

  function why(r: CountryG7DebtRow): string {
    const s = r.structuralScore ?? 0;
    const m = r.marketScore ?? 0;
    if (s > m + 10) return "structural fundamentals (debt/GDP, fiscal balance) are the main driver";
    if (m > s + 10) return "bond-market pricing is the main driver";
    return "both structural fundamentals and bond-market pricing are elevated together";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">G7 Sovereign Debt</h1>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        A three-score-per-country breakdown (Structural Vulnerability, Market Stress,
        Funding/Contagion) across the US, Japan, Germany, France, Italy, the UK and Canada —
        a deeper analytical layer on top of the same yield and debt/GDP data already feeding
        the composite Treasury &amp; Sovereign engine below, not a second vote in GFMI. See the
        methodology page for exactly what this does and doesn&apos;t cover.
      </p>

      {treasuryComposite && (
        <section className="gfew-panel mb-6 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Composite (Treasury &amp; Sovereign engine, feeds GFMI)
          </h3>
          <div className="flex items-baseline gap-3">
            <span className="gfew-mono text-3xl font-bold" style={{ color: scoreColor(treasuryComposite.score) }}>
              {fmtScore(treasuryComposite.score)}
            </span>
            <span className="text-sm uppercase tracking-wide text-text-dim">{treasuryComposite.regime}</span>
          </div>
        </section>
      )}

      <section className="gfew-panel mb-8 p-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
          Crisis Stage (GDP-weighted G7 composite)
        </h3>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          A 7-stage progression over a GDP-weighted blend of the seven countries&apos; own
          vulnerability scores below (the US and Japan carry more weight than smaller G7
          economies, per the spec this engine was built against) — not a separately-detected
          regime. Stage 7 marks the top of what this model can measure; it is a score band, not
          a confirmed sovereign-debt crisis, since no free data source can observe an actual
          default or IMF program.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {G7_CRISIS_STAGES.map((s) => {
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
                <div className="gfew-mono text-[10px] font-semibold uppercase tracking-wide">
                  Stage {s.stage}
                </div>
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
            Where Risk Is Building
          </h3>
          {topRisks.length === 0 && <p className="text-sm text-text-dim">No data yet.</p>}
          <ol className="space-y-2">
            {topRisks.map((r, i) => (
              <li key={r.country} className="text-sm">
                <span className="gfew-mono mr-2 text-text-dim">{i + 1}.</span>
                <span className="font-medium">{r.country}</span>{" "}
                <span className="gfew-mono" style={{ color: scoreColor(r.vulnerabilityScore) }}>
                  {r.vulnerabilityScore}
                </span>
                <div className="ml-5 text-xs text-text-dim">{why(r)}</div>
              </li>
            ))}
          </ol>
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Hidden Risk (structural building, market still calm)
          </h3>
          {hiddenRisks.length === 0 ? (
            <p className="text-sm text-text-dim">None currently — no country shows elevated structural vulnerability while bond-market pricing stays calm.</p>
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
            Market Already Warning (pricing ahead of fundamentals)
          </h3>
          {marketLed.length === 0 ? (
            <p className="text-sm text-text-dim">None currently — no country shows bond-market pricing meaningfully ahead of its structural fundamentals.</p>
          ) : (
            <ul className="space-y-1">
              {marketLed.map((r) => (
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

      {usDetail && (
        <section className="gfew-panel mb-8 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
            US Treasury Live Detail
          </h3>
          <p className="mb-3 max-w-3xl text-xs text-text-dim">
            Live, free, official US Treasury-market data not yet folded into the structural/market
            scores above (it exists only for the US, and the auction series needs ~20 real auctions
            of history — roughly 20 months, since each tenor is auctioned monthly — before a
            proper time-series signal can be computed) — shown here as genuine context, not
            fabricated. Debt-to-the-penny and Fed SOMA holdings from Treasury Fiscal Data and the
            New York Fed directly; auction results from Treasury Fiscal Data&apos;s own
            auctions_query dataset.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-text-dim">Total Public Debt</div>
              <div className="gfew-mono text-lg font-semibold">{fmtUsd(usDetail.debtTotalUsd)}</div>
              <div className="text-[10px] text-text-dim">
                Held by public {fmtUsd(usDetail.debtHeldByPublicUsd)} · Intragov {fmtUsd(usDetail.debtIntragovernmentalUsd)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-text-dim">Fed (SOMA) Treasury Holdings</div>
              <div className="gfew-mono text-lg font-semibold">{fmtUsd(usDetail.fedTreasuryHoldingsUsd)}</div>
              <div className="text-[10px] text-text-dim">
                {usDetail.fedHoldingsSharePct !== null ? `${usDetail.fedHoldingsSharePct.toFixed(1)}% of total public debt` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-text-dim">Latest 10Y Note Auction</div>
              <div className="gfew-mono text-lg font-semibold">
                {usDetail.auction10yBidToCover !== null ? `${usDetail.auction10yBidToCover.toFixed(2)}x cover` : "—"}
              </div>
              <div className="text-[10px] text-text-dim">
                {usDetail.auction10yHighYield !== null ? `${usDetail.auction10yHighYield.toFixed(3)}% high yield` : ""}
                {usDetail.auction10yIndirectPct !== null ? ` · ${usDetail.auction10yIndirectPct.toFixed(0)}% indirect bidders` : ""}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-text-dim">Latest 30Y Bond Auction</div>
              <div className="gfew-mono text-lg font-semibold">
                {usDetail.auction30yBidToCover !== null ? `${usDetail.auction30yBidToCover.toFixed(2)}x cover` : "—"}
              </div>
              <div className="text-[10px] text-text-dim">
                {usDetail.auction30yHighYield !== null ? `${usDetail.auction30yHighYield.toFixed(3)}% high yield` : ""}
                {usDetail.auction30yIndirectPct !== null ? ` · ${usDetail.auction30yIndirectPct.toFixed(0)}% indirect bidders` : ""}
              </div>
            </div>
          </div>
        </section>
      )}

      <p className="mb-4 text-sm text-text-dim">
        <span className="font-medium text-text">{stressedCount} of {totalWithData}</span> tracked
        G7 economies are currently at Softening-Demand-or-worse (vulnerability score ≥ 60) — the
        funding/contagion breadth input to each country&apos;s score above.
      </p>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Sovereign Vulnerability by Country
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Structural = government debt/GDP and fiscal balance/GDP (IMF Global Debt Database /
          World Economic Outlook for France&apos;s debt/GDP and every country&apos;s fiscal
          balance; FRED-sourced official series for the other six countries&apos; debt/GDP),
          cross-sectionally z-scored against the other six G7 economies. Market = each
          country&apos;s own 10Y-yield time-series z-score, blended for France and Italy with
          their own spread-to-Bund time-series z-score. Funding/Contagion = the share of the
          OTHER six G7 economies already at Softening-Demand-or-worse — a single G7-wide breadth
          reading, not yet a bespoke bilateral-exposure-weighted contagion score. See the
          methodology page for what else (auction stress, interest-burden acceleration, investor
          base, central-bank dependency) is checked and explicitly not included yet.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Vulnerability</th>
                <th className="px-3 py-2 font-medium">Crisis Stage</th>
                <th className="px-3 py-2 font-medium">Structural</th>
                <th className="px-3 py-2 font-medium">Market</th>
                <th className="px-3 py-2 font-medium">Funding</th>
                <th className="px-3 py-2 font-medium">Debt/GDP</th>
                <th className="px-3 py-2 font-medium">Fiscal Bal./GDP</th>
                <th className="px-3 py-2 font-medium">10Y Yield</th>
                <th className="px-3 py-2 font-medium">Spread vs Bund</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.country} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.country}</div>
                    <div className="text-[10px] text-text-dim">{r.currency} · {r.centralBank}</div>
                    {r.hiddenRisk && (
                      <span className="mt-1 inline-block rounded bg-[#3d2f1d] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#e0b93d]">
                        Hidden
                      </span>
                    )}
                    {r.marketLedWarning && (
                      <span className="mt-1 ml-1 inline-block rounded bg-[#3d1d1d] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#e05a4d]">
                        Market-Led
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="gfew-mono mb-1 font-semibold" style={{ color: scoreColor(r.vulnerabilityScore) }}>
                      {fmtScore(r.vulnerabilityScore)}
                    </div>
                    <RegimePill regime={r.regime} />
                  </td>
                  <td className="px-3 py-2">
                    {r.crisisStage !== null ? (
                      <span
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold"
                        style={{ background: `${stageColor(r.crisisStage).fg}22`, color: stageColor(r.crisisStage).fg }}
                        title={G7_CRISIS_STAGES[r.crisisStage - 1]?.description}
                      >
                        {r.crisisStage} · {r.crisisStageLabel}
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(r.structuralScore) }}>
                    {fmtScore(r.structuralScore)}
                  </td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(r.marketScore) }}>
                    {fmtScore(r.marketScore)}
                  </td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(r.fundingScore) }}>
                    {fmtScore(r.fundingScore)}
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.debtToGdp.value, "%")}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.fiscalBalanceToGdp.value, "%")}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.yield10y.value, "%", 2)}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {r.bundSpreadBps ? fmt(r.bundSpreadBps.value, "bps", 0) : "—"}
                  </td>
                  <td className="px-3 py-2 text-text-dim">{Math.round(r.dataCompleteness * 100)}%</td>
                </tr>
              ))}
              {countryTable.length === 0 && (
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

      <EngineDetail title="Treasury & Sovereign (feeds GFMI)" rows={treasuryRows} />
    </div>
  );
}
