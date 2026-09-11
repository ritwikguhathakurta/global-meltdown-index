/**
 * Generic tick-over-tick trend arrow for any live-feed numeric value — purely
 * directional (increasing / decreasing / unchanged vs. the previous reading
 * of the same series), never a good/bad judgment. Deliberately NOT
 * green/red like RiskBadge or DirectionArrow: whether "up" is good or bad
 * depends on the metric (a rising credit spread is bad, a rising FX rate is
 * neutral), so this uses a neutral accent/orange pair instead of implying
 * sentiment. Renders nothing when either reading is unavailable — "no
 * comparison possible" is not the same as "flat".
 *
 * Every new engine/table added to this app should route its live-value
 * cells through this component (or the previousOf() helper in
 * lib/metrics/stats.ts that feeds it) rather than rendering a bare number.
 */
export function TrendIndicator({ value, previous }: { value: number | null; previous?: number | null }) {
  // Loose null check: rows written before `previousValue` existed in the
  // JSONB indicator payload come back as `undefined`, not `null`, until the
  // next pipeline run overwrites them — both mean "no comparison possible".
  if (value == null || previous == null) return null;
  const scale = Math.max(Math.abs(value), Math.abs(previous), 1e-9);
  const diff = value - previous;
  if (Math.abs(diff) / scale < 1e-6) {
    return (
      <span className="ml-1 text-text-dim" title={`Unchanged vs previous reading (${previous})`} aria-label="flat">
        –
      </span>
    );
  }
  if (diff > 0) {
    return (
      <span className="ml-1" style={{ color: "#3fa9f5" }} title={`Up from ${previous}`} aria-label="increasing">
        ▲
      </span>
    );
  }
  return (
    <span className="ml-1" style={{ color: "#e08a3d" }} title={`Down from ${previous}`} aria-label="decreasing">
      ▼
    </span>
  );
}
