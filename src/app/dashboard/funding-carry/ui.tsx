"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Status, Level } from "@/lib/carry/analyze";
import type { DataQuality, Meta } from "@/lib/carry/types";
import { ageMinutes, fmtAge } from "@/lib/carry/quality";
import { BP } from "@/lib/carry/units";

export type Unit = "pct" | "bp" | "raw" | "cr";

const toDisplay = (v: number, u: Unit): number => (u === "pct" ? v * 100 : u === "bp" ? v / BP : u === "cr" ? v / 1e7 : v);
const fromDisplay = (v: number, u: Unit): number => (u === "pct" ? v / 100 : u === "bp" ? v * BP : u === "cr" ? v * 1e7 : v);
const trim = (n: number) => String(Math.round(n * 1e8) / 1e8);

/** Tolerant numeric field: accepts "6.25", "6.25%", "625bp"; shows units; never passes NaN upward. */
export function NumInput({ value, onChange, unit = "raw", placeholder, width = "w-24", suffix, label, min, max, disabled }: { value: number | null | undefined; onChange: (v: number | null) => void; unit?: Unit; placeholder?: string; width?: string; suffix?: string; label?: string; min?: number; max?: number; disabled?: boolean }) {
  const shown = value === null || value === undefined || !Number.isFinite(value) ? "" : trim(toDisplay(value, unit));
  const [text, setText] = useState(shown);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(shown);
  }, [shown]);
  const [bad, setBad] = useState(false);
  const commit = (s: string) => {
    setText(s);
    const t = s.trim();
    if (t === "") {
      setBad(false);
      onChange(null);
      return;
    }
    let mult = 1;
    let body = t.replace(/,/g, "");
    if (/bps?$/i.test(body)) {
      body = body.replace(/bps?$/i, "");
      mult = unit === "pct" ? 0.01 : unit === "bp" ? 1 : 1;
    } else if (/%$/.test(body)) {
      body = body.slice(0, -1);
      mult = unit === "bp" ? 100 : 1;
    }
    const n = Number(body);
    if (!Number.isFinite(n)) {
      setBad(true);
      return;
    }
    const disp = n * mult;
    if ((min !== undefined && disp < min) || (max !== undefined && disp > max)) {
      setBad(true);
      return;
    }
    setBad(false);
    onChange(fromDisplay(disp, unit));
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input
        aria-label={label}
        disabled={disabled}
        className={`gfew-mono ${width} rounded border bg-bg px-2 py-1 text-right text-xs text-text outline-none focus:border-accent ${bad ? "border-red-500" : "border-border"} ${disabled ? "opacity-50" : ""}`}
        value={text}
        placeholder={placeholder}
        inputMode="decimal"
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(shown);
          setBad(false);
        }}
        onChange={(e) => commit(e.target.value)}
      />
      {suffix ? <span className="text-[10px] text-text-dim">{suffix}</span> : null}
    </span>
  );
}

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-xs ${wide ? "min-w-[16rem]" : ""}`}>
      <span className="font-medium text-text">{label}</span>
      {children}
      {hint ? <span className="max-w-xs text-[10px] leading-snug text-text-dim">{hint}</span> : null}
    </label>
  );
}

export function Select<T extends string | number>({ value, onChange, options, width }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; width?: string }) {
  return (
    <select className={`rounded border border-border bg-bg px-2 py-1 text-xs text-text ${width ?? ""}`} value={String(value)} onChange={(e) => onChange((typeof value === "number" ? Number(e.target.value) : e.target.value) as T)}>
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Card({ title, children, right, id }: { title?: ReactNode; children: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <section id={id} className="gfew-panel mb-4 p-4">
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {title ? <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">{title}</h3> : null}
          <div className="ml-auto">{right}</div>
        </div>
      )}
      {children}
    </section>
  );
}

const STATUS_STYLE: Record<Status, { c: string; label: string }> = {
  EXECUTE: { c: "#34c085", label: "EXECUTE" },
  WATCH: { c: "#3fa9f5", label: "WATCH" },
  AVOID: { c: "#e05a4d", label: "AVOID" },
  INSUFFICIENT_DATA: { c: "#8b96a8", label: "INSUFFICIENT DATA" },
  MODEL_VALIDATION_FAILED: { c: "#e0793d", label: "MODEL VALIDATION FAILED" },
};

export function StatusPill({ s }: { s: Status }) {
  const st = STATUS_STYLE[s];
  return (
    <span className="inline-block whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-bold tracking-wide" style={{ background: `${st.c}22`, color: st.c, border: `1px solid ${st.c}66` }}>
      {st.label}
    </span>
  );
}

const LEVEL_C: Record<Level, string> = { HIGH: "#34c085", MEDIUM: "#e0b93d", LOW: "#e05a4d" };
export function LevelPill({ l }: { l: Level }) {
  return (
    <span className="whitespace-nowrap text-[10px] font-semibold" style={{ color: LEVEL_C[l] }}>
      {l}
    </span>
  );
}

export function Tag({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "info" | "bad" | "good" }) {
  const c = tone === "warn" ? "#e0b93d" : tone === "bad" ? "#e05a4d" : tone === "good" ? "#34c085" : "#3fa9f5";
  return (
    <span className="mr-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ background: `${c}1f`, color: c, border: `1px solid ${c}55` }}>
      {children}
    </span>
  );
}

export function QualityBadge({ q, source }: { q: DataQuality; source?: string }) {
  const c = q === "A" ? "#34c085" : q === "B" || q === "C" ? "#3fa9f5" : q === "D" ? "#e0b93d" : "#8b96a8";
  return (
    <span title={`Quality ${q}: A executable dealer quote · B institutional data · C official benchmark · D indicative public · E model-derived`} className="gfew-mono rounded px-1 text-[10px] font-bold" style={{ color: c, border: `1px solid ${c}66` }}>
      {q}
      {source && source !== "USER_INPUT" ? `·${source}` : ""}
    </span>
  );
}

export function AgeBadge({ meta, nowIso, limitMin }: { meta: Meta; nowIso: string; limitMin: number }) {
  const a = ageMinutes(meta, nowIso);
  const stale = a === null || a > limitMin;
  return (
    <span className="text-[10px]" style={{ color: stale ? "#e05a4d" : "#8b96a8" }}>
      {fmtAge(a)}
      {stale ? " · STALE" : ""}
    </span>
  );
}

export function QualitySelect({ meta, onDeclare }: { meta: Meta; onDeclare: (q: DataQuality) => void }) {
  const example = meta.source === "EXAMPLE";
  return (
    <select className="rounded border border-border bg-bg px-1 py-0.5 text-[10px] text-text" value={example ? "E" : meta.quality} onChange={(e) => onDeclare(e.target.value as DataQuality)} title="What kind of quote is this? Illustrative rows can never signal EXECUTE: declare a row real only after replacing every number in it with your bank's quote.">
      {example ? <option value="E">E · illustrative (not real)</option> : null}
      <option value="A">A · firm dealer quote</option>
      <option value="B">B · institutional / screen</option>
      <option value="D">D · indicative</option>
    </select>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; badge?: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={`rounded px-3 py-1.5 text-xs font-medium transition ${value === t.id ? "bg-accent text-[#061018]" : "text-text-dim hover:bg-panel-raised hover:text-text"}`}>
          {t.label}
          {t.badge ? <span className="ml-1 rounded bg-[#00000033] px-1 text-[9px]">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export const Th = ({ children, right }: { children?: ReactNode; right?: boolean }) => <th className={`whitespace-nowrap px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-dim ${right ? "text-right" : "text-left"}`}>{children}</th>;
export const Td = ({ children, right, mono, className }: { children?: ReactNode; right?: boolean; mono?: boolean; className?: string }) => <td className={`px-2 py-1.5 align-top text-xs ${right ? "text-right" : ""} ${mono ? "gfew-mono" : ""} ${className ?? ""}`}>{children}</td>;

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "bad" | "good" }) {
  const c = tone === "warn" ? "#e0b93d" : tone === "bad" ? "#e05a4d" : tone === "good" ? "#34c085" : "#3fa9f5";
  return (
    <div className="mb-3 rounded border-l-2 px-3 py-2 text-xs leading-relaxed text-text-dim" style={{ borderColor: c, background: `${c}10` }}>
      {children}
    </div>
  );
}

export function download(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Btn({ onClick, children, kind = "ghost", disabled, title }: { onClick?: () => void; children: ReactNode; kind?: "ghost" | "primary" | "danger"; disabled?: boolean; title?: string }) {
  const cls = kind === "primary" ? "bg-accent text-[#061018] hover:opacity-90" : kind === "danger" ? "border border-red-500/60 text-red-400 hover:bg-red-500/10" : "border border-border text-text hover:bg-panel-raised";
  return (
    <button title={title} disabled={disabled} onClick={onClick} className={`rounded px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}
