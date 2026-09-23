import type { ReactNode } from "react";
import type { DataQuality } from "@/lib/derivatives/types";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`gfew-panel p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">{children}</h3>;
}

const QUALITY_COLOR: Record<DataQuality, string> = {
  REAL: "#34c085",
  MODEL_ESTIMATE: "#e0b93d",
  UNAVAILABLE: "#8b96a8",
};

const QUALITY_LABEL: Record<DataQuality, string> = {
  REAL: "REAL DATA",
  MODEL_ESTIMATE: "MODEL ESTIMATE",
  UNAVAILABLE: "UNAVAILABLE",
};

export function QualityBadge({ quality }: { quality: DataQuality }) {
  const color = QUALITY_COLOR[quality];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide" style={{ borderColor: color, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {QUALITY_LABEL[quality]}
    </span>
  );
}

export function IndexCard({ label, level, change4w, quality, methodology }: { label: string; level: number | null; change4w: number | null; quality: DataQuality; methodology: string }) {
  return (
    <div className="gfew-panel flex min-w-[200px] flex-1 flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-text-dim">{label}</span>
        <QualityBadge quality={quality} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="gfew-mono text-2xl font-semibold">{level === null ? "—" : level.toFixed(0)}</span>
        {change4w !== null && (
          <span className={`gfew-mono text-xs ${change4w > 0 ? "text-[#e0b93d]" : change4w < 0 ? "text-[#34c085]" : "text-text-dim"}`}>
            {change4w > 0 ? "▲" : change4w < 0 ? "▼" : "—"} {Math.abs(change4w).toFixed(1)}
          </span>
        )}
      </div>
      <p className="text-[11px] leading-snug text-text-dim">{methodology}</p>
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return <th className={`whitespace-nowrap bg-panel-raised px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-dim ${right ? "text-right" : ""}`}>{children}</th>;
}

export function Td({ children, right, mono, className = "" }: { children?: ReactNode; right?: boolean; mono?: boolean; className?: string }) {
  return <td className={`border-t border-border px-3 py-2 align-top text-xs ${right ? "text-right" : ""} ${mono ? "gfew-mono" : ""} ${className}`}>{children}</td>;
}

export function fmtNum(v: number | null, digits = 2): string {
  if (v === null || Number.isNaN(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtUsd(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}tn`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}bn`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}mn`;
  return `$${v.toFixed(0)}`;
}

export function fmtPct(v: number | null, digits = 2): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

export function UnavailableNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-border p-4 text-xs text-text-dim">
      <QualityBadge quality="UNAVAILABLE" /> <span className="ml-2">{children}</span>
    </div>
  );
}
