/**
 * Portfolio-level tools built on the deterministic route engine: natural hedge, optimal hedge ratio,
 * liability portfolio, multi-currency optimizer, tenor optimizer / funding curves, bank quote comparator,
 * negotiation. Nothing here executes anything: the application is ANALYSIS ONLY.
 */
import type { CarryInputs, Ccy, EdgeQuote, HedgeInstrument } from "./types";
import type { RouteSpec } from "./evaluate";
import { evalInrAlternative, evalRoute } from "./evaluate";
import { analyze, carryTables, type Analysis, type Level, type RouteResult } from "./analyze";
import { aggregate, irr } from "./cashflow";
import { enumerateRoutes } from "./routes";
import { fxRisk, penalties, PENALTY } from "./risk";
import { emptyEdge, meta } from "./defaults";
import { BP, bisect, isNum, normInv } from "./units";
import { INR } from "./currencies";

/* ------------------------------ natural hedge ------------------------------ */

export type ExposureKind = "export_receivable" | "fcy_asset" | "foreign_investment" | "overseas_subsidiary" | "import_payable" | "existing_fcy_debt";

export interface ExposureItem {
  id: string;
  kind: ExposureKind;
  ccy: Ccy;
  /** amount in `ccy` units, always entered as a positive number */
  amount: number;
}

const ASSET_KINDS: ExposureKind[] = ["export_receivable", "fcy_asset", "foreign_investment", "overseas_subsidiary"];

export interface NaturalHedgeRow {
  ccy: Ccy;
  assets: number;
  liabilities: number;
  newFunding: number;
  grossLiability: number;
  naturalHedge: number;
  existingHedges: number;
  residualRequirement: number;
  netExposure: number;
  surplusAsset: number;
}

/** Assets are +, liabilities are -: residual hedge requirement = net liability after natural offset and existing hedges. Never hedge twice. */
export function naturalHedge(items: ExposureItem[], newFunding: Record<Ccy, number>, existingHedges: Record<Ccy, number> = {}): NaturalHedgeRow[] {
  const ccys = new Set<Ccy>([...items.map((i) => i.ccy), ...Object.keys(newFunding)]);
  const rows: NaturalHedgeRow[] = [];
  for (const c of ccys) {
    const assets = items.filter((i) => i.ccy === c && ASSET_KINDS.includes(i.kind)).reduce((s, i) => s + i.amount, 0);
    const liabilities = items.filter((i) => i.ccy === c && !ASSET_KINDS.includes(i.kind)).reduce((s, i) => s + i.amount, 0);
    const nf = newFunding[c] ?? 0;
    const gross = liabilities + nf;
    const net = assets - gross; // negative = net liability
    const natural = Math.min(assets, gross);
    const hedged = existingHedges[c] ?? 0;
    const residual = Math.max(0, gross - natural - hedged);
    rows.push({ ccy: c, assets, liabilities, newFunding: nf, grossLiability: gross, naturalHedge: natural, existingHedges: hedged, residualRequirement: residual, netExposure: net, surplusAsset: Math.max(0, assets - gross) });
  }
  return rows.sort((a, b) => a.ccy.localeCompare(b.ccy));
}

/** Hedge ratio for the NEW loan implied by the natural hedge of its currency (0..1). */
export function requiredHedgeRatio(row: NaturalHedgeRow | undefined): number | null {
  if (!row || row.newFunding <= 0) return null;
  return Math.max(0, Math.min(1, row.residualRequirement / row.newFunding));
}

/* --------------------------- optimal hedge ratio --------------------------- */

export interface HedgeRatioRow {
  ratio: number;
  effective: number | null;
  esPct: number | null;
  rac: number | null;
  allowed: boolean;
}

export function optimalHedgeRatio(inp: CarryInputs, route: RouteSpec, ratios = [0, 0.25, 0.5, 0.75, 0.9, 1]): { rows: HedgeRatioRow[]; best: HedgeRatioRow | null } {
  const rows: HedgeRatioRow[] = [];
  for (const r of ratios) {
    const i2: CarryInputs = { ...inp, deal: { ...inp.deal, hedgeRatio: r } };
    const o = evalRoute(i2, route, "exec");
    if (o.irr === null) {
      rows.push({ ratio: r, effective: null, esPct: null, rac: null, allowed: false });
      continue;
    }
    const fr = fxRisk(i2, o);
    const pen = penalties(i2, route, o);
    const allowed = 1 - r <= inp.risk.maxUnhedgedShare + 1e-12 && (fr.esPctOfNotional === null || fr.esPctOfNotional <= inp.risk.maxFxEsPctOfNotional);
    rows.push({ ratio: r, effective: o.irr, esPct: fr.esPctOfNotional, rac: o.irr + pen.total, allowed });
  }
  const ok = rows.filter((r) => r.allowed && r.rac !== null);
  const best = ok.length ? ok.reduce((a, b) => ((a.rac as number) <= (b.rac as number) ? a : b)) : null;
  return { rows, best };
}

/* ------------------------------ liability book ------------------------------ */

export interface Liability {
  id: string;
  label: string;
  ccy: Ccy;
  amountInr: number;
  effectiveCost: number;
  remainingYears: number;
  hedgedShare: number;
}

export interface BookStats {
  total: number;
  cost: number;
  duration: number;
  unhedgedInr: number;
  fxVarUndiversified: number | null;
  fxVarZeroCorr: number | null;
  ladder: { year: number; amountInr: number }[];
  byCcy: { ccy: Ccy; amountInr: number; unhedgedInr: number }[];
}

export function bookStats(inp: CarryInputs, book: Liability[]): BookStats {
  const total = book.reduce((s, l) => s + l.amountInr, 0);
  const cost = total > 0 ? book.reduce((s, l) => s + l.amountInr * l.effectiveCost, 0) / total : 0;
  const duration = total > 0 ? book.reduce((s, l) => s + l.amountInr * l.remainingYears, 0) / total : 0;
  const z = normInv(inp.risk.confidence);
  const sdH = Math.sqrt(inp.risk.horizonDays / 252);
  let allVol = true;
  let sum = 0;
  let sq = 0;
  const byCcy = new Map<Ccy, { amountInr: number; unhedgedInr: number }>();
  for (const l of book) {
    const un = l.ccy === INR ? 0 : l.amountInr * (1 - l.hedgedShare);
    const cur = byCcy.get(l.ccy) ?? { amountInr: 0, unhedgedInr: 0 };
    cur.amountInr += l.amountInr;
    cur.unhedgedInr += un;
    byCcy.set(l.ccy, cur);
  }
  for (const [c, v] of byCcy) {
    if (c === INR || v.unhedgedInr === 0) continue;
    const vol = inp.risk.fxVol[c];
    if (!isNum(vol)) {
      allVol = false;
      continue;
    }
    const x = v.unhedgedInr * vol * sdH * z;
    sum += x;
    sq += x * x;
  }
  const buckets = new Map<number, number>();
  for (const l of book) {
    const y = Math.max(1, Math.ceil(l.remainingYears));
    buckets.set(y, (buckets.get(y) ?? 0) + l.amountInr);
  }
  return {
    total,
    cost,
    duration,
    unhedgedInr: [...byCcy.values()].reduce((s, v) => s + v.unhedgedInr, 0),
    fxVarUndiversified: allVol ? sum : null,
    fxVarZeroCorr: allVol ? Math.sqrt(sq) : null,
    ladder: [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([year, amountInr]) => ({ year, amountInr })),
    byCcy: [...byCcy.entries()].map(([ccy, v]) => ({ ccy, ...v })),
  };
}

export interface BookVerdict {
  before: BookStats;
  after: BookStats;
  metrics: { name: string; before: number | null; after: number | null; better: boolean | null; unit: string }[];
  improves: boolean | null;
}

export function assessNewFunding(inp: CarryInputs, book: Liability[], candidate: Liability): BookVerdict {
  const before = bookStats(inp, book);
  const after = bookStats(inp, [...book, candidate]);
  const conc = (s: BookStats) => (s.total > 0 ? Math.max(...s.ladder.map((l) => l.amountInr)) / s.total : 0);
  const metrics: BookVerdict["metrics"] = [
    { name: "Average funding cost", before: before.cost, after: after.cost, better: after.cost < before.cost, unit: "%" },
    { name: "Unhedged FX exposure (INR)", before: before.unhedgedInr, after: after.unhedgedInr, better: after.unhedgedInr <= before.unhedgedInr, unit: "INR" },
    { name: "FX VaR (undiversified)", before: before.fxVarUndiversified, after: after.fxVarUndiversified, better: before.fxVarUndiversified !== null && after.fxVarUndiversified !== null ? after.fxVarUndiversified <= before.fxVarUndiversified * 1.0001 : null, unit: "INR" },
    { name: "Weighted duration (years)", before: before.duration, after: after.duration, better: null, unit: "y" },
    { name: "Largest single-year maturity share", before: conc(before), after: conc(after), better: conc(after) <= conc(before) + 1e-12, unit: "%" },
  ];
  const decided = metrics.filter((m) => m.better !== null);
  return { before, after, metrics, improves: decided.length ? decided.every((m) => m.better) : null };
}

/* ------------------------- multi-currency optimizer ------------------------- */

export type Objective = "lowest_cost" | "max_saving" | "lowest_risk" | "max_certainty" | "min_fx_exposure" | "balanced";

const CONF_SCORE: Record<Level, number> = { HIGH: 1, MEDIUM: 0.6, LOW: 0.2 };

export interface Candidate {
  key: string;
  label: string;
  ccy: Ccy;
  effective: number;
  penalty: number;
  liquidity: number;
  esPct: number;
  unhedged: number;
  certainty: number;
  result: RouteResult;
}

export interface Allocation {
  weights: Record<string, number>;
  cost: number;
  penalty: number;
  concentration: number;
  liquidity: number;
  esPct: number;
  score: number;
  exactIrr: number | null;
}

export function candidatesFrom(inp: CarryInputs, a: Analysis): Candidate[] {
  const bestByCcy = new Map<Ccy, RouteResult>();
  for (const r of a.routes) {
    if (!r.exec || r.status === "MODEL_VALIDATION_FAILED" || r.regulatory === "NOT_ELIGIBLE" || r.status === "INSUFFICIENT_DATA") continue;
    const cur = bestByCcy.get(r.start);
    if (!cur || (r.rac as number) < (cur.rac as number)) bestByCcy.set(r.start, r);
  }
  const out: Candidate[] = [];
  for (const [ccy, r] of bestByCcy)
    out.push({
      key: r.id,
      label: r.label,
      ccy,
      effective: (r.exec as NonNullable<typeof r.exec>).effective,
      penalty: (r.penalties as NonNullable<typeof r.penalties>).total,
      liquidity: r.liquidityScore,
      esPct: r.fxRisk?.esPctOfNotional ?? 0,
      unhedged: r.fxRisk?.unhedgedShare ?? 0,
      certainty: CONF_SCORE[r.confidence.overall],
      result: r,
    });
  return out.sort((a, b) => a.effective - b.effective).slice(0, 6);
}

function composition(n: number, k: number): number[][] {
  // all ways to write n as an ordered sum of k non-negative ints
  const out: number[][] = [];
  const rec = (left: number, idx: number, cur: number[]) => {
    if (idx === k - 1) {
      out.push([...cur, left]);
      return;
    }
    for (let x = 0; x <= left; x++) rec(left - x, idx + 1, [...cur, x]);
  };
  rec(n, 0, []);
  return out;
}

export interface OptimizeResult {
  candidates: Candidate[];
  lowestCost: Allocation | null;
  lowestRisk: Allocation | null;
  balanced: Allocation | null;
  selected: Allocation | null;
  objective: Objective;
  infeasible: boolean;
}

export function optimizePortfolio(inp: CarryInputs, a: Analysis, objective: Objective, stepPct = 5): OptimizeResult {
  const cands = candidatesFrom(inp, a);
  if (cands.length === 0) return { candidates: [], lowestCost: null, lowestRisk: null, balanced: null, selected: null, objective, infeasible: true };
  const n = Math.round(100 / stepPct);
  const maxShare = inp.risk.maxSingleCurrencyShare;
  const feasible: Allocation[] = [];
  for (const comp of composition(n, cands.length)) {
    const w = comp.map((x) => x / n);
    if (Math.max(...w) > maxShare + 1e-12 && cands.length * maxShare >= 1) continue;
    const cost = w.reduce((s, x, i) => s + x * cands[i].effective, 0);
    const pen = w.reduce((s, x, i) => s + x * cands[i].penalty, 0);
    const liq = w.reduce((s, x, i) => s + x * cands[i].liquidity, 0);
    const es = w.reduce((s, x, i) => s + x * cands[i].esPct, 0);
    const hhi = w.reduce((s, x) => s + x * x, 0);
    if (liq < inp.risk.minLiquidityScore - 1e-12) continue;
    if (es > inp.risk.maxFxEsPctOfNotional + 1e-12) continue;
    const unh = w.reduce((s, x, i) => s + x * cands[i].unhedged, 0);
    if (unh > inp.risk.maxUnhedgedShare + 1e-12) continue;
    const weights: Record<string, number> = {};
    cands.forEach((c, i) => (weights[c.key] = w[i]));
    feasible.push({ weights, cost, penalty: pen, concentration: hhi, liquidity: liq, esPct: es, score: 0, exactIrr: null });
  }
  if (!feasible.length) return { candidates: cands, lowestCost: null, lowestRisk: null, balanced: null, selected: null, objective, infeasible: true };
  const certOf = (al: Allocation) => cands.reduce((s, c) => s + (al.weights[c.key] ?? 0) * c.certainty, 0);
  const unhOf = (al: Allocation) => cands.reduce((s, c) => s + (al.weights[c.key] ?? 0) * c.unhedged, 0);
  const scoreOf = (al: Allocation, obj: Objective): number => {
    switch (obj) {
      case "lowest_cost":
      case "max_saving":
        return al.cost;
      case "lowest_risk":
        return al.penalty + al.esPct + PENALTY.concentration * al.concentration + (1 - al.liquidity) * 0.01 + al.cost * 1e-3;
      case "max_certainty":
        return -certOf(al) + al.cost * 10;
      case "min_fx_exposure":
        return unhOf(al) + al.cost * 1e-3;
      case "balanced":
        return al.cost + al.penalty + PENALTY.concentration * al.concentration;
    }
  };
  const pick = (obj: Objective) => {
    let best = feasible[0];
    let bs = scoreOf(best, obj);
    for (const f of feasible) {
      const s = scoreOf(f, obj);
      if (s < bs) {
        best = f;
        bs = s;
      }
    }
    return { ...best, score: bs };
  };
  const exact = (al: Allocation): Allocation => {
    const flows = new Map<number, number>();
    for (const c of cands) {
      const w = al.weights[c.key] ?? 0;
      if (w === 0 || !c.result.evalExec) continue;
      for (const f of aggregate(c.result.evalExec.entries, INR)) flows.set(f.t, (flows.get(f.t) ?? 0) + w * f.amount);
    }
    const res = irr([...flows.entries()].map(([t, amount]) => ({ t, amount })).sort((x, y) => x.t - y.t));
    return { ...al, exactIrr: res.ok ? res.rate : null };
  };
  return {
    candidates: cands,
    lowestCost: exact(pick("lowest_cost")),
    lowestRisk: exact(pick("lowest_risk")),
    balanced: exact(pick("balanced")),
    selected: exact(pick(objective)),
    objective,
    infeasible: false,
  };
}

/* ------------------------- tenor optimizer / curves ------------------------- */

export interface TenorPoint {
  tenor: number;
  inrAlt: number | null;
  directUsd: number | null;
  best: { label: string; effective: number; arbitrage: number; status: string; instrument: string } | null;
  byCcy: Record<Ccy, number | null>;
  syntheticUsd: Record<Ccy, number | null>;
  usdCarry: Record<Ccy, number | null>;
}

export interface TenorConstraints {
  minTenor: number;
  maxTenor: number;
}

export function tenorCurves(inp: CarryInputs, cons: TenorConstraints = { minTenor: 0, maxTenor: 99 }): { points: TenorPoint[]; best: TenorPoint | null; crossings: { ccy: Ccy; tenor: number }[] } {
  const tenors = Object.keys(inp.quotesByTenor).map(Number).filter((t) => Number.isFinite(t) && t >= cons.minTenor && t <= cons.maxTenor).sort((a, b) => a - b);
  const points: TenorPoint[] = [];
  for (const t of tenors) {
    const i2: CarryInputs = { ...inp, deal: { ...inp.deal, tenorYears: t } };
    const a = analyze(i2);
    const byCcy: Record<Ccy, number | null> = {};
    for (const r of a.routes) if (r.exec && r.pathCcys.length === 2) byCcy[r.start] = Math.min(byCcy[r.start] ?? Infinity, r.exec.effective);
    const ok = a.routes.filter((r) => r.exec && r.status !== "MODEL_VALIDATION_FAILED" && r.regulatory !== "NOT_ELIGIBLE");
    const bestR = ok.sort((x, y) => (x.rac as number) - (y.rac as number))[0];
    const { carry, directUsdIrr } = carryTables(i2, a.routes.filter((r) => r.exec), a.inrAltIrr);
    const synth: Record<Ccy, number | null> = {};
    const uc: Record<Ccy, number | null> = {};
    for (const c of carry) {
      synth[c.ccy] = c.synthUsdExec;
      uc[c.ccy] = c.usdCarryExec;
    }
    points.push({
      tenor: t,
      inrAlt: a.inrAltIrr,
      directUsd: directUsdIrr,
      best: bestR && bestR.exec ? { label: bestR.label, effective: bestR.exec.effective, arbitrage: bestR.exec.arbitrage, status: bestR.status, instrument: bestR.route.edges.map((e) => e.instrument).join(" + ") } : null,
      byCcy,
      syntheticUsd: synth,
      usdCarry: uc,
    });
  }
  const scored = points.filter((p) => p.best);
  const best = scored.length ? scored.reduce((a, b) => ((a.best as NonNullable<typeof a.best>).arbitrage >= (b.best as NonNullable<typeof b.best>).arbitrage ? a : b)) : null;
  const crossings: { ccy: Ccy; tenor: number }[] = [];
  const ccys = new Set<Ccy>(points.flatMap((p) => Object.keys(p.byCcy)));
  for (const c of ccys) {
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const a0 = p0.inrAlt !== null && isNum(p0.byCcy[c]) ? p0.inrAlt - (p0.byCcy[c] as number) : null;
      const a1 = p1.inrAlt !== null && isNum(p1.byCcy[c]) ? p1.inrAlt - (p1.byCcy[c] as number) : null;
      if (a0 !== null && a1 !== null && a0 * a1 < 0) crossings.push({ ccy: c, tenor: p0.tenor + ((p1.tenor - p0.tenor) * a0) / (a0 - a1) });
    }
  }
  return { points, best, crossings };
}

/* -------------------------- bank quote comparator -------------------------- */

export interface BankQuote {
  id: string;
  bank: string;
  ccy: Ccy;
  spread: number | null;
  upfrontFeePct: number | null;
  ongoingFeeBp: number | null;
  hedgeInstrument: HedgeInstrument;
  hedgeBid: number | null;
  hedgeOffer: number | null;
  quotedAt: string | null;
}

export type CompareMetric = "effective" | "saving" | "headroom" | "maxSpread";

export interface BankResult {
  quote: BankQuote;
  ok: boolean;
  missing: string[];
  effective: number | null;
  saving: number | null;
  headroom: number | null;
  annualSavingInr: number | null;
  maxAcceptableSpread: number | null;
  spreadHeadroomBp: number | null;
  rank: number | null;
}

export function compareBankQuotes(inp: CarryInputs, quotes: BankQuote[], metric: CompareMetric = "effective"): BankResult[] {
  const alt = evalInrAlternative(inp);
  const key = String(inp.deal.tenorYears);
  const out: BankResult[] = [];
  for (const q of quotes) {
    const tq = inp.quotesByTenor[key];
    if (!tq) {
      out.push({ quote: q, ok: false, missing: ["Market quotes for this tenor (benchmark swap rates)"], effective: null, saving: null, headroom: null, annualSavingInr: null, maxAcceptableSpread: null, spreadHeadroomBp: null, rank: null });
      continue;
    }
    const c = structuredClone(inp);
    const t2 = c.quotesByTenor[key];
    const stamp = meta("USER_INPUT", "A", q.quotedAt ?? inp.nowIso);
    const L = t2.lenders[q.ccy] ?? { ccy: q.ccy, benchmarkRate: null, spread: null, upfrontFeePct: null, ongoingFeeBp: null, structure: "floating" as const, meta: stamp };
    t2.lenders[q.ccy] = { ...L, spread: q.spread, upfrontFeePct: q.upfrontFeePct ?? L.upfrontFeePct, ongoingFeeBp: q.ongoingFeeBp ?? L.ongoingFeeBp, meta: stamp };
    const hasHedge = isNum(q.hedgeBid) || isNum(q.hedgeOffer);
    let spec: RouteSpec | undefined;
    if (hasHedge) {
      const e: EdgeQuote = { ...emptyEdge(q.ccy, INR, q.hedgeInstrument, inp.nowIso), id: `bank:${q.id}`, bid: q.hedgeBid, offer: q.hedgeOffer, meta: stamp };
      spec = { id: `bank:${q.id}`, label: `${q.ccy} → INR (${q.bank})`, start: q.ccy, edges: [e] };
    } else {
      spec = enumerateRoutes(c).find((r) => r.start === q.ccy && r.edges.length === 1 && r.edges[0].to === INR);
    }
    if (!spec) {
      out.push({ quote: q, ok: false, missing: [`${q.ccy}→INR hedge quote`], effective: null, saving: null, headroom: null, annualSavingInr: null, maxAcceptableSpread: null, spreadHeadroomBp: null, rank: null });
      continue;
    }
    const o = evalRoute(c, spec, "exec");
    if (o.irr === null || alt.irr === null) {
      out.push({ quote: q, ok: false, missing: [...o.missing, ...alt.missing], effective: null, saving: null, headroom: null, annualSavingInr: null, maxAcceptableSpread: null, spreadHeadroomBp: null, rank: null });
      continue;
    }
    const saving = alt.irr - o.irr;
    const s0 = q.spread ?? 0;
    const f = (x: number) => {
      const o2 = evalRoute(c, spec as RouteSpec, "exec", { spreadBp: x });
      return o2.irr === null ? NaN : (alt.irr as number) - o2.irr - inp.deal.minSaving;
    };
    const r = bisect(f, -s0 / BP, 3000, 1e-9, 80);
    const maxSpread = r === null ? null : s0 + r * BP;
    out.push({ quote: q, ok: true, missing: [], effective: o.irr, saving, headroom: saving - inp.deal.minSaving, annualSavingInr: inp.deal.requirementInr * saving, maxAcceptableSpread: maxSpread, spreadHeadroomBp: r, rank: null });
  }
  const ok = out.filter((r) => r.ok);
  const val = (r: BankResult) => (metric === "effective" ? (r.effective as number) : metric === "saving" ? -(r.saving as number) : metric === "headroom" ? -(r.headroom as number) : -(r.maxAcceptableSpread ?? -1));
  ok.sort((a, b) => val(a) - val(b)).forEach((r, i) => (r.rank = i + 1));
  return out;
}

export interface Negotiation {
  bestQuote: BankResult | null;
  maxAcceptableSpread: number | null;
  headroomBp: number | null;
  targetSpread: number | null;
  walkAway: number | null;
  note: string;
}

/** Negotiation: best executable quote vs the walk-away spread. Suggested target = beat the best quote by `stepBp`. */
export function negotiation(results: BankResult[], stepBp = 5): Negotiation {
  const ok = results.filter((r) => r.ok && r.quote.spread !== null);
  if (!ok.length) return { bestQuote: null, maxAcceptableSpread: null, headroomBp: null, targetSpread: null, walkAway: null, note: "Enter at least one complete bank quote." };
  const best = ok.reduce((a, b) => ((a.effective as number) <= (b.effective as number) ? a : b));
  const max = best.maxAcceptableSpread;
  const head = max !== null && best.quote.spread !== null ? (max - best.quote.spread) / BP : null;
  const target = best.quote.spread !== null ? Math.max(0, best.quote.spread - stepBp * BP) : null;
  return {
    bestQuote: best,
    maxAcceptableSpread: max,
    headroomBp: head,
    targetSpread: target,
    walkAway: max,
    note: head !== null && head < 0 ? "Even the best quote is above your maximum acceptable spread: negotiate down or switch structure." : "Suggested target = best competing quote minus the step; walk away above the maximum acceptable spread. Heuristic, not advice.",
  };
}

