"use client";

import { useMemo, useState } from "react";
import { runScenario, type ScenarioInput } from "@/lib/derivatives/scenario";
import type { CompositeIndex } from "@/lib/derivatives/types";
import { Panel, SectionTitle, fmtNum } from "./ui";

function NumField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-text-dim">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 rounded border border-border bg-panel-raised px-2 py-1 text-sm"
        />
        <span className="text-text-dim">{suffix}</span>
      </div>
    </label>
  );
}

export function ScenarioPanel({ current }: { current: { msi: CompositeIndex; csi: CompositeIndex; pci: CompositeIndex } }) {
  const [input, setInput] = useState<ScenarioInput>({ equityPct: -15, ratesBp: 100, usdPct: 5, vixPct: 50 });
  const output = useMemo(() => runScenario(input, current), [input, current]);

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <SectionTitle>Scenario / Reverse Stress Test</SectionTitle>
        <p className="mb-4 text-[11px] text-text-dim">
          A transparent, documented sensitivity calculator over the page’s own MODEL ESTIMATE stress proxies — not a prediction of real dollar margin calls or forced-selling volume, since nothing here has real dealer-book data to size those against. See the note at the bottom for exactly how each number is derived.
        </p>
        <div className="mb-4 flex flex-wrap gap-4">
          <NumField label="Equity shock" value={input.equityPct} onChange={(v) => setInput((s) => ({ ...s, equityPct: v }))} suffix="%" />
          <NumField label="Rates shock" value={input.ratesBp} onChange={(v) => setInput((s) => ({ ...s, ratesBp: v }))} suffix="bp" />
          <NumField label="USD shock" value={input.usdPct} onChange={(v) => setInput((s) => ({ ...s, usdPct: v }))} suffix="%" />
          <NumField label="VIX shock" value={input.vixPct} onChange={(v) => setInput((s) => ({ ...s, vixPct: v }))} suffix="%" />
        </div>
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="gfew-panel min-w-[180px] flex-1 p-3">
            <span className="text-xs uppercase tracking-wide text-text-dim">Margin Stress (MSI) proxy</span>
            <div className="gfew-mono text-xl">
              {fmtNum(current.msi.level, 0)} → {fmtNum(output.projectedMsiLevel, 0)}
            </div>
          </div>
          <div className="gfew-panel min-w-[180px] flex-1 p-3">
            <span className="text-xs uppercase tracking-wide text-text-dim">Collateral Stress (CSI) proxy</span>
            <div className="gfew-mono text-xl">
              {fmtNum(current.csi.level, 0)} → {fmtNum(output.projectedCsiLevel, 0)}
            </div>
          </div>
          <div className="gfew-panel min-w-[180px] flex-1 p-3">
            <span className="text-xs uppercase tracking-wide text-text-dim">Positioning Crowding (PCI) proxy</span>
            <div className="gfew-mono text-xl">
              {fmtNum(current.pci.level, 0)} → {fmtNum(output.projectedPciLevel, 0)}
            </div>
          </div>
        </div>
        <ul className="list-inside list-disc text-xs text-text-dim">
          {output.narrative.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
