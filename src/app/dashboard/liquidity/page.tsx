import { getLatestEngine, getCentralBankLiquidityTable } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import type { LiquidityRegimeLabel, MomentumLabel, ForecastCell } from "@/lib/engines/liquidityRegime";

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

export default async function LiquidityPage() {
  const [rows, bankTable] = await Promise.all([getLatestEngine("global_liquidity"), getCentralBankLiquidityTable()]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Global Liquidity (G7 + China)</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-dim">
        Fed, ECB (Germany/France/Italy), BOJ, BoE and BoC balance-sheet/reserve measures, plus China&apos;s
        3-month interbank rate as a rate-side liquidity proxy (no free, verified PBOC balance-sheet series
        was found) — see the methodology page for the full sourcing detail on each.
      </p>

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
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{r.balanceSheetAsOf ?? "—"}</td>
                  <td className="px-3 py-2 text-text-dim">{r.basisLabel}</td>
                  <td className="gfew-mono px-3 py-2">{fmt(r.basisValue, r.basisUnit)}</td>
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
