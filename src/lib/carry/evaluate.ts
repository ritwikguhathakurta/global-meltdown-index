/**
 * Route evaluation: builds real multi-currency ledgers and derives the effective INR rate as an IRR.
 *
 * Conventions documented before implementation (docs/CARRY_ENGINE.md):
 *  Perspective: borrower. Cash flow sign: + received / - paid. Economic cost: positive numbers.
 *  Rates: decimal. Time axis: t = k / paymentFrequency (regular periods). Coupons accrue by the deal's day count.
 *  FX: bid/ask side is derived from direction (fx.ts). Forward premium p is annual, compounded: F(t) = spot * (1+p)^t.
 *  CCS: borrower receives the `from` leg (matching its liability) and pays a fixed rate in `to` =
 *       flat quote + (incoming rate - benchmark of `from`)   -- credit spread passes through 1:1 at rate level.
 *  Principal exchange at inception and maturity at the same executable spot rate.
 *  Fees: rate-level (% of principal) carried through CCS legs at inception spot; converted flow by flow on forward routes.
 *  Discounting: IRR only (annual effective); no external curve is needed because rates are dealer-quoted.
 */
import type { Ccy, CarryInputs, EdgeQuote, Entry, Kind, Mode, Part, Shocks } from "./types";
import type { Period } from "./schedule";
import { buildSchedule } from "./schedule";
import { buildFxTable, buyCost, convertRate, midRate, type FxTable } from "./fx";
import { aggregate, irr, pvByKey } from "./cashflow";
import { BP, isNum, ModelError } from "./units";
import { INR, USD } from "./currencies";

export interface RouteSpec {
  id: string;
  label: string;
  start: Ccy;
  edges: EdgeQuote[];
  /** For the RBI swap route only: market forward quote used to hedge coupons (RBI swap covers principal only). */
  rbiCoupon?: EdgeQuote | null;
}

interface Comp {
  kind: "bench" | "spread" | "hedge" | "fee" | "tax";
  tag?: string;
  rate: number;
}
interface Up {
  kind: "fee" | "tax" | "hedge";
  tag?: string;
  pct: number;
}
interface Shape {
  ccy: Ccy;
  N: number;
  interest: Comp[];
  ongoing: Comp[];
  upfront: Up[];
  /** term swap rate of the current currency's benchmark */
  bench: number;
}

export interface Notional {
  ccy: Ccy;
  amount: number;
}

export interface EvalOut {
  ok: boolean;
  target: Ccy;
  missing: string[];
  warnings: string[];
  mode: Mode;
  entries: Entry[];
  irr: number | null;
  irrCode?: string;
  notionals: Notional[];
  /** bench + spread of the starting loan (FCY all-in coupon) */
  fcyRate: number;
  hedgeAdd: number;
  residualExposure: Notional[];
  usesRbi: boolean;
  couponsUnhedged: boolean;
  sched: Period[];
}

const isCcsLike = (i: EdgeQuote["instrument"]) => i === "CCS" || i === "OPTION" || i === "COLLAR" || i === "HEDGE_COST";
const isFwdLike = (i: EdgeQuote["instrument"]) => i === "FX_FORWARD" || i === "FX_SWAP" || i === "NDF";

function bounds(a: number | null, b: number | null): [number, number] | null {
  const v = [a, b].filter(isNum) as number[];
  if (v.length === 0) return null;
  return [Math.min(...v), Math.max(...v)];
}

/** Cost-type quote (higher = worse for the borrower). exec = adverse side, widened by liquidity stress. */
function costPick(bid: number | null, offer: number | null, mode: Mode, widen = 0): number | null {
  const b = bounds(bid, offer);
  if (!b) return null;
  const mid = (b[0] + b[1]) / 2;
  if (mode === "mid") return mid;
  return mid + (b[1] - mid) * (1 + widen);
}

/** Forward premium when the borrower SELLS the currency forward (adverse = lower premium). */
function sellPremPick(bid: number | null, offer: number | null, mode: Mode, widen = 0): number | null {
  const b = bounds(bid, offer);
  if (!b) return null;
  const mid = (b[0] + b[1]) / 2;
  if (mode === "mid") return mid;
  return mid - (mid - b[0]) * (1 + widen);
}

const sumRate = (cs: Comp[]) => cs.reduce((s, c) => s + c.rate, 0);

function scale(sh: Shape, f: number): Shape {
  return { ...sh, N: sh.N * f };
}

function mk(
  ledger: string,
  p: Period | null,
  ccy: Ccy,
  amount: number,
  kind: Kind,
  part: Part,
  instrument: string,
  desc: string,
  tag?: string,
  modelled?: boolean,
  t0Date?: string
): Entry {
  return { ledger, t: p ? p.t : 0, date: p ? p.end : (t0Date ?? ""), ccy, amount, kind, part, tag, instrument, desc, modelled };
}

function shapeEntries(
  sh: Shape,
  sched: Period[],
  ledger: string,
  instrument: string,
  opts: { proceeds: boolean; costs: boolean; interest: boolean; principal: boolean }
): Entry[] {
  const out: Entry[] = [];
  const d0 = sched[0].start;
  if (opts.proceeds) out.push(mk(ledger, null, sh.ccy, sh.N, "principal", "P", instrument, "Drawdown / principal received", undefined, false, d0));
  if (opts.costs) {
    for (const u of sh.upfront) if (u.pct !== 0) out.push(mk(ledger, null, sh.ccy, -u.pct * sh.N, u.kind, "U", instrument, `Upfront ${u.kind}`, u.tag, false, d0));
  }
  for (const p of sched) {
    const base = sh.N * p.outstanding * p.accr;
    if (opts.interest) {
      for (const c of sh.interest) if (c.rate !== 0) out.push(mk(ledger, p, sh.ccy, -c.rate * base, c.kind, "I", instrument, `Interest: ${c.kind}`, c.tag));
    }
    if (opts.costs) {
      for (const c of sh.ongoing) if (c.rate !== 0) out.push(mk(ledger, p, sh.ccy, -c.rate * base, c.kind, "I", instrument, `Ongoing ${c.kind}`, c.tag));
    }
    if (opts.principal && p.principalFrac > 0) out.push(mk(ledger, p, sh.ccy, -sh.N * p.principalFrac, "principal", "P", instrument, "Principal repayment"));
  }
  return out;
}

function tenorQuotes(inp: CarryInputs) {
  return inp.quotesByTenor[String(inp.deal.tenorYears)] ?? null;
}

export function fixedCostEntries(inp: CarryInputs, sched: Period[]): Entry[] {
  const c = inp.otherCosts;
  const up = c.legalDocsInr + c.isdaCsaInr + c.registrationInr + c.otherUpfrontInr;
  const yr = c.agencyAnnualInr + c.custodyAnnualInr + c.otherAnnualInr;
  const out: Entry[] = [];
  if (up > 0) out.push(mk("Other costs", null, INR, -up, "fee", "U", "COST", "Legal / ISDA-CSA / registration (INR, upfront)", "fixed", false, sched[0].start));
  if (yr > 0) {
    for (const p of sched) out.push(mk("Other costs", p, INR, -(yr * p.accr), "fee", "I", "COST", "Agency / custody / other (INR, annual)", "fixed"));
  }
  return out;
}

export function shieldEntries(inp: CarryInputs, entries: Entry[]): Entry[] {
  const tau = inp.tax.mode === "included" ? inp.tax.interestShieldRate : 0;
  if (!(tau > 0)) return [];
  const byT = new Map<number, { amt: number; date: string }>();
  for (const e of entries) {
    if (e.ccy !== INR || e.part !== "I") continue;
    if (e.kind !== "bench" && e.kind !== "spread" && e.kind !== "hedge") continue;
    const cur = byT.get(e.t) ?? { amt: 0, date: e.date };
    cur.amt += e.amount;
    byT.set(e.t, cur);
  }
  const out: Entry[] = [];
  for (const [t, v] of byT) {
    if (v.amt < 0) out.push({ ledger: "Tax shield", t, date: v.date, ccy: INR, amount: -v.amt * tau, kind: "shield", part: "I", instrument: "TAX", desc: "Interest tax shield (user-defined rate)" });
  }
  return out;
}

function baseShape(inp: CarryInputs, start: Ccy, N: number, shocks: Shocks): { shape: Shape; missing: string[] } | { missing: string[] } {
  const q = tenorQuotes(inp);
  const missing: string[] = [];
  if (!q) return { missing: [`No quotes entered for the ${inp.deal.tenorYears}Y tenor`] };
  const L = q.lenders[start];
  if (!L) return { missing: [`Lender quote for ${start}`] };
  if (!isNum(L.benchmarkRate)) missing.push(`${start} benchmark swap rate`);
  if (!isNum(L.spread)) missing.push(`${start} lender spread`);
  if (isNum(L.spread) && L.spread < 0) missing.push(`${start} lender spread must not be negative`);
  if (missing.length) return { missing };
  const taxOn = inp.tax.mode === "included";
  const gst = taxOn ? inp.tax.gstOnFeesRate : 0;
  const spread = (L.spread as number) + (shocks.spreadBp ?? 0) * BP;
  const bench = L.benchmarkRate as number;
  const interest: Comp[] = [
    { kind: "bench", rate: bench },
    { kind: "spread", rate: spread },
  ];
  const ongoing: Comp[] = [];
  const upfront: Up[] = [];
  if (isNum(L.upfrontFeePct) && L.upfrontFeePct > 0) upfront.push({ kind: "fee", pct: L.upfrontFeePct * (1 + gst) });
  if (isNum(L.ongoingFeeBp) && L.ongoingFeeBp > 0) ongoing.push({ kind: "fee", rate: L.ongoingFeeBp * BP * (1 + gst) });
  if (taxOn) {
    if (inp.tax.stampDutyPct > 0) upfront.push({ kind: "tax", pct: inp.tax.stampDutyPct });
    if (inp.tax.guaranteeFeeBpPa > 0) ongoing.push({ kind: "fee", tag: "guarantee", rate: inp.tax.guaranteeFeeBpPa * BP });
    const w = inp.tax.whtRate;
    if (w > 0 && w < 1) ongoing.push({ kind: "tax", tag: "wht", rate: ((bench + spread) * w) / (1 - w) });
  }
  return { shape: { ccy: start, N, interest, ongoing, upfront, bench }, missing };
}

interface WalkCtx {
  inp: CarryInputs;
  sched: Period[];
  fx: FxTable;
  mode: Mode;
  shocks: Shocks;
  route: RouteSpec;
  entries: Entry[];
  missing: string[];
  warnings: string[];
  notionals: Notional[];
  hedgeAdd: number;
  usesRbi: boolean;
  couponsUnhedged: boolean;
  residual: Notional[];
}

function legs(
  ledger: string,
  sh: Shape,
  sched: Period[],
  instrument: string,
  sign: 1 | -1,
  opts: { proceeds: boolean }
): Entry[] {
  const out: Entry[] = [];
  const d0 = sched[0].start;
  if (opts.proceeds) out.push(mk(ledger, null, sh.ccy, sign * sh.N, "principal", "P", instrument, sign > 0 ? "Initial exchange: receive" : "Initial exchange: deliver", undefined, false, d0));
  for (const p of sched) {
    const base = sh.N * p.outstanding * p.accr;
    for (const c of sh.interest) if (c.rate !== 0) out.push(mk(ledger, p, sh.ccy, sign * c.rate * base, c.kind, "I", instrument, sign > 0 ? "Interest leg received" : "Interest leg paid", c.tag));
    if (p.principalFrac > 0) out.push(mk(ledger, p, sh.ccy, sign * sh.N * p.principalFrac, "principal", "P", instrument, sign > 0 ? "Principal exchange received" : "Principal exchange paid"));
  }
  return out;
}

function convertEntriesFwd(
  ctx: WalkCtx,
  src: Entry[],
  from: Ccy,
  to: Ccy,
  edge: EdgeQuote,
  ledger: string,
  opts: { r0: number }
): Entry[] | null {
  const { fx, mode, shocks } = ctx;
  const buyUnit = buyCost(fx, from, to);
  const sellUnit = convertRate(fx, from, to);
  if (buyUnit === null || sellUnit === null) {
    ctx.missing.push(`Spot ${from}/${to}`);
    return null;
  }
  const basis = (!shocks.basisEdgeId || shocks.basisEdgeId === edge.id ? (shocks.basisBp ?? 0) : 0) * BP;
  const pBuy = costPick(edge.bid, edge.offer, mode, shocks.liquidityWiden);
  const pSell = sellPremPick(edge.bid, edge.offer, mode, shocks.liquidityWiden);
  if (pBuy === null || pSell === null) {
    ctx.missing.push(`${edge.id}: forward premium quote`);
    return null;
  }
  const out: Entry[] = [];
  const inst = edge.instrument;
  for (const e of src) {
    const buying = e.amount < 0;
    const prem = (buying ? pBuy : pSell) + basis;
    const unit = (buying ? buyUnit : sellUnit) * Math.pow(1 + prem, e.t);
    const base = e.amount * opts.r0;
    const rem = e.amount * (unit - opts.r0);
    out.push({ ledger, t: e.t, date: e.date, ccy: from, amount: -e.amount, kind: e.kind, part: e.part, tag: e.tag, instrument: inst, desc: `${buying ? "Buy" : "Sell"} ${from} forward (offsets ${e.desc.toLowerCase()})` });
    out.push({ ledger, t: e.t, date: e.date, ccy: to, amount: base, kind: e.kind, part: e.part, tag: e.tag, instrument: inst, desc: `${to} leg at reference rate` });
    if (Math.abs(rem) > 0) out.push({ ledger, t: e.t, date: e.date, ccy: to, amount: rem, kind: "hedge", part: e.part, tag: edge.id, instrument: inst, desc: `Forward premium / hedge cost` });
  }
  return out;
}

function unhedgedConvert(ctx: WalkCtx, src: Entry[], from: Ccy, to: Ccy, r0: number, drift: number, fxShock: number): Entry[] | null {
  const buyUnit = buyCost(ctx.fx, from, to);
  const sellUnit = convertRate(ctx.fx, from, to);
  if (buyUnit === null || sellUnit === null) {
    ctx.missing.push(`Spot ${from}/${to}`);
    return null;
  }
  const out: Entry[] = [];
  for (const e of src) {
    const buying = e.amount < 0;
    const unit = buying ? buyUnit * Math.pow(1 + drift, e.t) * (e.t > 0 ? 1 + fxShock : 1) : sellUnit;
    out.push({ ledger: "Unhedged share (expected INR)", t: e.t, date: e.date, ccy: to, amount: e.amount * r0, kind: e.kind, part: e.part, tag: e.tag, instrument: "UNHEDGED", desc: "Expected INR equivalent (modelled, FX exposure open)", modelled: true });
    const rem = e.amount * (unit - r0);
    if (Math.abs(rem) > 0) out.push({ ledger: "Unhedged share (expected INR)", t: e.t, date: e.date, ccy: to, amount: rem, kind: "fx", part: e.part, instrument: "UNHEDGED", desc: "Expected FX move / spot spread on unhedged share", modelled: true });
  }
  return out;
}

export function evalRoute(inp: CarryInputs, route: RouteSpec, mode: Mode, shocks: Shocks = {}, target: Ccy = INR): EvalOut {
  const sched = buildSchedule({ ...inp.deal });
  const empty = (missing: string[]): EvalOut => ({ ok: false, target, missing, warnings: [], mode, entries: [], irr: null, notionals: [], fcyRate: 0, hedgeAdd: 0, residualExposure: [], usesRbi: false, couponsUnhedged: false, sched });
  const fx = buildFxTable(inp.spots, mode, shocks.liquidityWiden ?? 0);
  if (!(inp.deal.requirementInr > 0)) throw new ModelError("BAD_AMOUNT", "funding requirement must be positive");
  let R = inp.deal.requirementInr;
  if (target !== INR) {
    const k = midRate(buildFxTable(inp.spots, "mid"), INR, target);
    if (!isNum(k)) return empty([`Spot ${target}/INR (to size the ${target} comparison)`]);
    R = inp.deal.requirementInr * k;
  }
  if (route.edges.length === 0) return empty(["route has no conversion edge"]);

  const ctx: WalkCtx = { inp, sched, fx, mode, shocks, route, entries: [], missing: [], warnings: [], notionals: [], hedgeAdd: 0, usesRbi: false, couponsUnhedged: false, residual: [] };
  const q = tenorQuotes(inp);
  if (!q) return empty([`No quotes entered for the ${inp.deal.tenorYears}Y tenor`]);

  const sRef = inp.rbi.fbilRef ?? midRate(fx, USD, INR);
  const c: number[] = [];
  for (const e of route.edges) {
    if (e.instrument === "RBI_SWAP") {
      if (!isNum(sRef)) ctx.missing.push("USD/INR spot (reference for RBI swap)");
      c.push(sRef ?? NaN);
    } else {
      const r = convertRate(fx, e.from, e.to);
      if (r === null) ctx.missing.push(`Spot ${e.from}/${e.to}`);
      c.push(r ?? NaN);
    }
  }
  if (ctx.missing.length) return empty([...new Set(ctx.missing)]);
  const prodC = c.reduce((a, b) => a * b, 1);
  const N0 = R / prodC;
  const base = baseShape(inp, route.start, N0, shocks);
  if (!("shape" in base)) return empty(base.missing);
  let shape: Shape = base.shape;
  const startFloating = q.lenders[route.start]?.structure === "floating";
  const h = inp.deal.hedgeRatio;
  const last = route.edges.length - 1;
  ctx.notionals.push({ ccy: route.start, amount: N0 });
  const fcyRate = sumRate(shape.interest);

  let cur: { kind: "shape"; shape: Shape } | { kind: "entries"; ccy: Ccy; entries: Entry[] } = { kind: "shape", shape };
  let swapped = false;
  let curN = N0;

  for (let i = 0; i < route.edges.length; i++) {
    const edge = route.edges[i];
    const isLast = i === last;
    const share = isLast ? h : 1;
    const conv = c[i];

    if (cur.kind === "shape" && isCcsLike(edge.instrument)) {
      const sh = cur.shape;
      const flat0 = costPick(edge.bid, edge.offer, mode, shocks.liquidityWiden);
      if (flat0 === null) {
        ctx.missing.push(`${edge.id}: dealer quote`);
        continue;
      }
      const flat = flat0 + (!shocks.basisEdgeId || shocks.basisEdgeId === edge.id ? (shocks.basisBp ?? 0) : 0) * BP;
      const he = edge.instrument === "CCS" ? flat - sh.bench : flat;
      const nextBench = q.lenders[edge.to]?.benchmarkRate ?? null;
      if (edge.to !== target && !isNum(nextBench)) {
        ctx.missing.push(`${edge.to} benchmark swap rate (needed to chain ${edge.from}→${edge.to})`);
        continue;
      }
      const nOut = sh.N * conv;
      const outShape: Shape = {
        ccy: edge.to,
        N: nOut,
        interest: [...sh.interest, { kind: "hedge", tag: edge.id, rate: he }],
        ongoing: edge.ongoingBp ? [...sh.ongoing, { kind: "hedge", tag: edge.id, rate: edge.ongoingBp * BP }] : sh.ongoing,
        upfront: edge.upfrontBp ? [...sh.upfront, { kind: "hedge", tag: edge.id, pct: edge.upfrontBp * BP }] : sh.upfront,
        bench: isNum(nextBench) ? nextBench : 0,
      };
      ctx.hedgeAdd += he;
      if (i === 0) {
        const src = shapeEntries({ ...sh, interest: sh.interest.filter((x) => x.kind !== "hedge"), N: sh.N }, sched, `1. Borrowing (${sh.ccy})`, "LOAN", { proceeds: true, costs: false, interest: true, principal: true });
        ctx.entries.push(...src);
      }
      const stepIdx = i + 2;
      const nm = `${stepIdx}. ${edge.instrument === "CCS" ? "CCS" : "Hedge"} ${edge.from}/${edge.to}`;
      const hedgedIn = scale(sh, share);
      const hedgedOut = scale(outShape, share);
      ctx.entries.push(...legs(nm, hedgedIn, sched, edge.instrument, 1, { proceeds: false }));
      // initial exchange: deliver `from`, receive `to`
      ctx.entries.push(mk(nm, null, edge.from, -hedgedIn.N, "principal", "P", edge.instrument, "Initial exchange: deliver", undefined, false, sched[0].start));
      ctx.entries.push(mk(nm, null, edge.to, hedgedOut.N, "principal", "P", edge.instrument, "Initial exchange: receive", undefined, false, sched[0].start));
      // pay leg in `to` (interest legs & principal re-exchange)
      ctx.entries.push(...legs(nm, hedgedOut, sched, edge.instrument, -1, { proceeds: false }));
      ctx.notionals.push({ ccy: edge.to, amount: outShape.N });
      const swappedBefore = swapped;
      swapped = true;
      curN = outShape.N;
      if (isLast && share < 1) {
        const unSh = scale(sh, 1 - h);
        const unShape = { ...unSh, upfront: [] as Up[], ongoing: [] as Comp[] };
        if (startFloating && !swappedBefore) unShape.interest = unShape.interest.map((x) => (x.kind === "bench" ? { ...x, rate: x.rate + (shocks.benchBp ?? 0) * BP } : x));
        const src = shapeEntries(unShape, sched, "unhedged-src", "LOAN", { proceeds: true, costs: false, interest: true, principal: true });
        const conv2 = unhedgedConvert(ctx, src, sh.ccy, edge.to, conv, inp.deal.unhedgedDriftPa, shocks.fxShock ?? 0);
        if (conv2) {
          ctx.entries.push(...conv2);
          ctx.residual.push({ ccy: sh.ccy, amount: sh.N * (1 - h) });
        }
      }
      if (isLast) {
        const feeShape: Shape = { ...outShape, N: outShape.N };
        ctx.entries.push(...shapeEntries({ ...feeShape, interest: [] }, sched, "Fees, taxes & hedge charges", "COST", { proceeds: false, costs: true, interest: false, principal: false }));
      }
      cur = { kind: "shape", shape: outShape };
      shape = outShape;
      continue;
    }

    if (isFwdLike(edge.instrument) || edge.instrument === "RBI_SWAP") {
      // source entries in edge.from currency
      let srcAll: Entry[];
      let prefix: string;
      if (cur.kind === "shape") {
        let sh = cur.shape;
        if (!swapped && startFloating) sh = { ...sh, interest: sh.interest.map((x) => (x.kind === "bench" ? { ...x, rate: x.rate + (shocks.benchBp ?? 0) * BP } : x)) };
        const includeAll = { proceeds: true, costs: true, interest: true, principal: true };
        if (i === 0) {
          ctx.entries.push(...shapeEntries(scale(sh, 1), sched, `1. Borrowing (${sh.ccy})`, "LOAN", includeAll));
          prefix = `2. `;
        } else prefix = `${i + 2}. `;
        srcAll = shapeEntries(sh, sched, "src", "LOAN", includeAll);
      } else {
        srcAll = cur.entries.map((e) => ({ ...e }));
        prefix = `${i + 2}. `;
      }
      const hedgedSrc = srcAll.map((e) => ({ ...e, amount: e.amount * share }));
      const nm = `${prefix}${edge.instrument === "RBI_SWAP" ? "RBI USD/INR swap (principal) + market coupon hedge" : `${edge.instrument} ${edge.from}/${edge.to}`}`;
      let convOut: Entry[] | null = null;
      if (edge.instrument === "RBI_SWAP") {
        ctx.usesRbi = true;
        const rho = Math.pow(1 + inp.rbi.swapRate / inp.rbi.compoundingPerYear, inp.rbi.compoundingPerYear) - 1;
        const S = sRef as number;
        const prin = hedgedSrc.filter((e) => e.kind === "principal");
        const other = hedgedSrc.filter((e) => e.kind !== "principal");
        convOut = [];
        for (const e of prin) {
          const rem = e.amount * S * (Math.pow(1 + rho, e.t) - 1);
          convOut.push({ ledger: nm, t: e.t, date: e.date, ccy: edge.from, amount: -e.amount, kind: e.kind, part: e.part, instrument: "RBI_SWAP", desc: e.amount > 0 ? "Sell USD to RBI (spot, FBIL reference)" : "Buy back USD from RBI at maturity" });
          convOut.push({ ledger: nm, t: e.t, date: e.date, ccy: INR, amount: e.amount * S, kind: e.kind, part: e.part, instrument: "RBI_SWAP", desc: "INR leg at FBIL reference" });
          if (Math.abs(rem) > 0) convOut.push({ ledger: nm, t: e.t, date: e.date, ccy: INR, amount: rem, kind: "hedge", part: e.part, tag: "rbi", instrument: "RBI_SWAP", desc: "RBI swap cost (fixed rate, compounded)" });
        }
        if (route.rbiCoupon) {
          const cv = convertEntriesFwd(ctx, other, edge.from, INR, route.rbiCoupon, nm, { r0: S });
          if (cv) convOut.push(...cv);
          else convOut = null;
        } else if (other.length) {
          ctx.couponsUnhedged = true;
          ctx.warnings.push("RBI swap covers principal only: with no market forward quote, USD interest is left UNHEDGED (modelled at spot).");
          const un = unhedgedConvert(ctx, other, edge.from, INR, S, inp.deal.unhedgedDriftPa, shocks.fxShock ?? 0);
          if (un && convOut) convOut.push(...un);
        }
      } else {
        const r0 = convertRate(fx, edge.from, edge.to);
        if (r0 === null) {
          ctx.missing.push(`Spot ${edge.from}/${edge.to}`);
          continue;
        }
        convOut = convertEntriesFwd(ctx, hedgedSrc, edge.from, edge.to, edge, nm, { r0 });
      }
      if (!convOut) continue;
      ctx.entries.push(...convOut);
      const nTo = curN * conv;
      ctx.notionals.push({ ccy: edge.to, amount: nTo });
      if (edge.upfrontBp) ctx.entries.push(mk(nm, null, edge.to, -edge.upfrontBp * BP * nTo * share, "hedge", "U", edge.instrument, "Dealer margin on initial exchange", edge.id, false, sched[0].start));
      if (edge.ongoingBp) {
        for (const p of sched) ctx.entries.push(mk(nm, p, edge.to, -edge.ongoingBp * BP * nTo * share * p.outstanding * p.accr, "hedge", "I", edge.instrument, "Collateral / credit charge", edge.id));
      }
      if (isLast && share < 1) {
        const un = srcAll.map((e) => ({ ...e, amount: e.amount * (1 - h) }));
        const S0 = edge.instrument === "RBI_SWAP" ? (sRef as number) : conv;
        const cv = unhedgedConvert(ctx, un, edge.from, edge.to, S0, inp.deal.unhedgedDriftPa, shocks.fxShock ?? 0);
        if (cv) {
          ctx.entries.push(...cv);
          ctx.residual.push({ ccy: edge.from, amount: curN * (1 - h) });
        }
      }
      curN = nTo;
      // chain: converted d-currency entries (hedged share, full-share scaled) feed the next forward edge
      const nextEntries = convOut.filter((e) => e.ccy === edge.to);
      cur = { kind: "entries", ccy: edge.to, entries: nextEntries };
      continue;
    }

    ctx.missing.push(`${edge.id}: ${edge.instrument} cannot follow a forward-type hedge in the same route (not modelled)`);
  }

  if (ctx.missing.length) return empty([...new Set(ctx.missing)]);

  if (target === INR) {
    ctx.entries.push(...fixedCostEntries(inp, sched));
    ctx.entries.push(...shieldEntries(inp, ctx.entries));
  }

  const flows = aggregate(ctx.entries, target);
  const res = irr(flows);
  return {
    ok: res.ok,
    target,
    missing: [],
    warnings: ctx.warnings,
    mode,
    entries: ctx.entries,
    irr: res.ok ? res.rate : null,
    irrCode: res.ok ? undefined : res.code,
    notionals: ctx.notionals,
    fcyRate,
    hedgeAdd: ctx.hedgeAdd,
    residualExposure: ctx.residual,
    usesRbi: ctx.usesRbi,
    couponsUnhedged: ctx.couponsUnhedged,
    sched,
  };
}

/** The domestic comparator: same principal/tenor/day-count, its own frequency, fees and tax shield. */
export function evalInrAlternative(inp: CarryInputs, shocks: Shocks = {}): EvalOut {
  const a = inp.inrAlt;
  const sched = buildSchedule({ ...inp.deal, paymentFreq: a.freq });
  const R = inp.deal.requirementInr;
  const baseRate = a.rateByTenor?.[String(inp.deal.tenorYears)] ?? a.rate;
  if (!isNum(baseRate)) return { ok: false, target: INR, missing: ["INR alternative rate"], warnings: [], mode: "exec", entries: [], irr: null, notionals: [], fcyRate: 0, hedgeAdd: 0, residualExposure: [], usesRbi: false, couponsUnhedged: false, sched };
  const rate = baseRate + (shocks.inrRateBp ?? 0) * BP;
  const sh: Shape = {
    ccy: INR,
    N: R,
    interest: [{ kind: "bench", rate }],
    ongoing: a.ongoingFeeBp > 0 ? [{ kind: "fee", rate: a.ongoingFeeBp * BP }] : [],
    upfront: a.upfrontFeePct > 0 ? [{ kind: "fee", pct: a.upfrontFeePct }] : [],
    bench: a.benchmarkRate ?? 0,
  };
  const entries = shapeEntries(sh, sched, "INR alternative", "INR_LOAN", { proceeds: true, costs: true, interest: true, principal: true });
  entries.push(...shieldEntries(inp, entries));
  const res = irr(aggregate(entries, INR));
  return { ok: res.ok, target: INR, missing: [], warnings: [], mode: "exec", entries, irr: res.ok ? res.rate : null, irrCode: res.ok ? undefined : res.code, notionals: [{ ccy: INR, amount: R }], fcyRate: rate, hedgeAdd: 0, residualExposure: [], usesRbi: false, couponsUnhedged: false, sched };
}

export interface CostLine {
  key: string;
  label: string;
  /** annual cost contribution (positive = cost, negative = benefit) — sums exactly to the effective rate */
  cost: number;
}

/** Exact PV attribution: each category's share of the effective rate = r* x PV_k / PV_interest_total. */
export function attribute(out: EvalOut): CostLine[] {
  if (out.irr === null) return [];
  const r = out.irr;
  const pv = pvByKey(out.entries, out.target, r, (e) => (e.kind === "principal" ? "principal" : e.kind === "hedge" ? `hedge:${e.tag ?? ""}` : e.kind === "tax" && e.tag === "wht" ? "wht" : e.kind === "tax" ? "stamp" : e.kind));
  let total = 0;
  for (const [k, v] of pv) if (k !== "principal") total += v;
  if (Math.abs(total) < 1e-9) return [];
  const lines: CostLine[] = [];
  for (const [k, v] of pv) {
    if (k === "principal") continue;
    lines.push({ key: k, label: k, cost: (r * v) / total });
  }
  return lines;
}

/** Direct borrowing in `ccy` (no conversion) — the baseline for synthetic-USD carry. IRR is in `ccy`. */
export function evalDirectLoan(inp: CarryInputs, ccy: Ccy, shocks: Shocks = {}): EvalOut {
  const sched = buildSchedule({ ...inp.deal });
  const fail = (missing: string[]): EvalOut => ({ ok: false, target: ccy, missing, warnings: [], mode: "mid", entries: [], irr: null, notionals: [], fcyRate: 0, hedgeAdd: 0, residualExposure: [], usesRbi: false, couponsUnhedged: false, sched });
  let N = inp.deal.requirementInr;
  if (ccy !== INR) {
    const k = midRate(buildFxTable(inp.spots, "mid"), INR, ccy);
    if (!isNum(k)) return fail([`Spot ${ccy}/INR`]);
    N *= k;
  }
  const base = baseShape(inp, ccy, N, shocks);
  if (!("shape" in base)) return fail(base.missing);
  const entries = shapeEntries(base.shape, sched, `Direct ${ccy} borrowing`, "LOAN", { proceeds: true, costs: true, interest: true, principal: true });
  const res = irr(aggregate(entries, ccy));
  return { ok: res.ok, target: ccy, missing: [], warnings: [], mode: "mid", entries, irr: res.ok ? res.rate : null, irrCode: res.ok ? undefined : res.code, notionals: [{ ccy, amount: N }], fcyRate: sumRate(base.shape.interest), hedgeAdd: 0, residualExposure: [], usesRbi: false, couponsUnhedged: false, sched };
}
