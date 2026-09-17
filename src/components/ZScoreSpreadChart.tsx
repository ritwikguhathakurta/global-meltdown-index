"use client";

import { useMemo, useState, type MouseEvent } from "react";

type Point = { t: string; v: number };

const GREEN = "#34c085";
const RED = "#e05a4d";
const TEXT_DIM = "#8b96a8";
const GRID = "#232b38";
const PANEL = "#10151d";

const WIDTH = 900;
const HEIGHT = 260;
const PAD_LEFT = 40;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

/**
 * Diverging line+area chart for a signed z-score series (mean-reversion band
 * at 0, reference lines at +/-1 and +/-2 std). Hand-rolled inline SVG per
 * this codebase's convention of zero chart-library dependencies. Color is
 * sign-only (green >= 0, red < 0) — the same convention as every green/red
 * value in this dashboard (pctColor), not a buy/sell judgment.
 */
export function ZScoreSpreadChart({
  points,
  unit = "z",
  aLabel = "Soybean oil",
  bLabel = "palm oil",
}: {
  points: Point[];
  unit?: string;
  aLabel?: string;
  bLabel?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { pathSegments, areaSegments, yScale, yMin, yMax, dots } = useMemo(() => {
    if (points.length === 0) {
      return { pathSegments: [], areaSegments: [], yScale: (v: number) => v, yMin: -3, yMax: 3, dots: [] };
    }
    const vals = points.map((p) => p.v);
    const rawMax = Math.max(3, ...vals.map(Math.abs));
    const yMax = Math.ceil(rawMax * 10) / 10;
    const yMin = -yMax;

    const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const xScale = (i: number) => PAD_LEFT + (i / (points.length - 1)) * innerW;
    const yScale = (v: number) => PAD_TOP + ((yMax - v) / (yMax - yMin)) * innerH;

    const dots = points.map((p, i) => ({ x: xScale(i), y: yScale(p.v), v: p.v, t: p.t }));

    // Single continuous line path (color handled per-segment below for the area fill;
    // the stroke itself stays a neutral ink color so polarity reads from the fill, not a two-tone stroke).
    const linePath = dots.map((d, i) => `${i === 0 ? "M" : "L"} ${d.x.toFixed(2)} ${d.y.toFixed(2)}`).join(" ");

    // Diverging area fill: split into above/below-zero polygons so the wash is green above 0, red below —
    // interpolating the zero-crossing so the fill boundary lands exactly on the baseline, not at a data point.
    const zeroY = yScale(0);
    type Seg = { color: string; d: string };
    const areaSegments: Seg[] = [];
    let current: { color: string; pts: { x: number; y: number }[] } | null = null;
    const flush = () => {
      if (current && current.pts.length > 1) {
        const first = current.pts[0];
        const last = current.pts[current.pts.length - 1];
        const d = `M ${first.x.toFixed(2)} ${zeroY.toFixed(2)} ` + current.pts.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + ` L ${last.x.toFixed(2)} ${zeroY.toFixed(2)} Z`;
        areaSegments.push({ color: current.color, d });
      }
      current = null;
    };
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const color = d.v >= 0 ? GREEN : RED;
      if (!current || current.color !== color) {
        if (current && i > 0) {
          // interpolate zero-crossing between previous point and this one
          const prev = dots[i - 1];
          const t = Math.abs(prev.v) / (Math.abs(prev.v) + Math.abs(d.v) || 1);
          const crossX = prev.x + (d.x - prev.x) * t;
          current.pts.push({ x: crossX, y: zeroY });
          flush();
          current = { color, pts: [{ x: crossX, y: zeroY }, { x: d.x, y: d.y }] };
          continue;
        }
        flush();
        current = { color, pts: [] };
      }
      current.pts.push({ x: d.x, y: d.y });
    }
    flush();

    return { pathSegments: [{ color: TEXT_DIM, d: linePath }], areaSegments, yScale, yMin, yMax, dots };
  }, [points]);

  const hovered = hoverIdx !== null ? dots[hoverIdx] : null;
  const last = dots.length > 0 ? dots[dots.length - 1] : null;
  const lastColor = last && last.v >= 0 ? GREEN : RED;

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < dots.length; i++) {
      const dist = Math.abs(dots[i].x - relX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    setHoverIdx(closest);
  }

  const refLines = [2, 1, 0, -1, -2].filter((v) => v <= yMax && v >= yMin);

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Z-score history from ${points[0]?.t.slice(0, 7)} to ${points[points.length - 1]?.t.slice(0, 7)}. Latest reading: ${last?.v.toFixed(2)} ${unit}, ${aLabel} ${last && last.v >= 0 ? "rich" : "cheap"} versus ${bLabel} relative to the fitted long-run relationship.`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {refLines.map((v) => (
          <g key={v}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke={v === 0 ? GRID : GRID}
              strokeWidth={1}
              strokeDasharray={v === 0 ? undefined : "3,3"}
              opacity={v === 0 ? 1 : 0.7}
            />
            <text x={PAD_LEFT - 6} y={yScale(v) + 3} textAnchor="end" fontSize={9} fill={TEXT_DIM} fontFamily="var(--font-mono, monospace)">
              {v > 0 ? `+${v}σ` : v === 0 ? "0" : `${v}σ`}
            </text>
          </g>
        ))}

        {areaSegments.map((seg, i) => (
          <path key={i} d={seg.d} fill={seg.color} opacity={0.1} stroke="none" />
        ))}

        {pathSegments.map((seg, i) => (
          <path key={i} d={seg.d} fill="none" stroke={seg.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
        ))}

        {last && (
          <>
            <circle cx={last.x} cy={last.y} r={5} fill={PANEL} />
            <circle cx={last.x} cy={last.y} r={4} fill={lastColor} />
          </>
        )}

        {hovered && (
          <g>
            <line x1={hovered.x} x2={hovered.x} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke={TEXT_DIM} strokeWidth={1} opacity={0.4} />
            <circle cx={hovered.x} cy={hovered.y} r={5} fill={PANEL} />
            <circle cx={hovered.x} cy={hovered.y} r={4} fill={hovered.v >= 0 ? GREEN : RED} />
          </g>
        )}
      </svg>

      {hovered && (
        <div className="mt-1 flex items-baseline gap-3 text-xs">
          <span className="text-text-dim">{hovered.t.slice(0, 7)}</span>
          <span className="gfew-mono font-semibold" style={{ color: hovered.v >= 0 ? GREEN : RED }}>
            {hovered.v >= 0 ? "+" : ""}
            {hovered.v.toFixed(2)} {unit}
          </span>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-wide text-text-dim">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: GREEN }} /> {aLabel} rich vs {bLabel} (z ≥ 0)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: RED }} /> {aLabel} cheap vs {bLabel} (z &lt; 0)
        </span>
      </div>
    </div>
  );
}
