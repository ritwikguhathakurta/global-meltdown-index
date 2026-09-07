import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import type { IndicatorRow } from "@/lib/api/types";

function findValue(rows: IndicatorRow[], key: string): number | null {
  return rows.find((r) => r.key === key)?.value ?? null;
}

function guidanceParagraph(leading: IndicatorRow[], coincident: IndicatorRow[]): string {
  const all = [...leading, ...coincident];
  const shortY = findValue(all, "india.tbill_364d");
  const mediumY = findValue(all, "india.gsec_medium_yield");
  const longY = findValue(all, "india.gsec_10y");
  const frontSpread = findValue(all, "india.curve_short_medium_spread");
  const backSpread = findValue(all, "india.curve_medium_long_spread");
  const invSpread = findValue(all, "india.curve_1y10y_spread");

  if (shortY === null && longY === null) {
    return "Not enough live data yet to describe the current curve shape — trigger a pipeline run from /admin, or check back once RBI's next T-Bill/G-Sec auction has been ingested.";
  }

  const parts: string[] = [];
  parts.push(
    `Latest readings: 1Y T-Bill ${shortY ?? "—"}%, ~5Y G-Sec ${mediumY ?? "—"}% (most recent auction in that bucket), 10Y ${longY ?? "—"}%.`
  );
  if (invSpread !== null) {
    parts.push(
      invSpread < 0
        ? `The 1Y-10Y spread is NEGATIVE (${invSpread.toFixed(0)} bps) — the curve is currently inverted, historically a signal of aggressive policy tightening relative to growth expectations or acute short-end funding stress.`
        : `The 1Y-10Y spread is ${invSpread.toFixed(0)} bps (positive/normal, not inverted).`
    );
  }
  if (frontSpread !== null && backSpread !== null) {
    const steeperEnd = Math.abs(frontSpread) > Math.abs(backSpread) ? "front end (1Y-5Y)" : "back end (5Y-10Y+)";
    parts.push(
      `Front-end (1Y-5Y) spread: ${frontSpread.toFixed(0)} bps; back-end (5Y-10Y+) spread: ${backSpread.toFixed(0)} bps — the curve is currently steeper at the ${steeperEnd}.`
    );
  } else if (frontSpread !== null) {
    parts.push(`Front-end (1Y-5Y) spread: ${frontSpread.toFixed(0)} bps (no recent long-bucket G-Sec auction to compare against the back end).`);
  } else if (backSpread !== null) {
    parts.push(`Back-end (5Y-10Y+) spread: ${backSpread.toFixed(0)} bps (no recent medium-bucket G-Sec auction to compare against the front end).`);
  }
  return parts.join(" ");
}

export default async function IndiaYieldCurvePage() {
  const rows = await getLatestEngine("india_yield_curve");
  const guidance = rows[0] ? guidanceParagraph(rows[0].leading_indicators, rows[0].coincident_indicators) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">India Yield Curve</h1>
      <p className="mb-4 max-w-2xl text-sm text-text-dim">
        Short (T-Bill), medium (~5Y G-Sec) and long (10Y) sovereign yields, plus derived spreads reading
        inversion risk and whether the curve is steepening at the front or back end — built from RBI&apos;s
        own primary-auction results, since CCIL&apos;s Terms of Use rule out an automated feed of its
        secondary-market curve (see Methodology).
      </p>
      {guidance && (
        <div className="gfew-panel mb-6 max-w-3xl p-4 text-sm text-text-dim">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-dim">Current Read</span>
          {guidance}
        </div>
      )}
      <EngineDetail title="India Yield Curve" rows={rows} />
    </div>
  );
}
