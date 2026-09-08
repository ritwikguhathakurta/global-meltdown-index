const GFMI_COLORS: [number, string, string][] = [
  [15, "#1d3d2f", "#34c085"],
  [30, "#1d3d2f", "#34c085"],
  [45, "#3d3a1d", "#e0b93d"],
  [60, "#3d2f1d", "#e08a3d"],
  [75, "#3d1d1d", "#e05a4d"],
  [90, "#3d1414", "#a83226"],
  [101, "#2a0d0d", "#ff4d4d"],
];

export function gfmiColor(score: number | null): { bg: string; fg: string } {
  if (score === null) return { bg: "#1a1f28", fg: "#8b96a8" };
  for (const [ceiling, bg, fg] of GFMI_COLORS) {
    if (score < ceiling) return { bg, fg };
  }
  return { bg: "#2a0d0d", fg: "#ff4d4d" };
}

export function RiskBadge({ score, label }: { score: number | null; label?: string }) {
  const { bg, fg } = gfmiColor(score);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold gfew-mono"
      style={{ background: bg, color: fg }}
    >
      {score === null ? "N/A" : score}
      {label ? <span className="font-normal opacity-80">{label}</span> : null}
    </span>
  );
}

/** Score-band legend shared by the heatmap and any other score-driven UI —
 * derived from gfmiColor's own thresholds so it can never drift out of sync
 * with the actual tile colors. */
export const RISK_LEVEL_LEGEND: { label: string; sampleScore: number }[] = [
  { label: "Low", sampleScore: 10 },
  { label: "Moderate", sampleScore: 35 },
  { label: "Elevated", sampleScore: 50 },
  { label: "High", sampleScore: 65 },
  { label: "Severe", sampleScore: 80 },
  { label: "Extreme", sampleScore: 95 },
];

export function DirectionArrow({ direction }: { direction: string }) {
  const map: Record<string, { symbol: string; color: string }> = {
    improving: { symbol: "↓", color: "#34c085" },
    deteriorating: { symbol: "↑", color: "#e05a4d" },
    stable: { symbol: "→", color: "#8b96a8" },
    unknown: { symbol: "?", color: "#8b96a8" },
  };
  const d = map[direction] ?? map.unknown;
  return (
    <span style={{ color: d.color }} title={direction}>
      {d.symbol}
    </span>
  );
}
