/**
 * Risk + stress. Everything here is a labelled MODEL ASSUMPTION driven by user-editable inputs (vols, confidence,
 * horizon, penalty scale). It informs risk-adjusted ranking; it never changes the deterministic funding economics.
 */
import type { CarryInputs, Ccy, Shocks } from "./types";
import type { EvalOut, RouteSpec } from "./evaluate";
import { evalInrAlternative, evalRoute } from "./evaluate";
import { averageMaturity } from "./schedule";
import { buildFxTable, midRate } from "./fx";
import { INR } from "./currencies";
import { BP, isNum, normInv, normPdf } from "./units";

/** Transparent penalty parameters (documented in the app's Assumptions panel). */
export const PENALTY = {
  /** price per unit of annual cost volatility caused by open FX exposure */
  fxRiskPrice: 0.25,
  /** max liquidity penalty at liquidity score 0 (annual, decimal) = 25 bp */
  liquidityMax: 0.0025,
  /** refinancing penalty per year of average maturity below 3 years (annual, decimal) = 10 bp */
  refiPerYearShort: 0.001,
  /** concentration penalty coefficient on HHI for portfolios */
  concentration: 0.002,
};

export interface FxRisk {
  exposureInr: number;
  horizonDays: number;
  confidence: number;
  var: number | null;
  es: number | null;
  esPctOfNotional: number | null;
  volUsed: number | null;
  unhedgedShare: number;
}

function inrPerUnit(inp: CarryInputs, c: Ccy): number | null {
  if (c === INR) return 1;
  const r = midRate(buildFxTable(inp.spots, "mid"), c, INR);
  return isNum(r) ? r : null;
}

export function fxRisk(inp: CarryInputs, out: EvalOut, horizonDays = inp.risk.horizonDays, confidence: number = inp.risk.confidence): FxRisk {
  let exposure = 0;
  let volNum = 0;
  let vol: number | null = 0;
  for (const r of out.residualExposure) {
    const k = inrPerUnit(inp, r.ccy);
    if (k === null) continue;
    const e = r.amount * k;
    exposure += e;
    const v = inp.risk.fxVol[r.ccy];
    if (!isNum(v)) vol = null;
    else if (vol !== null) volNum += e * v;
  }
  const volUsed = vol === null ? null : exposure > 0 ? volNum / exposure : 0;
  const notional = inp.deal.requirementInr;
  if (exposure === 0) return { exposureInr: 0, horizonDays, confidence, var: 0, es: 0, esPctOfNotional: 0, volUsed: 0, unhedgedShare: 0 };
  const share = exposure / notional;
  if (volUsed === null) return { exposureInr: exposure, horizonDays, confidence, var: null, es: null, esPctOfNotional: null, volUsed: null, unhedgedShare: share };
  const sd = volUsed * Math.sqrt(horizonDays / 252);
  const z = normInv(confidence);
  const v = exposure * z * sd;
  const es = exposure * sd * (normPdf(z) / (1 - confidence));
  return { exposureInr: exposure, horizonDays, confidence, var: v, es, esPctOfNotional: es / notional, volUsed, unhedgedShare: share };
}

export interface Penalties {
  risk: number;
  liquidity: number;
  refinancing: number;
  total: number;
}

export function penalties(inp: CarryInputs, route: RouteSpec, out: EvalOut): Penalties {
  const share = out.residualExposure.length ? (out.residualExposure.reduce((s, r) => s + r.amount * (inrPerUnit(inp, r.ccy) ?? 0), 0) / inp.deal.requirementInr) : 0;
  const ccys = [route.start, ...route.edges.map((e) => e.to)].filter((c) => c !== INR);
  const vol = out.residualExposure.length ? (inp.risk.fxVol[out.residualExposure[0].ccy] ?? 0.08) : 0;
  const risk = inp.risk.riskAversion * PENALTY.fxRiskPrice * share * vol;
  const minLiq = Math.min(...ccys.map((c) => inp.risk.liquidity[c] ?? 0.5), 1);
  const liquidity = (1 - minLiq) * PENALTY.liquidityMax;
  const wal = averageMaturity(out.sched);
  const refinancing = Math.max(0, 3 - wal) * PENALTY.refiPerYearShort;
  return { risk, liquidity, refinancing, total: risk + liquidity + refinancing };
}

export interface RiskBreakdown {
  fx: FxRisk;
  basisVar: number;
  spreadVar: number;
  rateVar: number;
  hedgePfe: number;
  liquidityScore: number;
  refinancingYears: number;
  fxGrid: { confidence: number; horizonDays: number; var: number | null; es: number | null }[];
}

const HORIZONS = [1, 10, 21, 63, 252];

export function riskBreakdown(inp: CarryInputs, route: RouteSpec, out: EvalOut): RiskBreakdown {
  const wal = averageMaturity(out.sched);
  const z = normInv(inp.risk.confidence);
  const sd = (bpVol: number) => bpVol * BP * Math.sqrt(inp.risk.horizonDays / 252);
  const notional = inp.deal.requirementInr;
  const hasCcs = route.edges.some((e) => e.instrument === "CCS");
  const floatingUnswapped = !hasCcs && route.edges.some((e) => e.instrument === "FX_FORWARD" || e.instrument === "FX_SWAP" || e.instrument === "NDF");
  const ccy0 = [route.start, ...route.edges.map((e) => e.to)].filter((c) => c !== INR);
  const vols = ccy0.map((c) => inp.risk.fxVol[c]).filter(isNum) as number[];
  const volAvg = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0;
  const hedged = 1 - (inp.deal.hedgeRatio < 1 ? 1 - inp.deal.hedgeRatio : 0);
  const fxGrid = [] as RiskBreakdown["fxGrid"];
  for (const c of [0.95, 0.99] as const) for (const hd of HORIZONS) {
    const r = fxRisk(inp, out, hd, c);
    fxGrid.push({ confidence: c, horizonDays: hd, var: r.var, es: r.es });
  }
  return {
    fx: fxRisk(inp, out),
    basisVar: hasCcs ? notional * wal * z * sd(inp.risk.basisVolBp) : 0,
    spreadVar: notional * wal * z * sd(inp.risk.spreadVolBp),
    rateVar: floatingUnswapped || out.residualExposure.length ? notional * wal * z * sd(inp.risk.rateVolBp) * (floatingUnswapped ? 1 : 1 - hedged) : 0,
    hedgePfe: route.edges.length ? notional * hedged * volAvg * Math.sqrt(inp.deal.tenorYears) * z * 0.5 : 0,
    liquidityScore: Math.min(...ccy0.map((c) => inp.risk.liquidity[c] ?? 0.5), 1),
    refinancingYears: Math.max(0, 3 - wal),
    fxGrid,
  };
}

export interface StressRow {
  group: string;
  label: string;
  shocks: Shocks;
  effective: number | null;
  arbitrage: number | null;
  delta: number | null;
  viable: boolean | null;
  hedgeMtmInr: number | null;
}

/** Deterministic stress: re-runs the full cash-flow model under each shock and reports the resulting effective INR cost. */
export function stressTable(inp: CarryInputs, route: RouteSpec, base: EvalOut): StressRow[] {
  if (base.irr === null) return [];
  const alt = evalInrAlternative(inp);
  const altIrr = alt.irr;
  const defs: { group: string; label: string; s: Shocks }[] = [];
  for (const v of [0.05, 0.1, 0.15, 0.2, -0.05, -0.1, -0.15, -0.2]) defs.push({ group: "FX (FCY vs INR)", label: `${v > 0 ? "+" : ""}${v * 100}%`, s: { fxShock: v } });
  for (const v of [25, 50, 100, 200]) defs.push({ group: "Rates (floating FCY benchmark, unswapped)", label: `+${v} bp`, s: { benchBp: v } });
  for (const v of [25, 50, 100]) defs.push({ group: "CCS / hedge basis at execution", label: `+${v} bp`, s: { basisBp: v } });
  for (const v of [25, 50, 100, 200]) defs.push({ group: "Lender credit spread at execution", label: `+${v} bp`, s: { spreadBp: v } });
  for (const v of [0.2, 0.5, 1]) defs.push({ group: "Liquidity (bid/offer widening)", label: `+${v * 100}%`, s: { liquidityWiden: v } });
  const rows: StressRow[] = [];
  for (const d of defs) {
    const o = evalRoute(inp, route, "exec", d.s);
    const eff = o.irr;
    const un = base.residualExposure.reduce((s, r) => s + r.amount * (inrPerUnit(inp, r.ccy) ?? 0), 0);
    const hedged = Math.max(0, inp.deal.requirementInr - un);
    const mtm = d.s.fxShock !== undefined ? hedged * d.s.fxShock : null;
    rows.push({
      group: d.group,
      label: d.label,
      shocks: d.s,
      effective: eff,
      arbitrage: eff !== null && altIrr !== null ? altIrr - eff : null,
      delta: eff !== null ? eff - base.irr : null,
      viable: eff !== null && altIrr !== null ? altIrr - eff >= inp.deal.minSaving : null,
      hedgeMtmInr: mtm,
    });
  }
  return rows;
}

