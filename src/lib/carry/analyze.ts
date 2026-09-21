/**
 * Orchestrator: evaluates every funding route at mid and executable prices, applies the signal gates,
 * and produces three INDEPENDENT rankings (theoretical / executable / risk-adjusted) — never one blended list.
 *
 * Signal rule (master prompt §41): a route is only EXECUTE when regulatory not blocked AND executable
 * (A-quality, fresh) data AND effective cost < hurdle AND minimum arbitrage met AND liquidity acceptable
 * AND risk limits satisfied AND all critical validators pass. Otherwise WATCH / AVOID with the reason.
 */
import type { CarryInputs, Ccy, Mode } from "./types";
import type { EvalOut, RouteSpec, CostLine } from "./evaluate";
import { attribute, evalDirectLoan, evalInrAlternative, evalRoute } from "./evaluate";
import { enumerateRoutes } from "./routes";
import { buildSchedule } from "./schedule";
import { aggregate, npv } from "./cashflow";
import { routeQuality, type QualityReport } from "./quality";
import { assessEcb, assessRbiSwap, type RegAssessment, type RegStatus } from "./regulatory";
import { validateRoute, criticalFailures, type ValidatorResult } from "./validators";
import { fxRisk, penalties, type FxRisk, type Penalties } from "./risk";
import { BP, bisect, isNum } from "./units";
import { INR, USD } from "./currencies";
import { MODEL_VERSION } from "./defaults";

export type Status = "EXECUTE" | "WATCH" | "AVOID" | "INSUFFICIENT_DATA" | "MODEL_VALIDATION_FAILED";
export type Level = "HIGH" | "MEDIUM" | "LOW";
export type Classification = "VERY_STRONG" | "STRONG" | "MARGINAL" | "WEAK" | "NO_ARBITRAGE";

export interface Econ {
  effective: number;
  inrAlt: number;
  arbitrage: number;
  headroom: number;
  annualSaving: number;
  npvSaving: number;
  classification: Classification;
}

export interface Gate {
  name: string;
  pass: boolean;
  detail: string;
}

export interface Confidence {
  data: Level;
  economic: Level;
  regulatory: Level;
  execution: Level;
  model: Level;
  overall: Level;
}

export interface Explain {
  fcyFundingCost: number;
  hedgeCost: number;
  basis: number | null;
  fees: number;
  tax: number;
  rbiBenefit: number | null;
  effective: number;
  inrAlt: number;
  arbitrage: number;
  headroom: number;
  lines: CostLine[];
}

export interface RouteResult {
  id: string;
  label: string;
  start: Ccy;
  route: RouteSpec;
  pathCcys: Ccy[];
  status: Status;
  tags: string[];
  reasons: string[];
  missing: string[];
  warnings: string[];
  mid: Econ | null;
  exec: Econ | null;
  slippage: number | null;
  fcyRate: number | null;
  maxSpread: number | null;
  maxHedgeCost: number | null;
  quality: QualityReport;
  regulatory: RegStatus;
  regAssessments: RegAssessment[];
  gates: Gate[];
  validators: ValidatorResult[];
  confidence: Confidence;
  penalties: Penalties | null;
  rac: number | null;
  fxRisk: FxRisk | null;
  explain: Explain | null;
  evalExec: EvalOut | null;
  evalMid: EvalOut | null;
  usesRbi: boolean;
  liquidityScore: number;
}

export interface CarryRow {
  ccy: Ccy;
  usdCarryMid: number | null;
  usdCarryExec: number | null;
  synthUsdExec: number | null;
  inrCarryDirect: number | null;
  inrCarryViaUsd: number | null;
  inrDirectPath: string | null;
  inrViaUsdPath: string | null;
  crossPathAdvantage: number | null;
}

export interface Analysis {
  modelVersion: string;
  asOf: string;
  modeLabel: "LIVE" | "SCENARIO";
  inrAlt: EvalOut;
  inrAltIrr: number | null;
  inrAltMissing: string[];
  routes: RouteResult[];
  ranking: { theoretical: string[]; executable: string[]; riskAdjusted: string[] };
  best: RouteResult | null;
  ecb: RegAssessment;
  swap: RegAssessment | null;
  carry: CarryRow[];
  directUsdIrr: number | null;
  warnings: string[];
}

export function classify(arb: number, bands: CarryInputs["bands"]): Classification {
  if (arb > bands.veryStrong) return "VERY_STRONG";
  if (arb >= bands.strong) return "STRONG";
  if (arb >= bands.marginal) return "MARGINAL";
  if (arb >= 0) return "WEAK";
  return "NO_ARBITRAGE";
}

const REG_ORDER: RegStatus[] = ["NOT_ELIGIBLE", "INSUFFICIENT_INFORMATION", "POTENTIALLY_ELIGIBLE", "ELIGIBLE"];
const worstReg = (a: RegStatus, b: RegStatus): RegStatus => (REG_ORDER.indexOf(a) <= REG_ORDER.indexOf(b) ? a : b);
const LEVELS: Level[] = ["LOW", "MEDIUM", "HIGH"];
const minLevel = (...l: Level[]): Level => l.reduce((a, b) => (LEVELS.indexOf(a) <= LEVELS.indexOf(b) ? a : b));

function econ(inp: CarryInputs, out: EvalOut, altIrr: number): Econ | null {
  if (out.irr === null) return null;
  const arb = altIrr - out.irr;
  const flows = aggregate(out.entries, out.target);
  return {
    effective: out.irr,
    inrAlt: altIrr,
    arbitrage: arb,
    headroom: arb - inp.deal.minSaving,
    annualSaving: inp.deal.requirementInr * arb,
    npvSaving: npv(flows, altIrr),
    classification: classify(arb, inp.bands),
  };
}

function explainRoute(inp: CarryInputs, ev: EvalOut, mid: EvalOut | null, e: Econ, rbiBenefit: number | null): Explain {
  const lines = attribute(ev);
  const sum = (f: (k: string) => boolean) => lines.filter((l) => f(l.key)).reduce((s, l) => s + l.cost, 0);
  const hedge = sum((k) => k.startsWith("hedge:"));
  let basis: number | null = null;
  const inrSwap = inp.inrAlt.benchmarkRate;
  if (isNum(inrSwap) && mid && mid.irr !== null) {
    const ml = attribute(mid);
    const hedgeMid = ml.filter((l) => l.key.startsWith("hedge:")).reduce((s, l) => s + l.cost, 0);
    const q = inp.quotesByTenor[String(inp.deal.tenorYears)];
    const benchStart = q?.lenders[ev.notionals[0]?.ccy ?? ""]?.benchmarkRate;
    if (isNum(benchStart)) basis = hedgeMid - (inrSwap - benchStart);
  }
  return {
    fcyFundingCost: sum((k) => k === "bench" || k === "spread"),
    hedgeCost: hedge,
    basis,
    fees: sum((k) => k === "fee"),
    tax: sum((k) => k === "wht" || k === "stamp" || k === "shield"),
    rbiBenefit,
    effective: e.effective,
    inrAlt: e.inrAlt,
    arbitrage: e.arbitrage,
    headroom: e.headroom,
    lines,
  };
}

function maxSpreadFor(inp: CarryInputs, route: RouteSpec, altIrr: number): number | null {
  const lender = inp.quotesByTenor[String(inp.deal.tenorYears)]?.lenders[route.start];
  if (!lender || !isNum(lender.spread)) return null;
  const s0 = lender.spread;
  const f = (x: number) => {
    const o = evalRoute(inp, route, "exec", { spreadBp: x });
    return o.irr === null ? NaN : altIrr - o.irr - inp.deal.minSaving;
  };
  const r = bisect(f, -s0 / BP, 3000, 1e-9, 80);
  return r === null ? null : s0 + r * BP;
}

function maxHedgeFor(inp: CarryInputs, route: RouteSpec, altIrr: number, hedgeNow: number): number | null {
  const n = route.edges.length;
  if (n === 0) return null;
  const f = (x: number) => {
    const o = evalRoute(inp, route, "exec", { basisBp: x });
    return o.irr === null ? NaN : altIrr - o.irr - inp.deal.minSaving;
  };
  const r = bisect(f, -3000, 3000, 1e-9, 80);
  return r === null ? null : hedgeNow + r * BP * n;
}

export function analyze(inp: CarryInputs, modeLabel: "LIVE" | "SCENARIO" = "LIVE"): Analysis {
  const warnings: string[] = [];
  const alt = evalInrAlternative(inp);
  const altIrr = alt.irr;
  const sched = buildSchedule({ ...inp.deal });
  const ecb = assessEcb(inp, sched);
  const swapA = inp.rbi.apply ? assessRbiSwap(inp, sched) : null;
  const specs = enumerateRoutes(inp);
  const results: RouteResult[] = [];

  for (const spec of specs) {
    const quality = routeQuality(inp, spec);
    const mid = evalRoute(inp, spec, "mid");
    const ex = evalRoute(inp, spec, "exec");
    const usesRbi = spec.edges.some((e) => e.instrument === "RBI_SWAP");
    const regAssessments = usesRbi && swapA ? [ecb, swapA] : [ecb];
    const regulatory = regAssessments.map((a) => a.status).reduce((a, b) => worstReg(a, b));
    const ccys = [spec.start, ...spec.edges.map((e) => e.to)].filter((c) => c !== INR);
    const liquidityScore = Math.min(...ccys.map((c) => inp.risk.liquidity[c] ?? 0.5), 1);
    const base = { id: spec.id, label: spec.label, start: spec.start, route: spec, pathCcys: [spec.start, ...spec.edges.map((e) => e.to)], quality, regulatory, regAssessments, usesRbi, liquidityScore };

    if (ex.irr === null || mid.irr === null || altIrr === null) {
      const missing = [...new Set([...ex.missing, ...mid.missing, ...(altIrr === null ? alt.missing : [])])];
      results.push({ ...base, status: "INSUFFICIENT_DATA", tags: [], reasons: missing.length ? [`Enter: ${missing.join("; ")}`] : ["No valid cash-flow structure"], missing, warnings: ex.warnings, mid: null, exec: null, slippage: null, fcyRate: null, maxSpread: null, maxHedgeCost: null, gates: [], validators: [], confidence: { data: "LOW", economic: "LOW", regulatory: "LOW", execution: "LOW", model: "LOW", overall: "LOW" }, penalties: null, rac: null, fxRisk: null, explain: null, evalExec: ex, evalMid: mid });
      continue;
    }

    const eMid = econ(inp, mid, altIrr) as Econ;
    const eExec = econ(inp, ex, altIrr) as Econ;
    const validators = validateRoute(inp, ex, altIrr);
    const crit = criticalFailures(validators);
    const pen = penalties(inp, spec, ex);
    const risk = fxRisk(inp, ex);

    const attrLines = attribute(ex);
    const hedgeNow = attrLines.filter((l) => l.key.startsWith("hedge:")).reduce((s, l) => s + l.cost, 0);
    const maxSpread = maxSpreadFor(inp, spec, altIrr);
    const maxHedge = maxHedgeFor(inp, spec, altIrr, hedgeNow);

    // regulatory benefit of the RBI swap: same path with a market USD->INR edge instead
    let rbiBenefit: number | null = null;
    if (usesRbi) {
      const twin = specs.find((s) => !s.edges.some((e) => e.instrument === "RBI_SWAP") && s.start === spec.start && s.edges.length === spec.edges.length && s.edges.slice(0, -1).every((e, i) => e.id === spec.edges[i].id));
      if (twin) {
        const t = evalRoute(inp, twin, "exec");
        if (t.irr !== null) rbiBenefit = t.irr - ex.irr;
      }
    }

    const gates: Gate[] = [];
    const arbOk = eExec.arbitrage >= inp.deal.minSaving;
    gates.push({ name: "Effective cost below INR hurdle", pass: eExec.arbitrage > 0, detail: `${(eExec.arbitrage / BP).toFixed(1)} bp executable arbitrage` });
    gates.push({ name: "Minimum saving met", pass: arbOk, detail: `${(eExec.arbitrage / BP).toFixed(1)} bp vs ${(inp.deal.minSaving / BP).toFixed(0)} bp required` });
    gates.push({ name: "Executable, fresh data (A-quality)", pass: quality.allExecutable, detail: quality.theoretical ? "Includes model-derived / illustrative / scenario inputs — theoretical only" : quality.stale.length ? `Stale: ${quality.stale.join("; ")}` : quality.worst === "A" ? "All inputs are firm dealer quotes and fresh" : `Lowest input quality is ${quality.worst} (not an executable dealer quote)` });
    gates.push({ name: "Regulatory not blocked", pass: regulatory !== "NOT_ELIGIBLE" && regulatory !== "INSUFFICIENT_INFORMATION", detail: regulatory.replace(/_/g, " ").toLowerCase() });
    gates.push({ name: "Liquidity acceptable", pass: liquidityScore >= inp.risk.minLiquidityScore, detail: `score ${liquidityScore.toFixed(2)} vs minimum ${inp.risk.minLiquidityScore}` });
    const unhShare = 1 - inp.deal.hedgeRatio;
    const riskOk = unhShare <= inp.risk.maxUnhedgedShare + 1e-12 && (risk.esPctOfNotional === null || risk.esPctOfNotional <= inp.risk.maxFxEsPctOfNotional);
    gates.push({ name: "Risk limits", pass: riskOk, detail: `unhedged ${(unhShare * 100).toFixed(0)}% (max ${(inp.risk.maxUnhedgedShare * 100).toFixed(0)}%)${risk.esPctOfNotional !== null ? `, FX ES ${(risk.esPctOfNotional * 100).toFixed(1)}% of notional` : ""}` });
    gates.push({ name: "Validators (sign, FX, CCS, units…)", pass: crit.length === 0, detail: crit.length ? crit.map((c) => c.name).join(", ") : "All critical validators pass" });

    const reasons: string[] = [];
    const tags: string[] = [];
    let status: Status;
    if (crit.length) {
      status = "MODEL_VALIDATION_FAILED";
      reasons.push(`Model validation failed: ${crit.map((c) => c.name).join(", ")} — no execution signal generated`);
    } else if (eExec.arbitrage < 0) {
      status = "AVOID";
      reasons.push("Executable effective INR cost is above the INR alternative");
    } else if (regulatory === "NOT_ELIGIBLE" || liquidityScore < inp.risk.minLiquidityScore || !riskOk) {
      status = "AVOID";
      tags.push("THEORETICALLY CHEAP BUT NOT EXECUTABLE");
      if (regulatory === "NOT_ELIGIBLE") reasons.push("Regulatory check failed");
      if (liquidityScore < inp.risk.minLiquidityScore) reasons.push("Liquidity below your minimum");
      if (!riskOk) reasons.push("Exceeds your risk limits");
    } else if (arbOk && quality.allExecutable && regulatory !== "INSUFFICIENT_INFORMATION") {
      status = "EXECUTE";
      if (regulatory !== "ELIGIBLE") tags.push("CONFIRM REGULATORY");
    } else {
      status = "WATCH";
      if (!arbOk) reasons.push("Positive but below your minimum saving");
      if (!quality.allExecutable) {
        tags.push(quality.theoretical ? "THEORETICAL ARBITRAGE ONLY — DEALER QUOTE REQUIRED" : "INDICATIVE / STALE DATA");
        reasons.push(quality.theoretical ? "Inputs are illustrative/model-derived — get firm dealer quotes" : "Refresh quotes: some inputs are not firm or are stale");
      }
      if (regulatory === "INSUFFICIENT_INFORMATION") reasons.push("Regulatory information incomplete");
    }
    if (ex.couponsUnhedged) tags.push("USD INTEREST UNHEDGED");
    if (ex.residualExposure.length) tags.push("OPEN FX EXPOSURE");

    // economic confidence: does the saving survive a modest adverse move (+25 bp spread and +25 bp basis)?
    const stressed = evalRoute(inp, spec, "exec", { spreadBp: 25, basisBp: 25 });
    const stressedArb = stressed.irr === null ? null : altIrr - stressed.irr;
    const economic: Level = stressedArb !== null && stressedArb >= inp.deal.minSaving ? "HIGH" : stressedArb !== null && stressedArb >= 0 ? "MEDIUM" : "LOW";
    const regLevel: Level = regulatory === "ELIGIBLE" ? "HIGH" : regulatory === "POTENTIALLY_ELIGIBLE" ? "MEDIUM" : "LOW";
    const execLevel: Level = quality.allExecutable ? (ex.couponsUnhedged ? "MEDIUM" : "HIGH") : quality.theoretical || quality.stale.length ? "LOW" : "MEDIUM";
    const model: Level = crit.length ? "LOW" : "HIGH";
    const confidence: Confidence = { data: quality.dataScore, economic, regulatory: regLevel, execution: execLevel, model, overall: minLevel(quality.dataScore, economic, regLevel, execLevel, model) };

    results.push({
      ...base,
      status,
      tags,
      reasons,
      missing: [],
      warnings: ex.warnings,
      mid: eMid,
      exec: eExec,
      slippage: ex.irr - mid.irr,
      fcyRate: ex.fcyRate,
      maxSpread,
      maxHedgeCost: maxHedge,
      gates,
      validators,
      confidence,
      penalties: pen,
      rac: ex.irr + pen.total,
      fxRisk: risk,
      explain: explainRoute(inp, ex, mid, eExec, rbiBenefit),
      evalExec: ex,
      evalMid: mid,
    });
  }

  const ok = results.filter((r) => r.exec && r.mid);
  const notBlocked = ok.filter((r) => r.status !== "MODEL_VALIDATION_FAILED" && r.regulatory !== "NOT_ELIGIBLE");
  const ranking = {
    theoretical: [...ok].sort((a, b) => (a.mid as Econ).effective - (b.mid as Econ).effective).map((r) => r.id),
    executable: notBlocked.filter((r) => r.quality.allExecutable).sort((a, b) => (a.exec as Econ).effective - (b.exec as Econ).effective).map((r) => r.id),
    riskAdjusted: notBlocked.sort((a, b) => (a.rac as number) - (b.rac as number)).map((r) => r.id),
  };
  const byId = new Map(results.map((r) => [r.id, r]));
  const best = (ranking.executable[0] ? byId.get(ranking.executable[0]) : ranking.riskAdjusted[0] ? byId.get(ranking.riskAdjusted[0]) : ranking.theoretical[0] ? byId.get(ranking.theoretical[0]) : null) ?? null;

  const { carry, directUsdIrr } = carryTables(inp, ok, altIrr);
  if (altIrr === null) warnings.push(`INR alternative: ${alt.missing.join("; ") || "no valid cash-flow structure"} — enter the domestic rate you would otherwise pay.`);
  return { modelVersion: MODEL_VERSION, asOf: inp.nowIso, modeLabel, inrAlt: alt, inrAltIrr: altIrr, inrAltMissing: alt.missing, routes: results, ranking, best, ecb, swap: swapA, carry, directUsdIrr, warnings };
}

/** USD carry (foreign→USD vs direct USD), INR carry (foreign→INR direct / via USD) and the cross-path advantage. */
export function carryTables(inp: CarryInputs, okRoutes: RouteResult[], altIrr: number | null): { carry: CarryRow[]; directUsdIrr: number | null } {
  const directUsd = evalDirectLoan(inp, USD);
  const usdRoutes = enumerateRoutes(inp, { target: USD });
  const ccys = [...new Set(usdRoutes.map((r) => r.start))];
  const rows: CarryRow[] = [];
  for (const c of ccys) {
    const rs = usdRoutes.filter((r) => r.start === c);
    let bestMid: number | null = null;
    let bestExec: number | null = null;
    for (const r of rs) {
      const m = evalRoute(inp, r, "mid", {}, USD);
      const x = evalRoute(inp, r, "exec", {}, USD);
      if (m.irr !== null && (bestMid === null || m.irr < bestMid)) bestMid = m.irr;
      if (x.irr !== null && (bestExec === null || x.irr < bestExec)) bestExec = x.irr;
    }
    const mine = okRoutes.filter((r) => r.start === c && !r.usesRbi);
    const direct = mine.filter((r) => r.pathCcys.length === 2).sort((a, b) => (a.exec as Econ).effective - (b.exec as Econ).effective)[0];
    const viaUsd = mine.filter((r) => r.pathCcys.includes(USD) && r.pathCcys.length > 2).sort((a, b) => (a.exec as Econ).effective - (b.exec as Econ).effective)[0];
    const dIrr = directUsd.irr;
    rows.push({
      ccy: c,
      usdCarryMid: dIrr !== null && bestMid !== null ? dIrr - bestMid : null,
      usdCarryExec: dIrr !== null && bestExec !== null ? dIrr - bestExec : null,
      synthUsdExec: bestExec,
      inrCarryDirect: direct && altIrr !== null ? altIrr - (direct.exec as Econ).effective : null,
      inrCarryViaUsd: viaUsd && altIrr !== null ? altIrr - (viaUsd.exec as Econ).effective : null,
      inrDirectPath: direct ? direct.label : null,
      inrViaUsdPath: viaUsd ? viaUsd.label : null,
      crossPathAdvantage: direct && viaUsd ? (direct.exec as Econ).effective - (viaUsd.exec as Econ).effective : null,
    });
  }
  return { carry: rows, directUsdIrr: directUsd.irr };
}

export type { Mode };
