import { getTreasuryRiskTable, getUsTreasuryCashPanel, getUsAuctionHealthPanel } from "@/lib/api/engineData";
import {
  TREASURY_STAGES,
  STRUCTURAL_WEIGHTS,
  COMPOSITE_WEIGHTS,
  TREASURY_REGION_ORDER,
  type TreasuryRegimeLabel,
} from "@/lib/engines/treasuryRiskEngine";
import { gfmiColor } from "@/components/RegimeBadge";
import { TrendIndicator } from "@/components/TrendIndicator";

const REGIME_COLORS: Record<TreasuryRegimeLabel, string> = {
  WELL_FUNDED: "#34c085",
  NORMAL: "#3fa9f5",
  FUNDING_PRESSURE: "#e0b93d",
  MARKET_ACCESS_STRESS: "#e0793d",
  SOVEREIGN_FUNDING_CRISIS: "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
};

function RegimePill({ regime }: { regime: TreasuryRegimeLabel }) {
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

function fmtUsdBn(v: number | null): string {
  if (v === null) return "—";
  return `$${(v / 1e9).toFixed(1)}B`;
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

export default async function TreasuryRiskPage() {
  const [{ rows, composite }, cashPanel, auctionPanel] = await Promise.all([
    getTreasuryRiskTable(),
    getUsTreasuryCashPanel(),
    getUsAuctionHealthPanel(),
  ]);

  const ranked = [...rows].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
  const topRisks = ranked.filter((r) => r.compositeScore !== null).slice(0, 6);
  const hiddenRisks = rows.filter((r) => r.hiddenRisk);
  const marketWarnings = rows.filter((r) => r.marketLedWarning);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Global Treasury Risk</h1>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        Can each government actually fund and manage its obligations right now — a genuinely different
        question from sovereign debt sustainability (see the G7 Debt and EM Debt pages) or from the
        existing GFMI-weighted &ldquo;Treasury&rdquo; yield/debt-to-GDP engine, both unchanged by this
        page. Funding cost (short-rate trend), external/FX debt exposure, foreign-investor holdings and
        sovereign market access across 21 Treasuries (G7 + 14 major EM), plus two US-specific real-time
        panels — Treasury cash balance/debt-ceiling headroom and multi-tenor auction health — genuinely
        new data this pass. Cash-flow forecasting, non-US cash/auction data, debt-maturity walls,
        contingent liabilities (SOEs, PPPs, pensions) and stress-test/backtest libraries are checked, not
        found free and structured across this many countries, and disclosed rather than faked — see the
        methodology page for the full list.
      </p>

      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="gfew-panel p-4" id="us-treasury-cash">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
            US Treasury Cash &amp; Debt Ceiling
          </h3>
          <p className="mb-3 text-xs text-text-dim">
            Daily Treasury Statement — the government&apos;s own checking-account balance at the Fed
            (TGA), and debt-ceiling headroom (Statutory Debt Limit minus debt actually subject to it).
            Per this app&apos;s data-failure policy, this deliberately does NOT project an &ldquo;X-date&rdquo;
            exhaustion estimate — only the real, current headroom figure.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-text-dim">TGA Balance</div>
              <div className="gfew-mono text-xl font-bold">
                {fmtUsdBn(cashPanel?.tgaBalanceUsd ?? null)}
                <TrendIndicator value={cashPanel?.tgaBalanceUsd ?? null} previous={cashPanel?.tgaBalancePreviousUsd ?? null} />
              </div>
              <div className="text-[10px] text-text-dim">As of {cashPanel?.tgaAsOf ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-text-dim">Debt-Limit Headroom</div>
              <div
                className="gfew-mono text-xl font-bold"
                style={{ color: (cashPanel?.debtLimitHeadroomUsd ?? 1) < 0 ? "#e05a4d" : undefined }}
              >
                {fmtUsdBn(cashPanel?.debtLimitHeadroomUsd ?? null)}
                <TrendIndicator value={cashPanel?.debtLimitHeadroomUsd ?? null} previous={cashPanel?.debtLimitHeadroomPreviousUsd ?? null} />
              </div>
              <div className="text-[10px] text-text-dim">As of {cashPanel?.debtLimitAsOf ?? "—"}</div>
            </div>
          </div>
        </div>

        <div className="gfew-panel p-4" id="us-auction-health">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
            US Treasury Auction Health
          </h3>
          <p className="mb-3 text-xs text-text-dim">
            Latest completed auction per tenor — bid-to-cover (demand relative to size offered) and
            indirect-bidder share (a foreign/overseas-investor demand proxy). 10Y/30Y already tracked by
            the G7 Debt page; the other five tenors are new this pass.
          </p>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-panel-raised text-text-dim">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Tenor</th>
                  <th className="px-2 py-1.5 font-medium">Bid-to-Cover</th>
                  <th className="px-2 py-1.5 font-medium">Indirect %</th>
                  <th className="px-2 py-1.5 font-medium">As Of</th>
                </tr>
              </thead>
              <tbody>
                {auctionPanel.map((t) => (
                  <tr key={t.tenorLabel} className="border-t border-border">
                    <td className="px-2 py-1.5 font-medium">{t.tenorLabel}</td>
                    <td className="gfew-mono px-2 py-1.5">{t.bidToCover !== null ? `${t.bidToCover.toFixed(2)}x` : "—"}</td>
                    <td className="gfew-mono px-2 py-1.5">{fmt(t.indirectPct, "%", 1)}</td>
                    <td className="px-2 py-1.5 text-text-dim">{t.asOf ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="gfew-panel mb-8 p-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
          Crisis Stage (equal-weighted across all 21 tracked Treasuries)
        </h3>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Stages 1-6 come from each country&apos;s own Structural (funding cost/external debt/investor
          base) + Market Access (sovereign CDS) + Contagion (cross-country breadth) blend. Stage 7
          requires a large share of ALL 21 countries to already be at Stage 6+ simultaneously.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TREASURY_STAGES.map((s) => {
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
            Where Treasury Risk Is Building
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
                <div className="ml-5 text-xs text-text-dim">
                  Stage {r.stage} · {r.stageLabel}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Hidden Treasury Risk (structural rising, market still calm)
          </h3>
          {hiddenRisks.length === 0 ? (
            <p className="text-sm text-text-dim">None currently detected across the tracked universe.</p>
          ) : (
            <ul className="space-y-1">
              {hiddenRisks.map((r) => (
                <li key={r.country} className="text-sm">
                  <span className="font-medium">{r.country}</span>{" "}
                  <span className="text-xs text-text-dim">
                    (structural {r.structuralScore}, market access {r.marketAccessScore})
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
                    (market access {r.marketAccessScore}, structural {r.structuralScore})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Treasury Risk — Country Table
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Funding Cost = each country&apos;s own short-term policy/money-market rate, own-history
          trend (18 of 21 — Malaysia/Thailand/Philippines have no free short-rate series found).
          External Debt/Reserves/Foreign Holdings are EM-only (World Bank/IMF, cross-sectional among EM
          peers). Market Access = sovereign CDS, cross-sectional within G7 and EM peer groups
          separately. Structural = Funding Cost 30% + External Debt 35% + Investor Base 35% (G7: Funding
          Cost alone, renormalized). Composite = Structural 40% + Market Access 35% + Contagion 25%.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Funding Cost</th>
                <th className="px-3 py-2 font-medium">Ext. Debt/GNI</th>
                <th className="px-3 py-2 font-medium">ST Debt/Reserves</th>
                <th className="px-3 py-2 font-medium">Reserves (mo)</th>
                <th className="px-3 py-2 font-medium">Foreign Holdings</th>
                <th className="px-3 py-2 font-medium">Sovereign CDS</th>
                <th className="px-3 py-2 font-medium">Structural</th>
                <th className="px-3 py-2 font-medium">Market Access</th>
                <th className="px-3 py-2 font-medium">Contagion</th>
                <th className="px-3 py-2 font-medium">Composite</th>
                <th className="px-3 py-2 font-medium">Regime</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {TREASURY_REGION_ORDER.flatMap((region) => {
                const entries = rows.filter((r) => r.region === region).sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
                if (entries.length === 0) return [];
                return [
                  <tr key={`region-${region}`} className="border-t border-border bg-panel-raised">
                    <td colSpan={14} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                      {region} ({entries.length})
                    </td>
                  </tr>,
                  ...entries.map((r) => (
                    <tr key={r.country} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">{r.country}</td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">
                        {fmt(r.fundingCost.value, "%", 2)}
                        <TrendIndicator value={r.fundingCost.value} previous={r.fundingCost.previousValue} />
                      </td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">
                        {fmt(r.externalDebtToGni.value, "%")}
                        <TrendIndicator value={r.externalDebtToGni.value} previous={r.externalDebtToGni.previousValue} />
                      </td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">
                        {fmt(r.shortTermDebtToReserves.value, "%")}
                        <TrendIndicator value={r.shortTermDebtToReserves.value} previous={r.shortTermDebtToReserves.previousValue} />
                      </td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">
                        {fmt(r.reservesMonths.value, "mo")}
                        <TrendIndicator value={r.reservesMonths.value} previous={r.reservesMonths.previousValue} />
                      </td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">
                        {fmtUsdBn(r.foreignHoldings.value)}
                        <TrendIndicator value={r.foreignHoldings.value} previous={r.foreignHoldings.previousValue} />
                      </td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">
                        {r.sovereignCds.value !== null ? `${Math.round(r.sovereignCds.value)} bps` : "—"}
                        <TrendIndicator value={r.sovereignCds.value} previous={r.sovereignCds.previousValue} />
                      </td>
                      <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.structuralScore) }}>
                        {r.structuralScore ?? "—"}
                      </td>
                      <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.marketAccessScore) }}>
                        {r.marketAccessScore ?? "—"}
                      </td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">{r.contagionScore ?? "—"}</td>
                      <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.compositeScore) }}>
                        {r.compositeScore ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <RegimePill regime={r.regime} />
                      </td>
                      <td className="px-3 py-2">
                        {r.stage !== null ? (
                          <span
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold"
                            style={{ background: `${stageColor(r.stage).fg}22`, color: stageColor(r.stage).fg }}
                            title={TREASURY_STAGES[r.stage - 1]?.description}
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
              {rows.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-6 text-center text-text-dim">
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
          Weights are fixed (Structural 40% / Market Access 35% / Contagion 25% of composite; Funding
          Cost 30% / External Debt 35% / Investor Base 35% of Structural) — shown for the six
          highest-composite countries.
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
                  { label: "Market Access", value: contribution(r.marketAccessScore, COMPOSITE_WEIGHTS.marketAccess), color: "#e0793d" },
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
                    { label: "Funding Cost", value: contribution(r.fundingCostScore, STRUCTURAL_WEIGHTS.fundingCost), color: "#34c085" },
                    { label: "External Debt", value: contribution(r.externalDebtScore, STRUCTURAL_WEIGHTS.externalDebt), color: "#e0b93d" },
                    { label: "Investor Base", value: contribution(r.investorBaseScore, STRUCTURAL_WEIGHTS.investorBase), color: "#8b96a8" },
                  ]}
                />
              </div>
            </div>
          ))}
          {topRisks.length === 0 && <p className="text-sm text-text-dim">No data yet.</p>}
        </div>
      </section>

      <section className="gfew-panel p-4 text-xs text-text-dim">
        <strong className="text-text">Still not built (checked, disclosed rather than faked):</strong>{" "}
        cash-flow forecasting and forecast-error tracking (no government publishes its own internal
        forecast free), non-US Treasury cash/TGA-equivalent balances (Japan/UK/Germany/France/Italy/
        Canada — no free daily source found for any of the six), non-US auction results beyond the US
        (Japan MOF, UK DMO, Germany/France/Italy/Canada checked directly, no stable free endpoint found),
        any debt-maturity-wall breakdown by tenor bucket, contingent liabilities (SOEs, PPP guarantees,
        pension obligations, natural-disaster exposure), primary-dealer capacity, sovereign wealth fund
        tracking, the full stress-test scenario library and historical backtest suite, adaptive
        NORMAL/STRESS/CRISIS regime-weight switching (one fixed weighting is used here), and a daily
        report/AI Q&amp;A layer. See the{" "}
        <a href="/dashboard/methodology#treasury-risk-engine" className="text-accent hover:underline">
          methodology page
        </a>{" "}
        for the complete list.
      </section>
    </div>
  );
}
