"use client";

export const PALETTE = ["#3fa9f5", "#e08a3d", "#34c085", "#b48ef0", "#e0b93d", "#4fd1c5", "#f28ab2", "#9aa7bd", "#e05a4d"];

export interface BarItem {
  label: string;
  value: number;
  note?: string;
  color?: string;
}

/** Horizontal bars with a zero line; every bar carries its value as text (never colour alone). */
export function HBars({ items, fmt, title }: { items: BarItem[]; fmt: (v: number) => string; title?: string }) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1e-12);
  const hasNeg = items.some((i) => i.value < 0);
  return (
    <div role="img" aria-label={title ?? "bar chart"} className="space-y-1">
      {items.map((i) => {
        const w = (Math.abs(i.value) / max) * (hasNeg ? 48 : 96);
        const pos = i.value >= 0;
        return (
          <div key={i.label} className="flex items-center gap-2 text-[11px]">
            <div className="w-40 shrink-0 truncate text-text-dim" title={i.label}>{i.label}</div>
            <div className="relative h-4 flex-1">
              <div className="absolute top-0 h-4 rounded-sm" style={{ background: i.color ?? (pos ? "#3fa9f5" : "#e05a4d"), width: `${w}%`, left: hasNeg ? (pos ? "50%" : `${50 - w}%`) : 0, opacity: 0.85 }} />
              {hasNeg && <div className="absolute left-1/2 top-0 h-4 w-px bg-border" />}
            </div>
            <div className="gfew-mono w-24 shrink-0 text-right text-text">{fmt(i.value)}</div>
            {i.note ? <div className="w-40 shrink-0 truncate text-[10px] text-text-dim" title={i.note}>{i.note}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

export interface WfItem {
  label: string;
  /** cost contribution (positive = adds to cost) */
  value: number;
}

/** Cost build-up waterfall: each step adds (cost) or removes (benefit) from the running effective rate. */
export function Waterfall({ items, fmt, endLabel }: { items: WfItem[]; fmt: (v: number) => string; endLabel: string }) {
  const rows: (WfItem & { start: number; end: number })[] = [];
  for (const it of items) {
    const start = rows.length ? rows[rows.length - 1].end : 0;
    rows.push({ ...it, start, end: start + it.value });
  }
  const run = rows.length ? rows[rows.length - 1].end : 0;
  const lo = Math.min(0, ...rows.map((r) => Math.min(r.start, r.end)));
  const hi = Math.max(...rows.map((r) => Math.max(r.start, r.end)), 1e-9);
  const span = hi - lo || 1;
  const pct = (v: number) => ((v - lo) / span) * 100;
  return (
    <div role="img" aria-label="cost waterfall" className="space-y-1">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[11px]">
          <div className="w-44 shrink-0 truncate text-text-dim" title={r.label}>{r.label}</div>
          <div className="relative h-4 flex-1 rounded-sm bg-[#ffffff08]">
            <div className="absolute top-0 h-4 rounded-sm" style={{ left: `${pct(Math.min(r.start, r.end))}%`, width: `${Math.max(0.6, (Math.abs(r.value) / span) * 100)}%`, background: r.value >= 0 ? "#e0793d" : "#34c085", opacity: 0.9 }} />
          </div>
          <div className="gfew-mono w-20 shrink-0 text-right text-text">{r.value >= 0 ? "+" : ""}{fmt(r.value)}</div>
          <div className="w-14 shrink-0 text-[10px] text-text-dim">{r.value >= 0 ? "cost" : "benefit"}</div>
        </div>
      ))}
      <div className="flex items-center gap-2 border-t border-border pt-1 text-[11px] font-semibold">
        <div className="w-44 shrink-0">{endLabel}</div>
        <div className="flex-1" />
        <div className="gfew-mono w-20 text-right text-text">{fmt(run)}</div>
        <div className="w-14" />
      </div>
    </div>
  );
}

export interface LineSeries {
  name: string;
  color: string;
  dash?: string;
  points: { x: number; y: number }[];
}

export function LineChart({ series, xLabel, yFmt, height = 220, xFmt }: { series: LineSeries[]; xLabel: string; yFmt: (v: number) => string; height?: number; xFmt?: (v: number) => string }) {
  const pts = series.flatMap((s) => s.points);
  if (pts.length < 2) return <div className="text-xs text-text-dim">Enter quotes for at least two tenors to draw curves.</div>;
  const W = 640;
  const H = height;
  const m = { l: 52, r: 96, t: 10, b: 28 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  if (y1 - y0 < 1e-9) {
    y0 -= 0.001;
    y1 += 0.001;
  }
  const pad = (y1 - y0) * 0.08;
  y0 -= pad;
  y1 += pad;
  const X = (x: number) => m.l + ((x - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
  const Y = (y: number) => H - m.b - ((y - y0) / (y1 - y0)) * (H - m.t - m.b);
  const ticks = 4;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Line chart: ${series.map((s) => s.name).join(", ")}`}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = y0 + ((y1 - y0) * i) / ticks;
          return (
            <g key={i}>
              <line x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} stroke="#232b38" strokeWidth={1} />
              <text x={m.l - 6} y={Y(v) + 3} textAnchor="end" fontSize={9} fill="#8b96a8">{yFmt(v)}</text>
            </g>
          );
        })}
        {[...new Set(xs)].sort((a, b) => a - b).map((x) => (
          <text key={x} x={X(x)} y={H - 10} textAnchor="middle" fontSize={9} fill="#8b96a8">{xFmt ? xFmt(x) : x}</text>
        ))}
        <text x={(m.l + W - m.r) / 2} y={H - 0} textAnchor="middle" fontSize={9} fill="#8b96a8">{xLabel}</text>
        {series.map((s) => {
          const p = [...s.points].sort((a, b) => a.x - b.x);
          const d = p.map((q, i) => `${i ? "L" : "M"}${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(" ");
          const last = p[p.length - 1];
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
              {p.map((q) => (
                <circle key={q.x} cx={X(q.x)} cy={Y(q.y)} r={3} fill={s.color} stroke="#0a0e14" strokeWidth={1.5} />
              ))}
              {last ? <text x={X(last.x) + 6} y={Y(last.y) + 3} fontSize={10} fill={s.color}>{s.name}</text> : null}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-text-dim">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Heat-map cell colour: sequential diverging around the minimum-saving hurdle, ALWAYS with the number as text. */
export function heatStyle(v: number | null, hurdle: number): { background: string; color: string } {
  if (v === null) return { background: "#1a1f28", color: "#5a6472" };
  if (v >= hurdle) return { background: "#34c08533", color: "#7ee0b3" };
  if (v >= 0) return { background: "#e0b93d2b", color: "#e8cf77" };
  return { background: "#e05a4d33", color: "#f0958b" };
}
