/**
 * Generic tick-over-tick trend arrow + magnitude for any live-feed numeric
 * value — purely directional (increasing / decreasing / unchanged vs. the
 * previous reading of the same series), never a good/bad judgment.
 * Deliberately NOT green/red like RiskBadge or DirectionArrow: whether "up"
 * is good or bad depends on the metric (a rising credit spread is bad, a
 * rising FX rate is neutral), so this uses a neutral accent/orange pair
 * instead of implying sentiment. Renders nothing when either reading is
 * unavailable — "no comparison possible" is not the same as "flat".
 *
 * The magnitude is shown as a % change relative to the previous reading
 * (unit-agnostic — the underlying value might be %, bps, an index level, or
 * a raw USD amount, so a relative move is the one figure that's always
 * comparable) rather than the raw point difference, which the caller's own
 * unit label already contextualizes on hover via the title tooltip.
 *
 * Every new engine/table added to this app should route its live-value
 * cells through this component (or the previousOf() helper in
 * lib/metrics/stats.ts that feeds it) rather than rendering a bare number.
 */
function formatPct(pct: number): string {
  const abs = Math.abs(pct);
  const decimals = abs < 10 ? 2 : abs < 100 ? 1 : 0;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(decimals)}%`;
}

export function TrendIndicator({ value, previous }: { value: number | null; previous?: number | null }) {
  // Loose null check: rows written before `previousValue` existed in the
  // JSONB indicator payload come back as `undefined`, not `null`, until the
  // next pipeline run overwrites them — both mean "no comparison possible".
  if (value == null || previous == null) return null;
  const diff = value - previous;
  const scale = Math.max(Math.abs(value), Math.abs(previous), 1e-9);
  if (Math.abs(diff) / scale < 1e-6) {
    return (
      <span className="ml-1 text-[11px] text-text-dim" title={`Unchanged vs previous reading (${previous})`} aria-label="flat">
        – 0.0%
      </span>
    );
  }
  // previous === 0 makes a relative % change undefined (division by zero) —
  // falls back to just the arrow rather than an Infinity/NaN reading.
  const pct = previous !== 0 ? (diff / Math.abs(previous)) * 100 : null;
  const color = diff > 0 ? "#3fa9f5" : "#e08a3d";
  return (
    <span
      className="ml-1 text-[11px] font-medium"
      style={{ color }}
      title={`${diff > 0 ? "Up" : "Down"} from ${previous} to ${value}`}
      aria-label={diff > 0 ? "increasing" : "decreasing"}
    >
      {diff > 0 ? "▲" : "▼"} {pct !== null ? formatPct(pct) : ""}
    </span>
  );
}
