import type { PairConfig, CointegratedPairSpread } from "@/lib/engines/oilseedsPairsCointegration";
import { ZScoreSpreadChart } from "@/components/ZScoreSpreadChart";
import { fmt } from "../_components";

/**
 * Shared UI for a cointegrated pairs spread — used for both Soybean Oil /
 * Palm Oil (a strong, tradeable-horizon relationship) and Palm Oil / WTI
 * Crude Oil (a real but much weaker, decade-scale biodiesel-linkage
 * relationship). The panel adapts its language to config.strength rather
 * than presenting both with the same tradeable-horizon framing — a slow,
 * weak relationship dressed up with the same "medium term" language as a
 * fast, strong one would overstate what the weaker pair actually supports.
 */
export function PairsSpreadPanel({
  data,
  config,
  aUnit,
  bUnit,
}: {
  data: CointegratedPairSpread;
  config: PairConfig;
  aUnit: string;
  bUnit: string;
}) {
  const zColor = (z: number) => (z >= 0 ? "#34c085" : "#e05a4d");
  const isWeak = config.strength === "weak";

  return (
    <>
      <p className="mb-3 max-w-3xl text-sm text-text-dim">
        {config.aLabel} and {config.bLabel} prices are individually non-stationary but genuinely{" "}
        <strong className="text-text">cointegrated</strong> — verified via a real Engle-Granger test (ADF p ={" "}
        {config.adfPValue.toExponential(1)}, n = {config.sampleSize}, computed locally via OpenBB&apos;s econometrics
        extension/statsmodels, {config.estimationWindow}). The fitted long-run relationship is{" "}
        <span className="gfew-mono text-text">
          {config.aLabel.toLowerCase().replace(/ /g, "_")}_price ≈ {config.intercept.toFixed(1)} + {config.gamma.toFixed(3)} ×{" "}
          {config.bLabel.toLowerCase().replace(/ /g, "_")}_price
        </span>{" "}
        — the hedge ratio, not an assumed 1:1.{" "}
        {isWeak ? (
          <>
            Unlike the soybean oil/palm oil pair, this link is <strong className="text-text">much weaker and far slower</strong>:
            the fitted error-correction speed implies a spread half-life of roughly{" "}
            <strong className="text-text">{Math.round(config.halfLifeMonths / 12)} years</strong>, not months — this reflects an
            indirect biodiesel-demand linkage between an agricultural commodity and an energy commodity, not a direct
            substitute-good relationship.
          </>
        ) : (
          <>
            The gap between the actual and fitted price has historically closed with an estimated half-life of ~
            {config.halfLifeMonths} months.
          </>
        )}{" "}
        The hedge ratio/intercept are a fixed constant from that one-time test, not re-fit on every page load (this app has no
        Python/statsmodels runtime in production) — the z-score and chart below DO update automatically every time new price
        data lands, since that part is plain arithmetic against the live price series already in this app&apos;s own database.
      </p>

      {data.zScore5y !== null && (
        <div className="gfew-panel mb-4 p-4">
          <div className="mb-1 flex flex-wrap items-baseline gap-3">
            <span className="gfew-mono text-2xl font-semibold" style={{ color: zColor(data.zScore5y) }}>
              {data.zScore5y >= 0 ? "+" : ""}
              {data.zScore5y.toFixed(2)}σ
            </span>
            <span className="text-xs text-text-dim">trailing 5-year window · as of {data.latestDate?.slice(0, 7) ?? "—"}</span>
          </div>
          <div className="mb-3 text-sm font-semibold" style={{ color: zColor(data.zScore5y) }}>
            {data.interpretation}
          </div>
          <div className="mb-4 grid grid-cols-3 gap-3 text-xs text-text-dim">
            <div>
              <div className="uppercase tracking-wide">{config.aLabel}</div>
              <div className="gfew-mono font-semibold text-text">
                {fmt(data.aPrice, 0)} {aUnit}
              </div>
            </div>
            <div>
              <div className="uppercase tracking-wide">{config.bLabel}</div>
              <div className="gfew-mono font-semibold text-text">
                {fmt(data.bPrice, 0)} {bUnit}
              </div>
            </div>
            <div>
              <div className="uppercase tracking-wide">Residual Spread</div>
              <div className="gfew-mono font-semibold text-text">
                {data.spread !== null && data.spread >= 0 ? "+" : ""}
                {fmt(data.spread, 0)}
              </div>
            </div>
          </div>
          <ZScoreSpreadChart points={data.zScoreHistory} aLabel={config.aLabel} bLabel={config.bLabel} />
        </div>
      )}

      {data.priceBands.length > 0 && (
        <div className="gfew-panel mb-4 p-4">
          <h3 className="mb-1 text-sm font-semibold">Statistical Support / Resistance Bands</h3>
          <p className="mb-3 text-xs text-text-dim">
            Not chart-based technical support/resistance (no order-flow or trendline analysis here) — these are the{" "}
            {config.aLabel} prices implied by the mean-reversion model at each z-score level, holding today&apos;s{" "}
            {config.bLabel} price ({fmt(data.bPrice, 0)} {bUnit}) <strong className="text-text">fixed</strong>. If{" "}
            {config.bLabel}&apos;s own price moves, every level below shifts with it — this is a relative-value model
            between the two, not an absolute forecast for either one alone.
          </p>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-raised text-text-dim">
                <tr>
                  <th className="px-3 py-2 font-medium">Level</th>
                  <th className="px-3 py-2 font-medium">Meaning</th>
                  <th className="px-3 py-2 font-medium">{config.aLabel} Price</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { z: 2 as const, label: 'Extreme rich ("resistance")' },
                  { z: 1 as const, label: 'Rich ("resistance-like")' },
                  { z: 0 as const, label: "Fair value — most probable turnaround anchor" },
                  { z: -1 as const, label: 'Cheap ("support-like")' },
                  { z: -2 as const, label: 'Extreme cheap ("support")' },
                ].map((row) => {
                  const band = data.priceBands.find((b) => b.z === row.z);
                  const isCurrent = data.zScore5y !== null && Math.abs(data.zScore5y - row.z) < 0.5;
                  return (
                    <tr key={row.z} className={`border-t border-border align-top ${isCurrent ? "bg-panel-raised" : ""}`}>
                      <td className="gfew-mono px-3 py-2 font-semibold text-text-dim">{row.z > 0 ? `+${row.z}` : row.z}σ</td>
                      <td className="px-3 py-2 text-text-dim">{row.label}</td>
                      <td className="gfew-mono px-3 py-2 font-semibold text-text">{band ? `${fmt(band.price, 0)} ${aUnit}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-text-dim">
            Current actual {config.aLabel} price: {fmt(data.aPrice, 0)} {aUnit} — compare against the table above to see how
            stretched today&apos;s price is versus its own trailing 5-year history.
          </p>
        </div>
      )}

      {data.reversionStats.length > 0 && (
        <div className="gfew-panel mb-4 p-4">
          <h3 className="mb-2 text-sm font-semibold">What This Suggests, In Plain Terms</h3>
          <p className="mb-3 text-xs text-text-dim">
            Based on every historical month since {config.estimationWindow.slice(0, 7)} where this spread was similarly
            stretched (|z| ≥ 1σ) — a plain historical frequency, not a fitted model. These are overlapping monthly readings,
            not independent events, so treat the percentages as directional evidence, not precise probabilities.
          </p>
          {isWeak ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                {data.reversionStats.map((r) => (
                  <div key={r.horizonMonths} className="rounded border border-border p-3 text-center">
                    <div className="mb-1 text-xs font-semibold text-text">{r.horizonMonths}mo</div>
                    <div className="gfew-mono text-lg font-semibold text-text">{r.revertedPct !== null ? `${r.revertedPct}%` : "—"}</div>
                    <div className="text-[9px] text-text-dim">n={r.sampleSize}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-text-dim">
                Read these together with the ~{Math.round(config.halfLifeMonths / 12)}-year half-life above: a stretched
                reading does often nudge back toward normal at some point within a few years, but the <em>size</em> of that
                correction per month is small — this is a slow-moving structural/macro relationship (palm oil&apos;s growing
                linkage to energy markets via biodiesel demand), not something actionable on a monthly-to-annual trading
                horizon the way the soybean oil/palm oil pair is. Short-, medium-, and long-term framing (as used for that
                pair) doesn&apos;t meaningfully apply here — even &ldquo;long term&rdquo; (12 months) is a small fraction of
                this relationship&apos;s own timescale.
              </p>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  title: "Short Term (next ~1-3 months)",
                  stat: data.reversionStats.find((r) => r.horizonMonths === 3),
                  text: `Don't expect a quick snap-back. The fitted half-life is ~${config.halfLifeMonths} months, so most of the historical adjustment hadn't happened yet by this point. Short-term price action here is more likely driven by weather, biodiesel-policy news, or FX than by this spread alone — this isn't a this-week timing signal.`,
                },
                {
                  title: "Medium Term (~3-6 months)",
                  stat: data.reversionStats.find((r) => r.horizonMonths === 6),
                  text: "This is the horizon the model is actually built for — it sits closest to the measured half-life. If the historical pattern holds, expect the gap to have narrowed somewhat by here, whether through one side easing, the other catching up, or both moving toward each other.",
                },
                {
                  title: "Long Term (~12 months)",
                  stat: data.reversionStats.find((r) => r.horizonMonths === 12),
                  text: "The historical reversion rate looks strongest by 12 months out, but by then other forces (policy, weather shocks, trade flows) matter more than this specific spread. Treat this as background context for a relative-value view, not a 12-month price target.",
                },
              ].map((h) => (
                <div key={h.title} className="rounded border border-border p-3">
                  <div className="mb-1 text-xs font-semibold text-text">{h.title}</div>
                  {h.stat && h.stat.revertedPct !== null && (
                    <div className="gfew-mono mb-2 text-lg font-semibold text-text">
                      {h.stat.revertedPct}% <span className="text-[10px] font-normal text-text-dim">reverted historically (n={h.stat.sampleSize} overlapping months)</span>
                    </div>
                  )}
                  <p className="text-[11px] text-text-dim">{h.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-text-dim">
        This is a real, tested statistical relationship, not a trading system — no backtest of P&amp;L, transaction costs,
        or slippage has been run on it, and a structural break (a biofuel mandate change, an export ban) can break the
        fitted relationship going forward with no warning from the test itself. Color is sign-only, matching this
        dashboard&apos;s convention everywhere else, not a buy/sell recommendation — nothing on this page is investment
        advice.
      </p>
    </>
  );
}
