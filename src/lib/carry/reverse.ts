/**
 * Reverse / break-even engine. Every threshold is solved BACKWARDS through the full cash-flow model
 * (not a linear approximation): find the shock x so that  arbitrage(x) = target  by bisection.
 *   maximum lender spread, maximum hedge cost, maximum CCS/forward quote ("basis" headroom),
 *   break-even INR alternative, break-even amount and tenor.
 */
import type { CarryInputs, EdgeQuote, Shocks } from "./types";
import type { RouteSpec } from "./evaluate";
import { evalInrAlternative, evalRoute, attribute } from "./evaluate";
import { BP, bisect, isNum } from "./units";

export interface EdgeMax {
  edgeId: string;
  label: string;
  instrument: EdgeQuote["instrument"];
  /** current executable quote (CCS: fixed rate; forward: premium p.a.; cost: annual cost) */
  current: number;
  max: number;
  headroom: number;
}

export interface Reverse {
  ok: boolean;
  reason?: string;
  target: number;
  effective: number;
  arbitrage: number;
  maxSpread: { current: number; max: number; headroom: number; benchmarkPlusSpread: number } | null;
  breakEvenSpread: number | null;
  maxHedgeCost: { current: number; max: number; headroom: number } | null;
  edges: EdgeMax[];
  breakEvenInr: number | null;
  breakEvenInrZero: number | null;
  breakEvenAmountInr: number | null;
  breakEvenTenor: number | null;
}

function arb(inp: CarryInputs, route: RouteSpec, s: Shocks): number | null {
  const o = evalRoute(inp, route, "exec", s);
  const a = evalInrAlternative(inp, s);
  if (o.irr === null || a.irr === null) return null;
  return a.irr - o.irr;
}

/** Root x of arbitrage(x) - target over shock in bp (arbitrage is monotone in every shock used here). */
function solveShift(f: (x: number) => number | null, lo: number, hi: number): number | null {
  const g = (x: number) => {
    const v = f(x);
    return v === null ? NaN : v;
  };
  return bisect(g, lo, hi, 1e-10, 120);
}

export function reverseFor(inp: CarryInputs, route: RouteSpec, target = inp.deal.minSaving): Reverse {
  const base = evalRoute(inp, route, "exec");
  const alt = evalInrAlternative(inp);
  const blank: Reverse = { ok: false, target, effective: NaN, arbitrage: NaN, maxSpread: null, breakEvenSpread: null, maxHedgeCost: null, edges: [], breakEvenInr: null, breakEvenInrZero: null, breakEvenAmountInr: null, breakEvenTenor: null };
  if (base.irr === null || alt.irr === null) return { ...blank, reason: base.missing.concat(alt.missing).join("; ") || "no valid IRR" };
  const a0 = alt.irr - base.irr;
  const lender = inp.quotesByTenor[String(inp.deal.tenorYears)]?.lenders[route.start];
  const s0 = lender && isNum(lender.spread) ? lender.spread : 0;
  const bench = lender && isNum(lender.benchmarkRate) ? lender.benchmarkRate : 0;

  // maximum lender spread (executable economics)
  const xs = solveShift((x) => {
    const v = arb(inp, route, { spreadBp: x });
    return v === null ? null : v - target;
  }, -s0 / BP, 3000);
  const zs = solveShift((x) => arb(inp, route, { spreadBp: x }), -s0 / BP, 3000);
  const maxSpread = xs === null ? null : { current: s0, max: s0 + xs * BP, headroom: xs * BP, benchmarkPlusSpread: bench + s0 + xs * BP };

  // maximum total hedge cost (shift every edge equally; report the total across edges)
  const attr = attribute(base);
  const hedgeNow = attr.filter((l) => l.key.startsWith("hedge:")).reduce((s, l) => s + l.cost, 0);
  const nEdges = route.edges.length;
  const xh = nEdges === 0 ? null : solveShift((x) => {
    const v = arb(inp, route, { basisBp: x });
    return v === null ? null : v - target;
  }, -3000, 3000);
  const maxHedge = xh === null ? null : { current: hedgeNow, max: hedgeNow + xh * BP * nEdges, headroom: xh * BP * nEdges };

  // per-edge maximum quote (the "maximum CCS basis" of the spec)
  const edges: EdgeMax[] = [];
  for (const e of route.edges) {
    if (e.instrument === "RBI_SWAP") continue;
    const x = solveShift((z) => {
      const v = arb(inp, route, { basisBp: z, basisEdgeId: e.id });
      return v === null ? null : v - target;
    }, -3000, 3000);
    const cur = e.offer ?? e.bid;
    if (x === null || !isNum(cur)) continue;
    edges.push({ edgeId: e.id, label: `${e.from} → ${e.to} ${e.instrument}`, instrument: e.instrument, current: cur, max: cur + x * BP, headroom: x * BP });
  }

  // break-even INR alternative: the domestic rate at which the FCY route stops beating the hurdle
  const xi = solveShift((x) => {
    const v = arb(inp, route, { inrRateBp: x });
    return v === null ? null : v - target;
  }, -3000, 3000);
  const xi0 = solveShift((x) => arb(inp, route, { inrRateBp: x }), -3000, 3000);
  const inrRate = inp.inrAlt.rate;

  // break-even funding amount (only if fixed INR costs exist, otherwise amount does not matter)
  let breakEvenAmountInr: number | null = null;
  const fixed = inp.otherCosts.legalDocsInr + inp.otherCosts.isdaCsaInr + inp.otherCosts.registrationInr + inp.otherCosts.otherUpfrontInr + inp.otherCosts.agencyAnnualInr + inp.otherCosts.custodyAnnualInr + inp.otherCosts.otherAnnualInr;
  if (fixed > 0) {
    const f = (logN: number) => {
      const i2 = { ...inp, deal: { ...inp.deal, requirementInr: Math.exp(logN) } };
      const o = evalRoute(i2, route, "exec");
      const a = evalInrAlternative(i2);
      return o.irr !== null && a.irr !== null ? a.irr - o.irr - target : NaN;
    };
    const r = bisect(f, Math.log(1e6), Math.log(1e13), 1e-10, 120);
    breakEvenAmountInr = r === null ? null : Math.exp(r);
  }

  // break-even tenor, holding today's quotes constant
  let breakEvenTenor: number | null = null;
  const tq = inp.quotesByTenor[String(inp.deal.tenorYears)];
  if (tq) {
    const at = (T: number) => {
      const i2: CarryInputs = { ...inp, deal: { ...inp.deal, tenorYears: T }, quotesByTenor: { ...inp.quotesByTenor, [String(T)]: tq } };
      const o = evalRoute(i2, route, "exec");
      const a = evalInrAlternative(i2);
      return o.irr !== null && a.irr !== null ? a.irr - o.irr - target : NaN;
    };
    const lo = 1;
    const hi = 15;
    const r = bisect(at, lo, hi, 1e-6, 60);
    breakEvenTenor = r;
  }

  return {
    ok: true,
    target,
    effective: base.irr,
    arbitrage: a0,
    maxSpread,
    breakEvenSpread: zs === null ? null : s0 + zs * BP,
    maxHedgeCost: maxHedge,
    edges,
    breakEvenInr: xi !== null && isNum(inrRate) ? inrRate + xi * BP : null,
    breakEvenInrZero: xi0 !== null && isNum(inrRate) ? inrRate + xi0 * BP : null,
    breakEvenAmountInr,
    breakEvenTenor,
  };
}

export type Dim = "spread" | "hedge" | "inr" | "basis" | "tenor";

export interface Grid {
  xDim: Dim;
  yDim: Dim;
  xs: number[];
  ys: number[];
  /** arbitrage (decimal) per [y][x]; null = not computable */
  z: (number | null)[][];
}

function applyDim(inp: CarryInputs, dim: Dim, v: number, s: Shocks, route: RouteSpec): { inp: CarryInputs; s: Shocks } {
  const cur = { ...s };
  if (dim === "spread") {
    const s0 = inp.quotesByTenor[String(inp.deal.tenorYears)]?.lenders[route.start]?.spread ?? 0;
    cur.spreadBp = ((cur.spreadBp ?? 0) * BP + (v - s0)) / BP;
  } else if (dim === "hedge") {
    const e = route.edges[route.edges.length - 1];
    const q = e ? (e.offer ?? e.bid) : null;
    const benchFrom = e ? (inp.quotesByTenor[String(inp.deal.tenorYears)]?.lenders[e.from]?.benchmarkRate ?? 0) : 0;
    const curH = q === null ? 0 : e.instrument === "CCS" ? q - benchFrom : q;
    cur.basisEdgeId = e?.id;
    cur.basisBp = (cur.basisBp ?? 0) + (v - curH) / BP;
  } else if (dim === "inr") {
    cur.inrRateBp = (v - (inp.inrAlt.rate ?? 0)) / BP;
  } else if (dim === "basis") {
    cur.basisBp = (cur.basisBp ?? 0) + v / BP;
    cur.basisEdgeId = undefined;
  } else if (dim === "tenor") {
    const tq = inp.quotesByTenor[String(inp.deal.tenorYears)];
    return { inp: { ...inp, deal: { ...inp.deal, tenorYears: v }, quotesByTenor: { ...inp.quotesByTenor, [String(v)]: inp.quotesByTenor[String(v)] ?? tq } }, s: cur };
  }
  return { inp, s: cur };
}

/** Multidimensional sensitivity: 2-D heat-map of arbitrage over any two of five dimensions. */
export function sensitivityGrid(inp: CarryInputs, route: RouteSpec, xDim: Dim, xs: number[], yDim: Dim, ys: number[]): Grid {
  const z: (number | null)[][] = [];
  for (const y of ys) {
    const row: (number | null)[] = [];
    for (const x of xs) {
      const a = applyDim(inp, xDim, x, {}, route);
      const b = applyDim(a.inp, yDim, y, a.s, route);
      row.push(arb(b.inp, route, b.s));
    }
    z.push(row);
  }
  return { xDim, yDim, xs, ys, z };
}
