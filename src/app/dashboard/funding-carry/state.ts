"use client";

import type { CarryInputs, Ccy, Meta, TenorQuotes } from "@/lib/carry/types";
import { defaultInputs, emptyEdge, emptyLender, emptySpots, emptyTenorQuotes, meta } from "@/lib/carry/defaults";
import { FUNDING_CCYS, INR, USD, spotPairsFor } from "@/lib/carry/currencies";
import type { BankQuote, CompareMetric, ExposureItem, Liability, Objective } from "@/lib/carry/portfolio";
import { emptyScenario, type Scenario } from "@/lib/carry/scenario";
import type { SignalRecord, Snapshot } from "@/lib/carry/signals";

export interface HistoryItem {
  ts: string;
  label: string;
  best: string | null;
  advantageBp: number | null;
  effective: number | null;
  status: string | null;
}

export interface AppState {
  v: 1;
  inputs: CarryInputs;
  editTenor: number;
  bank: BankQuote[];
  exposures: ExposureItem[];
  exposureHedges: Record<Ccy, number>;
  book: Liability[];
  scenario: Scenario;
  scenarioOn: boolean;
  objective: Objective;
  compareMetric: CompareMetric;
  tenorCons: { minTenor: number; maxTenor: number };
  prevSnapshot: Snapshot | null;
  signalRecords: SignalRecord[];
  history: HistoryItem[];
  applyRegimeVol: boolean;
  guideDismissed: boolean;
  /** negotiation step in bp (beat the best quote by this much) */
  negStepBp: number;
}

const KEY = "gmi.fundingCarry.v1";

export function freshState(nowIso: string): AppState {
  return {
    v: 1,
    inputs: defaultInputs(nowIso),
    editTenor: 5,
    bank: [],
    exposures: [],
    exposureHedges: {},
    book: [],
    scenario: emptyScenario(),
    scenarioOn: false,
    objective: "balanced",
    compareMetric: "effective",
    tenorCons: { minTenor: 0, maxTenor: 99 },
    prevSnapshot: null,
    signalRecords: [],
    history: [],
    applyRegimeVol: false,
    guideDismissed: false,
    negStepBp: 5,
  };
}

/** Make sure every funding currency / spot pair / tenor slot exists (forward-compatible with new currencies). */
export function normalise(s: AppState, nowIso: string): AppState {
  const inp = s.inputs;
  const have = new Set(inp.spots.map((p) => `${p.base}/${p.quote}`));
  for (const p of emptySpots(nowIso)) if (!have.has(`${p.base}/${p.quote}`)) inp.spots.push(p);
  for (const [k, t] of Object.entries(inp.quotesByTenor)) {
    for (const c of FUNDING_CCYS) if (!t.lenders[c]) t.lenders[c] = emptyLender(c, nowIso);
    for (const c of FUNDING_CCYS) {
      if (!t.edges.some((e) => e.from === c && e.to === INR)) t.edges.push(emptyEdge(c, INR, "CCS", nowIso));
      if (c !== USD && !t.edges.some((e) => e.from === c && e.to === USD)) t.edges.push(emptyEdge(c, USD, "CCS", nowIso));
    }
    void k;
  }
  if (!inp.quotesByTenor[String(s.editTenor)]) inp.quotesByTenor[String(s.editTenor)] = emptyTenorQuotes(nowIso);
  return s;
}

export function loadState(nowIso: string): AppState {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (raw) {
      const p = JSON.parse(raw) as AppState;
      if (p && p.v === 1 && p.inputs && p.inputs.deal && p.inputs.quotesByTenor) return normalise(p, nowIso);
    }
  } catch {
    /* private mode / corrupt storage: start fresh */
  }
  return normalise(freshState(nowIso), nowIso);
}

export function saveState(s: AppState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked — the page still works, it just won't remember */
  }
}

export function clearState() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Editing a value refreshes its quote time. Illustrative (EXAMPLE) groups stay illustrative until the user explicitly declares them real. */
export const stamp = (m: Meta, nowIso: string): Meta => (m.source === "USER_INPUT" ? { ...m, asOf: nowIso } : m.source === "LIVE" ? { source: "USER_INPUT", quality: "D", asOf: nowIso } : m);

export const declareReal = (m: Meta, quality: Meta["quality"], nowIso: string): Meta => ({ source: "USER_INPUT", quality, asOf: nowIso });

export function tenorQuotes(s: AppState, tenor = s.editTenor, nowIso = s.inputs.nowIso): TenorQuotes {
  const k = String(tenor);
  if (!s.inputs.quotesByTenor[k]) s.inputs.quotesByTenor[k] = emptyTenorQuotes(nowIso);
  return s.inputs.quotesByTenor[k];
}

export function spotPairList(): { base: Ccy; quote: Ccy }[] {
  return spotPairsFor(FUNDING_CCYS);
}

export { meta };
