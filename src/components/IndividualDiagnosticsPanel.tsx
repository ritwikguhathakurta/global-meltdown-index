import type { IndividualDiagnostics } from "@/lib/engines/individualMeanReversion";
import { ZScoreSpreadChart } from "./ZScoreSpreadChart";

function fmtNum(v: number | null, decimals = 0): string {
  if (v === null || Number.isNaN(v)) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Individual-commodity diagnostics UI — deliberately looks and reads
 * DIFFERENTLY from PairsSpreadPanel (oilseeds/_PairsSpreadPanel.tsx), on
 * purpose. That panel shows a real, tested cointegration relationship
 * (a proven mean-reversion target). This one is for a single price level
 * that a real ADF test confirmed is NOT mean-reverting — so it shows a
 * volatility-scaled "statistical expected range," not a support/resistance
 * level dressed up as more certain than it is, and says so plainly.
 */
export function IndividualDiagnosticsPanel({ data }: { data: IndividualDiagnostics }) {
  const { config } = data;
  const zColor = (z: number) => (z >= 0 ? "#34c085" : "#e05a4d");

  return (
    <>
      <p className="mb-3 max-w-3xl text-sm text-text-dim">
        A real Augmented Dickey-Fuller unit-root test (via OpenBB&apos;s econometrics extension/statsmodels, run
        locally on {config.testedOn}) on {config.label}&apos;s own price history: the raw price level is{" "}
        <strong className="text-text">non-stationary</strong> (ADF stat {config.adfLevel.stat.toFixed(2)}, p ={" "}
        {config.adfLevel.pValue.toFixed(2)}, n = {config.adfLevel.sampleSize}) — there is no fixed price this
        commodity&apos;s own history statistically pulls back toward, unlike the cointegrated pairs above. Its{" "}
        <strong className="text-text">returns</strong> (period-over-period % changes) ARE stationary (ADF stat{" "}
        {config.adfReturns.stat.toFixed(2)}, p = {config.adfReturns.pValue.toExponential(1)}, n ={" "}
        {config.adfReturns.sampleSize}) — the standard basis for the two tools below, which measure short-term
        stretch and statistical range, not a proven long-run price target.
      </p>

      {data.zScore !== null && (
        <div className="gfew-panel mb-4 p-4">
          <div className="mb-1 flex flex-wrap items-baseline gap-3">
            <span className="gfew-mono text-2xl font-semibold" style={{ color: zColor(data.zScore) }}>
              {data.zScore >= 0 ? "+" : ""}
              {data.zScore.toFixed(2)}σ
            </span>
            <span className="text-xs text-text-dim">
              vs. its own trailing {config.maWindow}-{config.frequency === "daily" ? "day" : "month"} average · as of{" "}
              {data.latestDate?.slice(0, 10) ?? "—"}
            </span>
          </div>
          <div className="mb-3 text-sm font-semibold" style={{ color: zColor(data.zScore) }}>
            {data.interpretation}
          </div>
          <div className="mb-4 grid grid-cols-3 gap-3 text-xs text-text-dim">
            <div>
              <div className="uppercase tracking-wide">Current Price</div>
              <div className="gfew-mono font-semibold text-text">
                {fmtNum(data.price, data.price !== null && data.price >= 100 ? 0 : 2)} {config.unit}
              </div>
            </div>
            <div>
              <div className="uppercase tracking-wide">
                {config.maWindow}-{config.frequency === "daily" ? "Day" : "Month"} Average
              </div>
              <div className="gfew-mono font-semibold text-text">
                {fmtNum(data.movingAverage, data.movingAverage !== null && data.movingAverage >= 100 ? 0 : 2)} {config.unit}
              </div>
            </div>
            <div>
              <div className="uppercase tracking-wide">{config.frequency === "daily" ? "Daily" : "Monthly"} Volatility</div>
              <div className="gfew-mono font-semibold text-text">{data.sigma !== null ? `${(data.sigma * 100).toFixed(2)}%` : "—"}</div>
            </div>
          </div>
          <ZScoreSpreadChart points={data.zScoreHistory} aLabel={config.label} bLabel="its own trend" />
        </div>
      )}

      {data.bands.length > 0 && (
        <div className="gfew-panel mb-4 p-4">
          <h3 className="mb-1 text-sm font-semibold">Statistical Expected Range (Not Support/Resistance)</h3>
          <p className="mb-3 text-xs text-text-dim">
            Since {config.label}&apos;s price level does not statistically mean-revert (confirmed above), there is no
            valid &ldquo;fair value&rdquo; to anchor a support/resistance band to. This is instead a volatility-based
            projection — the same random-walk/&radic;time logic an options desk uses for an &ldquo;expected
            move&rdquo; — from the real measured volatility above. It widens with the horizon because uncertainty
            genuinely grows the further out you project; it is not a claim about direction.
          </p>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel-raised text-text-dim">
                <tr>
                  <th className="px-3 py-2 font-medium">Horizon</th>
                  <th className="px-3 py-2 font-medium">Typical Range (~68%)</th>
                  <th className="px-3 py-2 font-medium">Wide Range (~95%)</th>
                </tr>
              </thead>
              <tbody>
                {data.bands.map((b) => (
                  <tr key={b.periods} className="border-t border-border align-top">
                    <td className="px-3 py-2 text-text-dim">{b.bucketLabel}</td>
                    <td className="gfew-mono px-3 py-2 font-semibold text-text">
                      {fmtNum(b.lo1)} – {fmtNum(b.hi1)} {config.unit}
                    </td>
                    <td className="gfew-mono px-3 py-2 text-text-dim">
                      {fmtNum(b.lo2)} – {fmtNum(b.hi2)} {config.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.reversionStats.length > 0 && (
        <div className="gfew-panel mb-4 p-4">
          <h3 className="mb-2 text-sm font-semibold">Short-Term Stretch: Does It Actually Snap Back?</h3>
          <p className="mb-3 text-xs text-text-dim">
            A real empirical check, not a theoretical claim: every time {config.label}&apos;s price was stretched
            &ge;1σ from its own trailing {config.maWindow}-{config.frequency === "daily" ? "day" : "month"} average,
            how often had that gap narrowed a few periods later, historically? Small samples for a{" "}
            {config.frequency} series with limited history — read as directional evidence, not a precise
            probability.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {data.reversionStats.map((r) => (
              <div key={r.horizonPeriods} className="rounded border border-border p-3 text-center">
                <div className="mb-1 text-xs font-semibold text-text">
                  +{r.horizonPeriods} {config.frequency === "daily" ? "trading day" : "month"}
                  {r.horizonPeriods === 1 ? "" : "s"}
                </div>
                <div className="gfew-mono text-lg font-semibold text-text">{r.revertedPct !== null ? `${r.revertedPct}%` : "—"}</div>
                <div className="text-[9px] text-text-dim">reverted (n={r.sampleSize})</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-text-dim">
        No &ldquo;probable turnaround price&rdquo; is shown for {config.label} on its own, deliberately — a real
        statistical test (above) found no fixed level this price mean-reverts to, so inventing one would misstate
        confidence this app&apos;s own testing doesn&apos;t support. The cointegrated pairs sections do have a real,
        tested turnaround anchor, because a spread between two commodities can be — and was — tested for that;
        a single commodity&apos;s own price level, tested the same way, was not. Nothing here is investment advice.
      </p>
    </>
  );
}
