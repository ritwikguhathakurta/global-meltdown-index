import assert from "node:assert/strict";
import { defaultInputs, exampleInputs, meta } from "../defaults";
import { attribute, evalDirectLoan, evalInrAlternative, evalRoute } from "../evaluate";
import { enumerateRoutes } from "../routes";
import { analyze } from "../analyze";
import { reverseFor, sensitivityGrid } from "../reverse";
import { aggregate, irr, npv } from "../cashflow";
import { buildFxTable, buyCost, convertRate } from "../fx";
import { assessEcb, assessRbiSwap } from "../regulatory";
import { buildSchedule } from "../schedule";
import { stressTable } from "../risk";
import { validateRoute } from "../validators";
import type { CarryInputs } from "../types";

const NOW = "2026-09-21T10:00:00.000Z";
let failed = 0;
let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}
const near = (a: number | null, b: number, tol: number, msg = "") => {
  assert.ok(a !== null && Math.abs(a - b) <= tol, `${msg} got ${a}, expected ${b} ±${tol}`);
};

function base(): CarryInputs {
  const inp = defaultInputs(NOW);
  inp.inrAlt.rate = 0.071;
  const m = meta("USER_INPUT", "A", NOW);
  const set = (b: string, q: string, bid: number, ask: number) => {
    const s = inp.spots.find((x) => x.base === b && x.quote === q);
    if (s) Object.assign(s, { bid, ask, meta: m });
  };
  set("USD", "INR", 96, 96);
  set("JPY", "INR", 0.6, 0.6);
  set("USD", "JPY", 160, 160);
  set("EUR", "INR", 110, 110);
  set("EUR", "USD", 1.1458333333, 1.1458333333);
  return inp;
}
function lender(inp: CarryInputs, c: string, bench: number, spread: number, fee = 0, ongoing = 0) {
  Object.assign(inp.quotesByTenor["5"].lenders[c], { benchmarkRate: bench, spread, upfrontFeePct: fee, ongoingFeeBp: ongoing });
}
function edge(inp: CarryInputs, from: string, to: string, bid: number, offer: number, instrument?: string) {
  const e = inp.quotesByTenor["5"].edges.find((x) => x.from === from && x.to === to)!;
  if (instrument) e.instrument = instrument as never;
  e.bid = bid;
  e.offer = offer;
}
const route = (inp: CarryInputs, label: string) => enumerateRoutes(inp).find((r) => r.label === label)!;

console.log("Carry engine self-test");

test("golden: effective cost is COMPUTED (6.45%) and arbitrage 65 bp", () => {
  const inp = base();
  lender(inp, "USD", 0.039, 0.0085, 0, 20);
  edge(inp, "USD", "INR", 0.015, 0.015, "HEDGE_COST");
  const o = evalRoute(inp, route(inp, "USD → INR"), "exec");
  near(o.irr, 0.0645, 1e-9);
  near(0.071 - (o.irr as number), 0.0065, 1e-9);
});

test("mandatory #1: borrow FCY → hedge → repay leaves an INR liability, FCY cancels", () => {
  const inp = base();
  lender(inp, "USD", 0.039, 0.0085, 0.002);
  edge(inp, "USD", "INR", 0.052, 0.0528);
  const r = route(inp, "USD → INR");
  const o = evalRoute(inp, r, "exec");
  const usdNet = aggregate(o.entries, "USD");
  for (const f of usdNet) assert.ok(Math.abs(f.amount) < 1e-3, `USD nets at t=${f.t}: ${f.amount}`);
  const inr = aggregate(o.entries, "INR");
  assert.ok(inr[0].amount > 0 && inr[inr.length - 1].amount < 0, "INR proceeds in, INR repayment out");
  assert.ok(validateRoute(inp, o, 0.071).every((v) => v.ok), JSON.stringify(validateRoute(inp, o, 0.071).filter((v) => !v.ok)));
});

test("mandatory #2/#3/#17: JPY→USD→INR — JPY and USD ledgers cancel, INR liability remains", () => {
  const inp = base();
  lender(inp, "JPY", 0.014, 0.009, 0.002);
  lender(inp, "USD", 0.039, 0.0085);
  edge(inp, "JPY", "USD", 0.0342, 0.0347);
  edge(inp, "USD", "INR", 0.052, 0.0528);
  const o = evalRoute(inp, route(inp, "JPY → USD → INR"), "exec");
  assert.ok(o.ok, o.missing.join());
  for (const c of ["JPY", "USD"]) for (const f of aggregate(o.entries, c)) assert.ok(Math.abs(f.amount) < 1e-2, `${c} t=${f.t} net ${f.amount}`);
  assert.equal(new Set(o.entries.filter((e) => e.ledger.startsWith("1.")).map((e) => e.ccy)).has("JPY"), true);
  assert.equal(o.notionals.map((n) => n.ccy).join(">"), "JPY>USD>INR");
});

test("path consistency: difference between JPY→USD→INR and JPY→INR equals the hedge-cost difference", () => {
  const inp = base();
  lender(inp, "JPY", 0.014, 0.009, 0);
  lender(inp, "USD", 0.039, 0.0085);
  edge(inp, "JPY", "USD", 0.0342, 0.0347);
  edge(inp, "USD", "INR", 0.052, 0.0528);
  edge(inp, "JPY", "INR", 0.0543, 0.0552);
  const a = evalRoute(inp, route(inp, "JPY → USD → INR"), "exec");
  const b = evalRoute(inp, route(inp, "JPY → INR"), "exec");
  const h1 = 0.0347 - 0.014;
  const h2 = 0.0528 - 0.039;
  const h3 = 0.0552 - 0.014;
  near((a.irr as number) - (b.irr as number), h1 + h2 - h3, 1e-9);
});

test("zero-cost synthetic: CIP-consistent quotes, no spreads/fees/basis ⇒ synthetic = direct", () => {
  const inp = base();
  lender(inp, "JPY", 0.014, 0.0085, 0);
  lender(inp, "USD", 0.039, 0.0085, 0);
  // USD fixed vs TONAR flat = USD swap rate (no basis); INR fixed vs SOFR flat = INR swap rate 6.4%
  edge(inp, "JPY", "USD", 0.039, 0.039);
  edge(inp, "USD", "INR", 0.064, 0.064);
  edge(inp, "JPY", "INR", 0.064 + (0.039 - 0.014) - 0.039 + 0.014 - 0.014 + 0.014 - 0.014 + (0.014 - 0.014), 0.064);
  const jUsd = enumerateRoutes(inp, { target: "USD" }).find((r) => r.label === "JPY → USD")!;
  const synth = evalRoute(inp, jUsd, "exec", {}, "USD");
  const direct = evalDirectLoan(inp, "USD");
  near(synth.irr, direct.irr as number, 1e-9, "synthetic USD == direct USD");
  const jInr = evalRoute(inp, route(inp, "JPY → USD → INR"), "exec");
  const uInr = evalRoute(inp, route(inp, "USD → INR"), "exec");
  near(jInr.irr, uInr.irr as number, 1e-9, "synthetic INR == direct INR");
});

test("amortising loan: IRR equals the coupon rate (par loan, any amortisation)", () => {
  const inp = base();
  inp.deal.amortisation = "equal";
  inp.deal.graceYears = 1;
  inp.inrAlt.rate = 0.08;
  const a = evalInrAlternative(inp);
  near(a.irr, 0.08, 1e-9);
  inp.deal.paymentFreq = 4;
  inp.inrAlt.freq = 4;
  const q = evalInrAlternative(inp);
  near(q.irr, Math.pow(1 + 0.08 / 4, 4) - 1, 1e-9, "quarterly effective");
});

test("day counts and leap years produce finite, ordered results", () => {
  for (const dc of ["ACT/360", "ACT/365", "30/360", "ACT/ACT"] as const) {
    const inp = base();
    inp.deal.dayCount = dc;
    inp.deal.startDate = "2027-09-21"; // 5y spans 2028 leap day
    inp.inrAlt.rate = 0.071;
    const a = evalInrAlternative(inp);
    assert.ok(a.irr !== null && Number.isFinite(a.irr), dc);
    if (dc === "ACT/360") assert.ok((a.irr as number) > 0.071);
    if (dc === "30/360") near(a.irr, 0.071, 1e-9);
  }
});

test("bid/offer discipline: executable is never cheaper than mid; slippage >= 0", () => {
  const inp = exampleInputs(NOW);
  const res = analyze(inp);
  for (const r of res.routes.filter((x) => x.exec && x.mid)) assert.ok((r.slippage as number) >= -1e-12, `${r.label} slippage ${r.slippage}`);
});

test("FX side is derived from direction (round trip loses spread, never gains)", () => {
  const inp = exampleInputs(NOW);
  const fx = buildFxTable(inp.spots, "exec");
  const a = convertRate(fx, "USD", "INR") as number;
  const b = convertRate(fx, "INR", "USD") as number;
  assert.ok(a * b < 1, "USD→INR→USD returns less than 1");
  assert.ok((buyCost(fx, "USD", "INR") as number) > a, "buying USD costs more than selling USD earns");
  near(a, 95.91, 1e-9, "selling USD uses the BID");
});

test("stale data can never produce EXECUTE; example data is never executable", () => {
  const inp = base();
  lender(inp, "USD", 0.039, 0.0085, 0.002);
  edge(inp, "USD", "INR", 0.052, 0.0528);
  const fresh = analyze(inp);
  const usd = fresh.routes.find((r) => r.label === "USD → INR")!;
  assert.equal(usd.status, "EXECUTE", `${usd.status} ${usd.reasons}`);
  inp.nowIso = "2026-09-21T14:00:00.000Z"; // 4h later
  const stale = analyze(inp).routes.find((r) => r.label === "USD → INR")!;
  assert.notEqual(stale.status, "EXECUTE");
  const ex = analyze(exampleInputs(NOW));
  assert.ok(ex.routes.every((r) => r.status !== "EXECUTE"), "illustrative example must never signal EXECUTE");
});

test("missing CCS / missing INR alternative → INSUFFICIENT_DATA, never a fabricated number", () => {
  const inp = base();
  lender(inp, "USD", 0.039, 0.0085);
  const r = analyze(inp).routes.find((x) => x.label === "USD → INR")!;
  assert.equal(r.status, "INSUFFICIENT_DATA");
  assert.equal(r.exec, null);
  inp.inrAlt.rate = null;
  const a = analyze(inp);
  assert.equal(a.inrAltIrr, null);
});

test("negative spread is rejected; negative/zero benchmark rates and negative basis are handled", () => {
  const inp = base();
  lender(inp, "USD", 0.039, -0.001);
  edge(inp, "USD", "INR", 0.052, 0.0528);
  assert.equal(evalRoute(inp, route(inp, "USD → INR"), "exec").ok, false);
  lender(inp, "USD", -0.005, 0.01);
  edge(inp, "USD", "INR", 0.02, 0.021);
  const o = evalRoute(inp, route(inp, "USD → INR"), "exec");
  assert.ok(o.irr !== null && Number.isFinite(o.irr));
  lender(inp, "USD", 0, 0.01);
  assert.ok(evalRoute(inp, route(inp, "USD → INR"), "exec").irr !== null);
  edge(inp, "USD", "INR", 0.0, 0.0, "HEDGE_COST");
  assert.ok(evalRoute(inp, route(inp, "USD → INR"), "exec").irr !== null, "zero hedge cost");
  edge(inp, "USD", "INR", 0.5, 0.5, "HEDGE_COST");
  const huge = evalRoute(inp, route(inp, "USD → INR"), "exec");
  assert.ok(huge.irr !== null && huge.irr > 0.4, "extremely high hedge cost still solves");
});

test("hedge ratio: 100% ⇒ no residual exposure; 0% ⇒ full exposure; FX moves hit only the unhedged share", () => {
  const inp = base();
  lender(inp, "USD", 0.039, 0.0085);
  edge(inp, "USD", "INR", 0.052, 0.0528);
  const r = route(inp, "USD → INR");
  assert.equal(evalRoute(inp, r, "exec").residualExposure.length, 0);
  const hedgedUp = evalRoute(inp, r, "exec", { fxShock: 0.2 });
  near(hedgedUp.irr, evalRoute(inp, r, "exec").irr as number, 1e-12, "fully hedged is FX-insensitive");
  inp.deal.hedgeRatio = 0;
  const un = evalRoute(inp, r, "exec");
  assert.ok(un.residualExposure.length === 1 && un.residualExposure[0].amount > 0);
  const up = evalRoute(inp, r, "exec", { fxShock: 0.1 });
  const dn = evalRoute(inp, r, "exec", { fxShock: -0.1 });
  assert.ok((up.irr as number) > (un.irr as number), "FCY appreciation vs INR = borrower loss on an unhedged liability");
  assert.ok((dn.irr as number) < (un.irr as number), "depreciation = borrower gain");
  inp.deal.hedgeRatio = 0.5;
  const half = evalRoute(inp, r, "exec", { fxShock: 0.1 });
  assert.ok((half.irr as number) > evalRoute(inp, r, "exec").irr!, "50% hedge partially exposed");
});

test("forward-strip hedge: compounded premium is worse than the additive approximation; ledgers cancel", () => {
  const inp = base();
  lender(inp, "USD", 0.039, 0.0085);
  edge(inp, "USD", "INR", 0.015, 0.015, "FX_FORWARD");
  const o = evalRoute(inp, route(inp, "USD → INR"), "exec");
  assert.ok(o.ok, o.missing.join());
  const additive = 0.039 + 0.0085 + 0.015;
  assert.ok((o.irr as number) > additive - 1e-9, "premium compounds on interest and principal");
  for (const f of aggregate(o.entries, "USD")) assert.ok(Math.abs(f.amount) < 1e-2);
  assert.ok(validateRoute(inp, o, 0.071).every((v) => v.ok), JSON.stringify(validateRoute(inp, o, 0.071).filter((v) => !v.ok)));
});

test("attribution reconciles exactly to the IRR; NPV and IRR views agree in sign", () => {
  const inp = exampleInputs(NOW);
  const res = analyze(inp);
  for (const r of res.routes.filter((x) => x.exec)) {
    const sum = (r.explain as NonNullable<typeof r.explain>).lines.reduce((s, l) => s + l.cost, 0);
    near(sum, (r.exec as NonNullable<typeof r.exec>).effective, 1e-9, r.label);
    assert.ok(r.validators.every((v) => v.ok), `${r.label}: ${JSON.stringify(r.validators.filter((v) => !v.ok))}`);
    assert.equal(Math.sign((r.exec as NonNullable<typeof r.exec>).npvSaving), Math.sign((r.exec as NonNullable<typeof r.exec>).arbitrage));
  }
});

test("reverse engine: maximum spread / hedge / INR break-even reproduce the minimum saving when fed back", () => {
  const inp = exampleInputs(NOW);
  const spec = route(inp, "USD → INR");
  const rv = reverseFor(inp, spec);
  assert.ok(rv.ok && rv.maxSpread && rv.maxHedgeCost && rv.breakEvenInr !== null);
  const i2 = structuredClone(inp);
  i2.quotesByTenor["5"].lenders.USD.spread = rv.maxSpread.max;
  const o = evalRoute(i2, spec, "exec");
  near(0.071 - (o.irr as number), inp.deal.minSaving, 1e-7, "arbitrage at max spread == minimum saving");
  const i3 = structuredClone(inp);
  i3.inrAlt.rate = rv.breakEvenInr;
  const o3 = evalRoute(i3, spec, "exec");
  const a3 = evalInrAlternative(i3);
  near((a3.irr as number) - (o3.irr as number), inp.deal.minSaving, 1e-7, "arbitrage at break-even INR == minimum saving");
});

test("sensitivity grid is dynamic and monotone (higher spread / hedge cost ⇒ lower arbitrage)", () => {
  const inp = exampleInputs(NOW);
  const spec = route(inp, "USD → INR");
  const g = sensitivityGrid(inp, spec, "hedge", [0.01, 0.015, 0.02], "spread", [0.005, 0.01, 0.015]);
  for (let y = 0; y < 3; y++) for (let x = 1; x < 3; x++) assert.ok((g.z[y][x] as number) < (g.z[y][x - 1] as number));
  for (let x = 0; x < 3; x++) for (let y = 1; y < 3; y++) assert.ok((g.z[y][x] as number) < (g.z[y - 1][x] as number));
});

test("stress: adverse quote shocks never improve the effective cost", () => {
  const inp = exampleInputs(NOW);
  const spec = route(inp, "USD → INR");
  const base0 = evalRoute(inp, spec, "exec");
  const rows = stressTable(inp, spec, base0);
  assert.ok(rows.length > 20);
  for (const r of rows.filter((x) => x.group.startsWith("Lender") || x.group.startsWith("CCS") || x.group.startsWith("Liquidity"))) assert.ok((r.delta as number) >= -1e-12, `${r.group} ${r.label}`);
});

test("USD carry: direct vs synthetic is cash-flow based and positive/negative as the quotes imply", () => {
  const inp = exampleInputs(NOW);
  const res = analyze(inp);
  const jpy = res.carry.find((c) => c.ccy === "JPY")!;
  assert.ok(jpy.usdCarryExec !== null && jpy.usdCarryExec > 0, `JPY→USD synthetic should be cheaper than direct USD in the example: ${jpy.usdCarryExec}`);
  assert.ok(jpy.crossPathAdvantage !== null);
});

test("regulatory: rule versions by date; private corporate is NOT eligible for the RBI swap; PSU is only 'potentially'", () => {
  const inp = base();
  inp.rbi.apply = true;
  const sched = buildSchedule({ ...inp.deal });
  inp.reg.drawdownDate = "2026-05-01";
  assert.equal(assessRbiSwap(inp, sched).status, "NOT_ELIGIBLE");
  inp.reg.drawdownDate = "2026-09-25";
  inp.nowIso = "2026-09-25T10:00:00.000Z";
  assert.equal(assessRbiSwap(inp, sched).status, "NOT_ELIGIBLE", "private corporate");
  inp.reg.borrowerType = "PSU";
  const s = assessRbiSwap(inp, sched);
  assert.equal(s.status, "POTENTIALLY_ELIGIBLE", "secondary-sourced rule ⇒ never 'ELIGIBLE' until user-confirmed");
  inp.reg.userConfirmedRules = ["RBI-SWAP-2026"];
  assert.equal(assessRbiSwap(inp, sched).status, "ELIGIBLE");
  inp.deal.tenorYears = 7;
  assert.equal(assessRbiSwap(inp, buildSchedule({ ...inp.deal })).status, "NOT_ELIGIBLE", ">5y swap tenor");
});

test("ECB checks: MAMP, lender, end-use, unknowns", () => {
  const inp = base();
  const sched = buildSchedule({ ...inp.deal });
  inp.reg.lenderNonResident = null;
  assert.equal(assessEcb(inp, sched).status, "INSUFFICIENT_INFORMATION", "lender residency unknown");
  inp.reg.lenderNonResident = true;
  assert.equal(assessEcb(inp, sched).status, "POTENTIALLY_ELIGIBLE");
  inp.deal.tenorYears = 2;
  assert.equal(assessEcb(inp, buildSchedule({ ...inp.deal })).status, "NOT_ELIGIBLE", "MAMP below 3y");
  inp.deal.tenorYears = 5;
  inp.deal.amortisation = "equal";
  inp.deal.graceYears = 0;
  assert.equal(assessEcb(inp, buildSchedule({ ...inp.deal })).status, "POTENTIALLY_ELIGIBLE", "5y equal amortisation: average maturity 3.0y");
  inp.deal.tenorYears = 4;
  assert.equal(assessEcb(inp, buildSchedule({ ...inp.deal })).status, "NOT_ELIGIBLE", "4y amortising: average maturity 2.5y < 3y although final maturity is 4y");
  inp.deal.tenorYears = 5;
  inp.deal.amortisation = "bullet";
  inp.reg.endUse = "Real-estate business (speculative)";
  assert.equal(assessEcb(inp, buildSchedule({ ...inp.deal })).status, "NOT_ELIGIBLE");
});

test("RBI swap route: principal-only, market coupon hedge, benefit computed vs market twin", () => {
  const inp = base();
  inp.rbi.apply = true;
  inp.reg.borrowerType = "PSU";
  inp.reg.drawdownDate = "2026-09-25";
  inp.nowIso = "2026-09-25T10:00:00.000Z";
  inp.reg.lenderNonResident = true;
  lender(inp, "USD", 0.039, 0.0085, 0.002);
  edge(inp, "USD", "INR", 0.0295, 0.03, "FX_FORWARD"); // market forward premium 3.0% p.a.
  const res = analyze(inp);
  const rbi = res.routes.find((r) => r.usesRbi && r.label === "USD → INR (RBI swap)")!;
  const mkt = res.routes.find((r) => !r.usesRbi && r.label === "USD → INR")!;
  assert.ok(rbi.exec && mkt.exec, "both evaluated");
  assert.ok((rbi.exec as NonNullable<typeof rbi.exec>).effective < (mkt.exec as NonNullable<typeof mkt.exec>).effective, "1.5% RBI principal swap beats a 3.0% market forward on principal");
  assert.ok(rbi.explain!.rbiBenefit !== null && (rbi.explain!.rbiBenefit as number) > 0);
  assert.ok(rbi.tags.includes("CONFIRM REGULATORY") || rbi.status !== "EXECUTE");
  for (const v of rbi.validators) assert.ok(v.ok, `${v.name}: ${v.detail}`);
});

test("irr(): rejects structures without both an inflow and an outflow; never flips signs", () => {
  assert.equal(irr([{ t: 0, amount: 100 }, { t: 1, amount: 50 }]).ok, false);
  assert.equal(irr([{ t: 0, amount: -100 }, { t: 1, amount: -5 }]).ok, false);
  const r = irr([{ t: 0, amount: 100 }, { t: 1, amount: -106 }]);
  assert.ok(r.ok && Math.abs(r.rate - 0.06) < 1e-10);
  assert.ok(Math.abs(npv([{ t: 0, amount: 100 }, { t: 1, amount: -106 }], 0.06)) < 1e-9);
});

test("no NaN / Infinity in any output for a fully populated example", () => {
  const res = analyze(exampleInputs(NOW));
  const walk = (o: unknown, path: string) => {
    if (typeof o === "number") assert.ok(Number.isFinite(o), `${path} = ${o}`);
    else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (k !== "evalExec" && k !== "evalMid" && k !== "route" && k !== "inrAlt") walk(v, `${path}.${k}`);
  };
  walk(res.routes.map((r) => ({ ...r, evalExec: null, evalMid: null })), "routes");
  walk(res.carry, "carry");
});

test("attribution: PV shares add to effective cost with taxes (WHT gross-up, stamp duty, interest shield)", () => {
  const inp = base();
  lender(inp, "USD", 0.039, 0.0085, 0.002);
  edge(inp, "USD", "INR", 0.052, 0.0528);
  inp.tax = { mode: "included", whtRate: 0.05, whtSource: "user", gstOnFeesRate: 0.18, stampDutyPct: 0.001, guaranteeFeeBpPa: 10, interestShieldRate: 0.25 };
  const o = evalRoute(inp, route(inp, "USD → INR"), "exec");
  const lines = attribute(o);
  near(lines.reduce((s, l) => s + l.cost, 0), o.irr as number, 1e-9);
  assert.ok(lines.some((l) => l.key === "wht") && lines.some((l) => l.key === "shield" && l.cost < 0), "gross-up is a cost, shield is a benefit");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
