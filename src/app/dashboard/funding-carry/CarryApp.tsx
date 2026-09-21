"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { LiveSnapshot } from "@/lib/carry/marketData";
import { detectRegime } from "@/lib/carry/marketData";
import { analyze } from "@/lib/carry/analyze";
import { applyScenario } from "@/lib/carry/scenario";
import { isNum } from "@/lib/carry/units";
import { loadState, saveState, type AppState } from "./state";
import { Note, Tabs, Tag } from "./ui";
import { DealPanel, QuotesPanel } from "./InputPanels";
import { RadarPanel, WhyPanel, type ResultProps } from "./ResultPanels";
import { ReversePanel, ScenarioPanel, SensitivityPanel, StressRiskPanel } from "./AnalysisPanels";
import { BankPanel, PortfolioPanel } from "./PortfolioPanels";
import { AuditPanel, GuidePanel, RegulatoryPanel, SettingsPanel } from "./MiscPanels";

type TabId = "guide" | "deal" | "quotes" | "radar" | "why" | "reverse" | "scenario" | "sensitivity" | "stress" | "bank" | "portfolio" | "reg" | "settings" | "audit";

const TABS: { id: TabId; label: string }[] = [
  { id: "guide", label: "Start here" },
  { id: "deal", label: "1 · Deal" },
  { id: "quotes", label: "2 · OTC quotes" },
  { id: "radar", label: "3 · What to raise" },
  { id: "why", label: "Why / cash flows" },
  { id: "reverse", label: "Max rates & break-evens" },
  { id: "scenario", label: "Scenario & what-if" },
  { id: "sensitivity", label: "Sensitivity & curves" },
  { id: "stress", label: "Stress & risk" },
  { id: "bank", label: "Banks & negotiation" },
  { id: "portfolio", label: "Hedge & portfolio" },
  { id: "reg", label: "Regulatory" },
  { id: "settings", label: "Settings" },
  { id: "audit", label: "Audit & export" },
];

function hasData(s: AppState): boolean {
  return Object.values(s.inputs.quotesByTenor).some((t) => Object.values(t.lenders).some((l) => isNum(l.spread)));
}

export default function CarryApp({ live }: { live: LiveSnapshot | null }) {
  const [now, setNow] = useState(() => new Date().toISOString());
  const [st, setSt] = useState<AppState>(() => loadState(new Date().toISOString()));
  const [tab, setTab] = useState<TabId>(() => (typeof window !== "undefined" && hasData(loadState(new Date().toISOString())) ? "radar" : "guide"));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toISOString()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => saveState(st), 400);
    return () => clearTimeout(id);
  }, [st]);

  const up = useCallback((fn: (d: AppState) => void) => {
    setSt((prev) => {
      const d = structuredClone(prev);
      fn(d);
      return d;
    });
  }, []);

  const regimeMult = useMemo(() => (st.applyRegimeVol ? detectRegime(live).volMultiplier : 1), [st.applyRegimeVol, live]);
  const eff = useMemo(() => {
    let base = { ...st.inputs, nowIso: now };
    if (regimeMult !== 1) {
      const vol = { ...base.risk.fxVol };
      for (const k of Object.keys(vol)) if (isNum(vol[k])) vol[k] = (vol[k] as number) * regimeMult;
      base = { ...base, risk: { ...base.risk, fxVol: vol } };
    }
    return st.scenarioOn ? applyScenario(base, st.scenario) : base;
  }, [st.inputs, st.scenario, st.scenarioOn, now, regimeMult]);
  const effDeferred = useDeferredValue(eff);

  const result = useMemo(() => {
    try {
      return { a: analyze(effDeferred, st.scenarioOn ? "SCENARIO" : "LIVE"), error: null as string | null };
    } catch (e) {
      return { a: null, error: (e as Error).message };
    }
  }, [effDeferred, st.scenarioOn]);

  const goto = useCallback((t: string) => setTab(t as TabId), []);

  const common = result.a
    ? ({ st, up, now, a: result.a, live, eff: effDeferred, selectedId, onSelect: (id: string) => setSelectedId(id), goto } satisfies ResultProps)
    : null;

  return (
    <div>
      {st.scenarioOn && (
        <div className="mb-3 rounded border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <b>SCENARIO MODE IS ON.</b> Every result on every tab is SCENARIO, not live — nothing here can be an EXECUTE signal. Your live / OTC quotes are untouched. <button className="ml-2 underline" onClick={() => up((d) => (d.scenarioOn = false))}>Switch back to live</button>
        </div>
      )}
      {live === null && <Note>Live reference data is unavailable right now (fine — everything works from your quotes).</Note>}
      {result.error && <Note tone="bad">Cannot compute: {result.error}. Check the deal terms (tenor, frequency, dates).</Note>}
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "guide" && common && <GuidePanel {...common} />}
      {tab === "deal" && common && <DealPanel {...common} />}
      {tab === "quotes" && common && <QuotesPanel {...common} />}
      {tab === "radar" && common && <RadarPanel {...common} />}
      {tab === "why" && common && <WhyPanel {...common} />}
      {tab === "reverse" && common && <ReversePanel {...common} />}
      {tab === "scenario" && common && <ScenarioPanel {...common} />}
      {tab === "sensitivity" && common && <SensitivityPanel {...common} />}
      {tab === "stress" && common && <StressRiskPanel {...common} />}
      {tab === "bank" && common && <BankPanel {...common} />}
      {tab === "portfolio" && common && <PortfolioPanel {...common} />}
      {tab === "reg" && common && <RegulatoryPanel {...common} />}
      {tab === "settings" && common && <SettingsPanel {...common} />}
      {tab === "audit" && common && <AuditPanel {...common} />}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[10px] text-text-dim">
        <Tag tone="info">ANALYSIS ONLY</Tag> Not investment, legal or tax advice. Quotes are kept in this browser only. Model {result.a?.modelVersion ?? "—"}.
      </div>
    </div>
  );
}
