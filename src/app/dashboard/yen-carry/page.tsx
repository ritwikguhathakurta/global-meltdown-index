import { getLatestEngine, getCarryTradeTable } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import { CARRY_STAGES } from "@/lib/engines/carryTrade";
import type { CarryPairRow } from "@/lib/engines/carryTrade";
import { gfmiColor } from "@/components/RegimeBadge";
import { TrendIndicator } from "@/components/TrendIndicator";

function fmtPct(v: number | null, decimals = 2): string {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

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

const VOL_REGIME_LABEL: Record<string, string> = {
  VERY_LOW: "Very Low", LOW: "Low", NORMAL: "Normal", ELEVATED: "Elevated", HIGH: "High", CRISIS: "Crisis",
};

export default async function GlobalCarryTradePage() {
  const [yenCarryRows, { pairs, funding, composite }] = await Promise.all([
    getLatestEngine("yen_carry"),
    getCarryTradeTable(),
  ]);

  const ranked = [...pairs].sort((a, b) => (b.fragilityScore ?? -1) - (a.fragilityScore ?? -1));
  const topRisks = ranked.filter((p) => p.fragilityScore !== null).slice(0, 6);
  const carryTraps = pairs.filter((p) => p.isCarryTrap);
  const unwindAlerts = pairs.filter((p) => p.unwindFlag);

  const yenComposite = yenCarryRows.find((r) => r.horizon === "short") ?? yenCarryRows[0] ?? null;

  function pairLabel(p: CarryPairRow): string {
    return `${p.fundingCode}-funded ${p.targetCode}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Global Carry Trade Risk</h1>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        Funding-currency, positioning, volatility and fragility tracking across 4 low-yield funding
        currencies (JPY, CHF, EUR, USD) and 17 target currencies. The GFMI-weighted composite below
        was itself broadened to track all four funding currencies&apos; own stretched-ness and
        positioning (previously JPY-only); the fuller 4x17 pair-level breakdown further down is a
        separate analytical layer that does not add a second vote to GFMI. See the methodology page
        for exactly what each layer does and doesn&apos;t cover.
      </p>

      {yenComposite && (
        <section className="gfew-panel mb-6 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Carry Trade Stress — JPY/CHF/EUR/USD (feeds GFMI)
          </h3>
          <div className="flex items-baseline gap-3">
            <span className="gfew-mono text-3xl font-bold" style={{ color: scoreColor(yenComposite.score) }}>
              {yenComposite.score ?? "—"}
            </span>
            <span className="text-sm uppercase tracking-wide text-text-dim">{yenComposite.regime}</span>
          </div>
        </section>
      )}

      <section className="gfew-panel mb-8 p-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
          Crisis Stage (equal-weighted across all tracked pairs)
        </h3>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Stages 1-4 come from the average Carry Fragility score across every funding/target pair
          with data. Stage 5+ requires a genuinely detected funding-currency reversal combined with
          already-elevated volatility (see methodology) — never assigned from the fragility score
          alone. Stage 7 requires a large share of ALL pairs to already be at Stage 5+ simultaneously.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CARRY_STAGES.map((s) => {
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
            Where Carry Risk Is Highest
          </h3>
          {topRisks.length === 0 && <p className="text-sm text-text-dim">No data yet.</p>}
          <ol className="space-y-2">
            {topRisks.map((p, i) => (
              <li key={`${p.fundingKey}-${p.targetKey}`} className="text-sm">
                <span className="gfew-mono mr-2 text-text-dim">{i + 1}.</span>
                <span className="font-medium">{pairLabel(p)}</span>{" "}
                <span className="gfew-mono" style={{ color: scoreColor(p.fragilityScore) }}>
                  {p.fragilityScore}
                </span>
                <div className="ml-5 text-xs text-text-dim">Stage {p.stage} · {p.stageLabel}</div>
              </li>
            ))}
          </ol>
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Carry Trap (attractive carry + crowded + unusually calm)
          </h3>
          {carryTraps.length === 0 ? (
            <p className="text-sm text-text-dim">None currently detected across the tracked universe.</p>
          ) : (
            <ul className="space-y-1">
              {carryTraps.map((p) => (
                <li key={`${p.fundingKey}-${p.targetKey}`} className="text-sm">
                  <span className="font-medium">{pairLabel(p)}</span>{" "}
                  <span className="text-xs text-text-dim">
                    (carry {fmtPct(p.rateDifferential)}, crowding {p.crowdingScore})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Unwind Alert (funding currency reversing + volatility rising)
          </h3>
          {unwindAlerts.length === 0 ? (
            <p className="text-sm text-text-dim">None currently — no pair shows the funding-reversal + volatility-rise combination.</p>
          ) : (
            <ul className="space-y-1">
              {unwindAlerts.map((p) => (
                <li key={`${p.fundingKey}-${p.targetKey}`} className="text-sm">
                  <span className="font-medium">{pairLabel(p)}</span>{" "}
                  <span className="text-xs text-text-dim">
                    {p.severeUnwindFlag ? "(carry already underwater)" : "(reversal beginning)"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Funding Currency Panel
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Funding Cost Score is a cross-sectional reading among just these four currencies — the
          lowest-rate currency scores highest (most attractive to borrow). FX trend and volatility
          are each currency&apos;s own trend vs USD (DXY for USD itself, since it has no
          currency-vs-USD pair of its own).
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Currency</th>
                <th className="px-3 py-2 font-medium">Rate</th>
                <th className="px-3 py-2 font-medium">FX Trend (1Y)</th>
                <th className="px-3 py-2 font-medium">Realized Vol</th>
                <th className="px-3 py-2 font-medium">Vol Regime</th>
                <th className="px-3 py-2 font-medium">Net Position (% OI)</th>
                <th className="px-3 py-2 font-medium">Position %ile</th>
                <th className="px-3 py-2 font-medium">Funding Cost Score</th>
              </tr>
            </thead>
            <tbody>
              {funding.map((f) => (
                <tr key={f.key} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">{f.name} ({f.code})</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {fmt(f.rate, "%")}
                    <TrendIndicator value={f.rate} previous={f.ratePrevious} />
                    <div className="text-[10px]">{f.rateLabel}</div>
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {fmtPct(f.fxTrend1yPct, 1)}
                    <div className="text-[10px]">{f.fxTrendLabel}</div>
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(f.realizedVol, "%", 1)}</td>
                  <td className="px-3 py-2 text-text-dim">{f.volRegime ? VOL_REGIME_LABEL[f.volRegime] : "—"}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{f.netPositionPctOi !== null ? fmt(f.netPositionPctOi, "%", 1) : "—"}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{f.positionPercentile ?? "—"}</td>
                  <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(f.fundingCostScore) }}>
                    {f.fundingCostScore ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Carry Heatmap
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Each cell shows the realized carry return (rate differential + FX return, trailing ~1Y,
          uncovered — no forward/hedging cost adjustment) for that funding/target pair, colored by
          its Carry Fragility score. Hover a cell for its crisis stage. THB, MYR and PHP have no free
          live interest-rate source (checked directly — disclosed on the methodology page), so their
          cells show FX return alone, marked with <span className="gfew-mono">≈</span> — real,
          live data, just not the full rate-plus-FX carry figure the other columns show.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-center text-xs">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Funding \ Target</th>
                {ranked.length > 0 &&
                  [...new Map(pairs.map((p) => [p.targetKey, p.targetCode])).entries()].map(([key, code]) => (
                    <th key={key} className="px-2 py-2 font-medium">{code}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {[...new Map(pairs.map((p) => [p.fundingKey, { code: p.fundingCode }])).entries()].map(([fundingKey, f]) => (
                <tr key={fundingKey} className="border-t border-border">
                  <td className="px-2 py-2 text-left font-medium">{f.code}</td>
                  {[...new Map(pairs.map((p) => [p.targetKey, p.targetCode])).entries()].map(([targetKey]) => {
                    const cell = pairs.find((p) => p.fundingKey === fundingKey && p.targetKey === targetKey);
                    const color = cell ? scoreColor(cell.fragilityScore) : "#5a6472";
                    const hasFullCarry = cell?.realizedCarryReturn1y !== null && cell?.realizedCarryReturn1y !== undefined;
                    const displayValue = cell
                      ? hasFullCarry
                        ? fmtPct(cell.realizedCarryReturn1y, 1)
                        : cell.fxReturn1y !== null
                          ? `≈${fmtPct(cell.fxReturn1y, 1)}`
                          : "—"
                      : "—";
                    const tooltip = cell
                      ? `Stage ${cell.stage ?? "—"} · ${cell.stageLabel}${hasFullCarry ? "" : " — no live rate source for this currency; figure is FX return only"}`
                      : "No data";
                    return (
                      <td key={targetKey} className="gfew-mono px-2 py-2" style={{ color }} title={tooltip}>
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          All Tracked Pairs
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Rate Differential = target rate minus funding rate (% p.a.). FX Return = trailing ~1Y
          realized return from holding the target currency funded in the funding currency. Carry/Vol
          = Rate Differential divided by the pair&apos;s realized volatility (spec&apos;s
          &ldquo;Carry Risk-Adjusted Return&rdquo;, deliberately not called a Sharpe ratio — no
          risk-free adjustment is applied). Break-even = the funding currency appreciation that would
          erase about 12 months of carry. Crowding is the percentile of how stretched CFTC
          positioning is, where a reporting futures contract exists for that currency.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Pair</th>
                <th className="px-3 py-2 font-medium">Rate Diff.</th>
                <th className="px-3 py-2 font-medium">FX Return (1Y)</th>
                <th className="px-3 py-2 font-medium">Realized Carry (1Y)</th>
                <th className="px-3 py-2 font-medium">Vol Regime</th>
                <th className="px-3 py-2 font-medium">Carry/Vol</th>
                <th className="px-3 py-2 font-medium">Break-Even</th>
                <th className="px-3 py-2 font-medium">Crowding</th>
                <th className="px-3 py-2 font-medium">Fragility</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p) => (
                <tr key={`${p.fundingKey}-${p.targetKey}`} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{pairLabel(p)}</div>
                    {p.isCarryTrap && (
                      <span className="mt-1 inline-block rounded bg-[#3d2f1d] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#e0b93d]">
                        Carry Trap
                      </span>
                    )}
                    {p.unwindFlag && (
                      <span className="mt-1 ml-1 inline-block rounded bg-[#3d1d1d] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#e05a4d]">
                        Unwinding
                      </span>
                    )}
                    {p.rateCaveat && <div className="mt-1 text-[10px] text-text-dim">{p.rateCaveat}</div>}
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {fmtPct(p.rateDifferential)}
                    <TrendIndicator value={p.rateDifferential} previous={p.rateDifferentialPrevious} />
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmtPct(p.fxReturn1y)}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmtPct(p.realizedCarryReturn1y)}</td>
                  <td className="px-3 py-2 text-text-dim">{p.volRegime ? VOL_REGIME_LABEL[p.volRegime] : "—"}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{p.carryVolRatio ?? "—"}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmtPct(p.breakEvenMovePct)}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{p.crowdingScore ?? "—"}</td>
                  <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(p.fragilityScore) }}>
                    {p.fragilityScore ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {p.stage !== null ? (
                      <span
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold"
                        style={{ background: `${stageColor(p.stage).fg}22`, color: stageColor(p.stage).fg }}
                        title={CARRY_STAGES[p.stage - 1]?.description}
                      >
                        {p.stage} · {p.stageLabel}
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-dim">{Math.round(p.dataCompleteness * 100)}%</td>
                </tr>
              ))}
              {pairs.length === 0 && (
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

      <EngineDetail title="Carry Trade Stress — JPY/CHF/EUR/USD (feeds GFMI)" rows={yenCarryRows} />
    </div>
  );
}
