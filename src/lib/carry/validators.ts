/**
 * Mandatory validators (sign, unit, currency, FX, cash-flow, cancellation, discounting, reconciliation).
 * If a CRITICAL validator fails the route can never signal EXECUTE (MODEL_VALIDATION_FAILED).
 */
import type { CarryInputs, Ccy } from "./types";
import type { EvalOut } from "./evaluate";
import { attribute } from "./evaluate";
import { aggregate, npv } from "./cashflow";
import { buildFxTable, convertRate } from "./fx";
import { CURRENCIES, INR } from "./currencies";
import { isNum } from "./units";

export interface ValidatorResult {
  name: string;
  ok: boolean;
  critical: boolean;
  detail: string;
}

const KNOWN = new Set<Ccy>([INR, ...CURRENCIES.map((c) => c.code)]);

export function validateRoute(inp: CarryInputs, out: EvalOut, altIrr: number | null): ValidatorResult[] {
  const res: ValidatorResult[] = [];
  const push = (name: string, ok: boolean, detail: string, critical = true) => res.push({ name, ok, critical, detail });
  const tgt = out.target;
  const R = out.notionals.length ? out.notionals[out.notionals.length - 1].amount : 0;
  const tol = Math.max(1e-6 * Math.abs(R), 1e-9);

  push("CashFlowValidator", out.irr !== null && out.entries.every((e) => Number.isFinite(e.amount) && Number.isFinite(e.t)), out.irr === null ? `No valid IRR (${out.irrCode ?? "n/a"})` : "All cash flows finite; at least one inflow and one outflow; IRR solved");

  const inrEntries = out.entries.filter((e) => e.ccy === tgt);
  const badSign = inrEntries.filter((e) => {
    if ((e.kind === "bench" || e.kind === "spread" || e.kind === "fee" || e.kind === "tax") && e.amount > 1e-9) return true;
    if (e.kind === "shield" && e.amount < -1e-9) return true;
    if (e.kind === "principal" && e.t === 0 && e.amount < 0) return true;
    if (e.kind === "principal" && e.t > 0 && e.amount > 1e-9) return true;
    return false;
  });
  push("SignValidator", badSign.length === 0, badSign.length ? `${badSign.length} entries carry the wrong borrower sign (e.g. ${badSign[0].desc})` : "Interest, fees and taxes are outflows (-); drawdown is an inflow (+); principal repayments are outflows; tax shield is an inflow");

  const ccysOk = out.notionals.every((n) => KNOWN.has(n.ccy) && Number.isFinite(n.amount) && n.amount > 0);
  push("CurrencyValidator", ccysOk, ccysOk ? "All currencies valid; all notionals positive and finite" : "Unknown currency or non-positive notional");

  const rates = [inp.inrAlt.rate, out.fcyRate, out.hedgeAdd].filter(isNum);
  const unitsOk = rates.every((r) => r > -0.5 && r < 1) && inp.deal.tenorYears > 0 && inp.deal.hedgeRatio >= 0 && inp.deal.hedgeRatio <= 1;
  push("UnitValidator", unitsOk, unitsOk ? "Rates are decimals (7.10% = 0.0710); hedge ratio within 0-100%" : "A rate looks like a percent entered as a decimal (e.g. 7.10 instead of 0.071) or hedge ratio is outside 0-100%");

  const fx = buildFxTable(inp.spots, "exec");
  let fxOk = true;
  let fxDetail = "Round-trip A→B→A returns no more than the original (spread cost >= 0)";
  for (const p of fx.pairs) {
    const a = convertRate(fx, p.base, p.quote);
    const b = convertRate(fx, p.quote, p.base);
    if (a !== null && b !== null && a * b > 1 + 1e-12) {
      fxOk = false;
      fxDetail = `${p.base}/${p.quote}: round trip creates money — bid above ask or inverted quote`;
    }
  }
  push("FXValidator", fxOk, fxDetail);

  const h = inp.deal.hedgeRatio;
  const byCcy = new Map<Ccy, number[]>();
  for (const e of out.entries) {
    if (e.ccy === tgt || e.modelled) continue;
    const arr = byCcy.get(e.ccy) ?? [];
    arr.push(0);
    byCcy.set(e.ccy, arr);
  }
  let cancelOk = true;
  let cancelDetail = "Every non-target currency nets to zero at every date (hedged share)";
  for (const c of byCcy.keys()) {
    const flows = aggregate(out.entries.filter((e) => !e.modelled), c);
    const gross = new Map<number, number>();
    for (const e of out.entries) if (e.ccy === c && !e.modelled) gross.set(e.t, (gross.get(e.t) ?? 0) + Math.abs(e.amount));
    for (const f of flows) {
      const allowed = (1 - h) * (gross.get(f.t) ?? 0) + tol;
      if (Math.abs(f.amount) > allowed + tol) {
        cancelOk = false;
        cancelDetail = `${c} does not cancel at t=${f.t.toFixed(2)}y (net ${f.amount.toFixed(2)}) — hedge / CCS legs are inconsistent`;
      }
    }
  }
  push("CCSValidator", cancelOk, cancelDetail);

  const principalSum = inrEntries.filter((e) => e.kind === "principal").reduce((s, e) => s + e.amount, 0);
  push("PrincipalReconciliation", Math.abs(principalSum) <= tol * 10, `Drawdown less repayments = ${principalSum.toFixed(4)} (must be 0)`);

  let discOk = false;
  if (out.irr !== null) discOk = Math.abs(npv(aggregate(out.entries, tgt), out.irr)) <= tol * 10;
  push("DiscountingValidator", discOk, "NPV of the borrower cash flows at the effective rate is zero");

  if (out.irr !== null) {
    const lines = attribute(out);
    const sum = lines.reduce((s, l) => s + l.cost, 0);
    const attrOk = lines.length === 0 || Math.abs(sum - out.irr) < 1e-9;
    push("AttributionReconciliation", attrOk, `Attribution lines sum to ${(sum * 100).toFixed(6)}% vs IRR ${(out.irr * 100).toFixed(6)}%`);
    if (altIrr !== null) {
      const npvSave = npv(aggregate(out.entries, tgt), altIrr);
      const arb = altIrr - out.irr;
      const consistent = arb === 0 ? Math.abs(npvSave) < tol * 10 : Math.sign(npvSave) === Math.sign(arb);
      push("NpvIrrConsistency", consistent, `NPV saving ${npvSave.toFixed(0)} and arbitrage ${(arb * 1e4).toFixed(2)} bp agree in sign`);
    }
  }
  return res;
}

export const criticalFailures = (v: ValidatorResult[]) => v.filter((x) => x.critical && !x.ok);
