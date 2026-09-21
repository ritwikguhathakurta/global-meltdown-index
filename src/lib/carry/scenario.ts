/**
 * Scenario lab + what-if parser. SCENARIO MODE never touches live/OTC inputs: applyScenario returns a deep copy
 * in which every quote is re-labelled source=SCENARIO (so nothing derived from it can signal EXECUTE).
 * The natural-language box is a deterministic pattern parser (no LLM): it turns a sentence into scenario variables
 * and the deterministic model is simply re-run.
 */
import type { CarryInputs, Ccy } from "./types";
import type { RouteSpec } from "./evaluate";
import { evalRoute } from "./evaluate";
import { analyze, type Analysis } from "./analyze";
import { enumerateRoutes } from "./routes";
import { reverseFor, type Reverse } from "./reverse";
import { BP, bisect, isNum } from "./units";

export interface Scenario {
  label: string;
  /** add to lender spread of these currencies (bp) */
  spreadShiftBp: Record<Ccy, number>;
  /** add to every hedge quote (bp): hedge-cost / basis move */
  hedgeShiftBp: number;
  /** add to hedge quotes of edges whose `from` is this currency (bp) */
  hedgeShiftByCcyBp: Record<Ccy, number>;
  inrRateShiftBp: number;
  /** override a spot mid, keeping the entered bid/ask spread: key "USD/INR" */
  spotOverride: Record<string, number>;
  hedgeRatio: number | null;
  tenorYears: number | null;
  rbiOff: boolean;
}

export const emptyScenario = (): Scenario => ({ label: "Scenario", spreadShiftBp: {}, hedgeShiftBp: 0, hedgeShiftByCcyBp: {}, inrRateShiftBp: 0, spotOverride: {}, hedgeRatio: null, tenorYears: null, rbiOff: false });

export function isEmptyScenario(s: Scenario): boolean {
  return !Object.keys(s.spreadShiftBp).length && !s.hedgeShiftBp && !Object.keys(s.hedgeShiftByCcyBp).length && !s.inrRateShiftBp && !Object.keys(s.spotOverride).length && s.hedgeRatio === null && s.tenorYears === null && !s.rbiOff;
}

export function applyScenario(inp: CarryInputs, sc: Scenario): CarryInputs {
  const c = structuredClone(inp);
  const stamp = { source: "SCENARIO" as const, quality: "E" as const };
  for (const s of c.spots) s.meta = { ...s.meta, ...stamp };
  for (const t of Object.values(c.quotesByTenor)) {
    for (const l of Object.values(t.lenders)) l.meta = { ...l.meta, ...stamp };
    for (const e of t.edges) e.meta = { ...e.meta, ...stamp };
  }
  if (sc.tenorYears !== null) {
    const from = c.quotesByTenor[String(c.deal.tenorYears)];
    c.deal.tenorYears = sc.tenorYears;
    if (!c.quotesByTenor[String(sc.tenorYears)] && from) c.quotesByTenor[String(sc.tenorYears)] = structuredClone(from);
  }
  const tq = c.quotesByTenor[String(c.deal.tenorYears)];
  if (tq) {
    for (const [ccy, bp] of Object.entries(sc.spreadShiftBp)) {
      const l = tq.lenders[ccy];
      if (l && isNum(l.spread)) l.spread = Math.max(0, l.spread + bp * BP);
    }
    for (const e of tq.edges) {
      const shift = (sc.hedgeShiftBp + (sc.hedgeShiftByCcyBp[e.from] ?? 0)) * BP;
      if (shift !== 0) {
        if (isNum(e.bid)) e.bid += shift;
        if (isNum(e.offer)) e.offer += shift;
      }
    }
  }
  if (sc.inrRateShiftBp !== 0) {
    if (isNum(c.inrAlt.rate)) c.inrAlt.rate += sc.inrRateShiftBp * BP;
    if (c.inrAlt.rateByTenor) for (const k of Object.keys(c.inrAlt.rateByTenor)) c.inrAlt.rateByTenor[k] += sc.inrRateShiftBp * BP;
  }
  for (const [pair, mid] of Object.entries(sc.spotOverride)) {
    const [b, q] = pair.split("/");
    const s = c.spots.find((x) => x.base === b && x.quote === q);
    if (s && isNum(s.bid) && isNum(s.ask)) {
      const half = (s.ask - s.bid) / 2;
      s.bid = mid - half;
      s.ask = mid + half;
    } else if (s) {
      s.bid = mid;
      s.ask = mid;
    }
  }
  if (sc.hedgeRatio !== null) c.deal.hedgeRatio = Math.min(1, Math.max(0, sc.hedgeRatio));
  if (sc.rbiOff) c.rbi.apply = false;
  return c;
}

/* ------------------------------- what-if parser ------------------------------- */

const CCY_CODES = ["USD", "EUR", "JPY", "CHF", "GBP", "SGD", "HKD", "AUD", "CAD"];
const CCY_RE = CCY_CODES.join("|");
const num = (s: string) => parseFloat(s.replace(/,/g, ""));

export type ParsedQuery =
  | { kind: "scenario"; scenario: Scenario; notes: string[] }
  | { kind: "beat"; a: Ccy; b: Ccy; what: "spread" | "rate"; text: string }
  | { kind: "reverse"; ask: "max_spread" | "hedge_tolerance" | "inr_breakeven" | "max_hedge"; ccy: Ccy | null; text: string }
  | { kind: "unparsed"; text: string; hint: string };

const HINT = 'Try: "What if USD borrowing spread rises by 50 bp?", "What if INR rates fall by 75 bp?", "What if USD/INR goes to 100?", "What if JPY/INR basis widens by 30 bp?", "What if RBI swap facility disappears?", "What if I hedge only 75%?", "What if the tenor becomes 7 years?", "What is the maximum USD spread I can pay?", "What USD rate do I need to beat EUR?"';

export function parseQuestion(text: string): ParsedQuery {
  const t = text.trim().replace(/\s+/g, " ");
  const low = t.toLowerCase();
  const sc = emptyScenario();
  const notes: string[] = [];
  let hit = false;

  let m = new RegExp(`what (?:usd|${CCY_RE.toLowerCase()}) (?:rate|spread)?.*(?:beat|below|cheaper than) (${CCY_RE})`, "i").exec(t);
  const first = new RegExp(`(${CCY_RE})`, "i").exec(t);
  if (/beat|cheaper than|stop being cheaper|become cheaper/i.test(t)) {
    const all = [...t.matchAll(new RegExp(`\\b(${CCY_RE})\\b`, "gi"))].map((x) => x[1].toUpperCase());
    if (all.length >= 2) return { kind: "beat", a: all[0], b: all[1], what: /rate/i.test(t) && !/spread/i.test(t) ? "rate" : "spread", text: t };
  }
  void m;
  m = /maximum (?:(\w{3}) )?(?:lender )?spread/i.exec(t);
  if (m || /max(?:imum)? .*spread/i.test(low)) return { kind: "reverse", ask: "max_spread", ccy: first ? first[1].toUpperCase() : null, text: t };
  if (/hedge.?cost (?:increase|deterioration|rise)|how much hedge/i.test(low)) return { kind: "reverse", ask: "hedge_tolerance", ccy: first ? first[1].toUpperCase() : null, text: t };
  if (/inr (?:yield|rate).*(?:eliminate|wipe|kill|remove)|eliminate.*arbitrage/i.test(low)) return { kind: "reverse", ask: "inr_breakeven", ccy: first ? first[1].toUpperCase() : null, text: t };

  m = new RegExp(`(${CCY_RE})\\s*(?:borrowing |funding |lender )?spread\\s*(rises?|increases?|widens?|falls?|drops?|decreases?|narrows?|tightens?)\\s*(?:by)?\\s*([\\d.,]+)\\s*(?:bp|bps|basis points?)`, "i").exec(t);
  if (m) {
    const up = /ris|incr|wid/i.test(m[2]);
    sc.spreadShiftBp[m[1].toUpperCase()] = (up ? 1 : -1) * num(m[3]);
    notes.push(`${m[1].toUpperCase()} lender spread ${up ? "+" : "-"}${num(m[3])} bp`);
    hit = true;
  }
  m = /inr (?:rates?|yields?|hurdle|borrowing)\s*(rises?|increases?|falls?|drops?|decreases?|goes up|goes down)\s*(?:by)?\s*([\d.,]+)\s*(?:bp|bps|basis points?)/i.exec(t);
  if (m) {
    const up = /ris|incr|up/i.test(m[1]);
    sc.inrRateShiftBp = (up ? 1 : -1) * num(m[2]);
    notes.push(`INR alternative ${up ? "+" : "-"}${num(m[2])} bp`);
    hit = true;
  }
  m = new RegExp(`(${CCY_RE})\\s*/\\s*(${CCY_RE}|INR)\\s*(?:spot |rate )?(?:goes|moves|rises|falls|reaches|hits|is|to)\\s*(?:to|at)?\\s*([\\d.,]+)`, "i").exec(t);
  if (m && !/basis/i.test(t)) {
    sc.spotOverride[`${m[1].toUpperCase()}/${m[2].toUpperCase()}`] = num(m[3]);
    notes.push(`${m[1].toUpperCase()}/${m[2].toUpperCase()} spot mid = ${num(m[3])}. A fully hedged structure locks the conversion at inception, so only the unhedged share moves.`);
    hit = true;
  }
  m = new RegExp(`(${CCY_RE})\\s*/\\s*(?:INR|USD)\\s*(?:cross.?currency )?basis\\s*(widens?|increases?|rises?|narrows?|tightens?|falls?)\\s*(?:by)?\\s*([\\d.,]+)\\s*(?:bp|bps)`, "i").exec(t);
  if (m) {
    const up = /wid|incr|ris/i.test(m[2]);
    sc.hedgeShiftByCcyBp[m[1].toUpperCase()] = (up ? 1 : -1) * num(m[3]);
    notes.push(`${m[1].toUpperCase()} hedge / CCS basis ${up ? "+" : "-"}${num(m[3])} bp (a wider basis raises the cost of hedging)`);
    hit = true;
  }
  m = /hedge.?cost\s*(?:rises?|increases?|widens?|falls?|drops?|decreases?)\s*(?:by)?\s*([\d.,]+)\s*(?:bp|bps)/i.exec(t);
  if (m) {
    const up = /ris|incr|wid/i.test(t);
    sc.hedgeShiftBp = (up ? 1 : -1) * num(m[1]);
    notes.push(`All hedge quotes ${up ? "+" : "-"}${num(m[1])} bp`);
    hit = true;
  }
  if (/rbi.*(?:swap|facility|concession).*(?:disappear|removed|remove|withdrawn|unavailable|ends?|closes?)|(?:remove|without).*rbi/i.test(t)) {
    sc.rbiOff = true;
    notes.push("RBI concessional swap not available");
    hit = true;
  }
  m = /hedge (?:only )?([\d.]+)\s*%/i.exec(t);
  if (m) {
    sc.hedgeRatio = num(m[1]) / 100;
    notes.push(`Hedge ratio ${num(m[1])}% (the rest stays open to FX — modelled at unchanged spot)`);
    hit = true;
  }
  m = /tenor.*?(\d+(?:\.\d+)?)\s*(?:y|yr|yrs|years?)/i.exec(t);
  if (m) {
    sc.tenorYears = num(m[1]);
    notes.push(`Tenor ${num(m[1])} years (uses the quotes entered for that tenor, or today's quotes if none)`);
    hit = true;
  }
  if (!hit) return { kind: "unparsed", text: t, hint: HINT };
  sc.label = t;
  return { kind: "scenario", scenario: sc, notes };
}

/** Spread at which route-set A stops beating route-set B (executable effective cost), holding everything else fixed. */
export function solveBeat(inp: CarryInputs, a: Ccy, b: Ccy): { spread: number | null; rate: number | null; current: number | null; bestB: number | null; note: string } {
  const routes = enumerateRoutes(inp);
  const ra = routes.filter((r) => r.start === a && !r.edges.some((e) => e.instrument === "RBI_SWAP"));
  const rb = routes.filter((r) => r.start === b && !r.edges.some((e) => e.instrument === "RBI_SWAP"));
  const bestOf = (rs: RouteSpec[], shock = 0) => {
    let best: number | null = null;
    for (const r of rs) {
      const o = evalRoute(inp, r, "exec", { spreadBp: shock });
      if (o.irr !== null && (best === null || o.irr < best)) best = o.irr;
    }
    return best;
  };
  const bB = bestOf(rb);
  const bA = bestOf(ra);
  const lender = inp.quotesByTenor[String(inp.deal.tenorYears)]?.lenders[a];
  if (bB === null || bA === null || !lender || !isNum(lender.spread) || !isNum(lender.benchmarkRate)) return { spread: null, rate: null, current: null, bestB: bB, note: `Need complete quotes for both ${a} and ${b} routes.` };
  const s0 = lender.spread;
  const f = (x: number) => {
    const v = bestOf(ra, x);
    return v === null ? NaN : bB - v;
  };
  const r = bisect(f, -s0 / BP, 3000, 1e-10, 100);
  if (r === null) return { spread: null, rate: null, current: s0, bestB: bB, note: `${a} cannot reach parity with ${b} within a 30% spread move.` };
  return { spread: s0 + r * BP, rate: lender.benchmarkRate + s0 + r * BP, current: s0, bestB: bB, note: `${a} matches ${b} at ${a} lender spread ${((s0 + r * BP) / BP).toFixed(1)} bp (${(r).toFixed(1)} bp ${r >= 0 ? "above" : "below"} today's quote).` };
}

export interface WhatIfRow {
  label: string;
  before: number | null;
  after: number | null;
  beforeArb: number | null;
  afterArb: number | null;
  beforeStatus: string;
  afterStatus: string;
}

/** Before/after per route for a scenario — both computed by the same deterministic engine. */
export function compareScenario(inp: CarryInputs, sc: Scenario): { before: Analysis; after: Analysis; rows: WhatIfRow[] } {
  const before = analyze(inp, "LIVE");
  const after = analyze(applyScenario(inp, sc), "SCENARIO");
  const rows: WhatIfRow[] = [];
  for (const r of after.routes) {
    const b = before.routes.find((x) => x.label === r.label);
    rows.push({ label: r.label, before: b?.exec?.effective ?? null, after: r.exec?.effective ?? null, beforeArb: b?.exec?.arbitrage ?? null, afterArb: r.exec?.arbitrage ?? null, beforeStatus: b?.status ?? "—", afterStatus: r.status });
  }
  return { before, after, rows };
}

export function answerReverse(inp: CarryInputs, q: Extract<ParsedQuery, { kind: "reverse" }>, a: Analysis): { text: string; reverse: Reverse | null } {
  const pool = a.routes.filter((r) => r.exec && (!q.ccy || r.start === q.ccy) && !r.usesRbi);
  const r = pool.sort((x, y) => (x.exec as NonNullable<typeof x.exec>).effective - (y.exec as NonNullable<typeof y.exec>).effective)[0];
  if (!r) return { text: "No complete route found for that currency yet — enter its lender and hedge quotes first.", reverse: null };
  const rv = reverseFor(inp, r.route);
  if (!rv.ok) return { text: rv.reason ?? "Cannot solve.", reverse: null };
  const bpf = (x: number) => `${(x / BP).toFixed(1)} bp`;
  if (q.ask === "max_spread") return { text: rv.maxSpread ? `${r.label}: the maximum lender spread you can pay is ${bpf(rv.maxSpread.max)} over the benchmark (all-in FCY coupon ${(rv.maxSpread.benchmarkPlusSpread * 100).toFixed(2)}%), i.e. ${bpf(rv.maxSpread.headroom)} more than today's quote, while still saving at least ${bpf(inp.deal.minSaving)}.` : `${r.label}: no spread within a 30% move meets the minimum saving.`, reverse: rv };
  if (q.ask === "hedge_tolerance" || q.ask === "max_hedge") return { text: rv.maxHedgeCost ? `${r.label}: you can tolerate another ${bpf(rv.maxHedgeCost.headroom)} of total hedge-cost deterioration (from ${(rv.maxHedgeCost.current * 100).toFixed(2)}% to ${(rv.maxHedgeCost.max * 100).toFixed(2)}%) before the saving falls below ${bpf(inp.deal.minSaving)}.` : "Not solvable.", reverse: rv };
  return { text: rv.breakEvenInrZero !== null ? `${r.label}: the arbitrage disappears if your INR alternative falls to ${(rv.breakEvenInrZero * 100).toFixed(2)}% (and drops below your minimum saving at ${rv.breakEvenInr !== null ? (rv.breakEvenInr * 100).toFixed(2) + "%" : "n/a"}).` : "Not solvable.", reverse: rv };
}

