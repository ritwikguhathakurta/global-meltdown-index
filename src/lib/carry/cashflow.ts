/**
 * Cash-flow maths. Borrower perspective (+ received, - paid).
 * Effective funding cost = annual-effective IRR of the borrower's INR cash flows (no absolute values,
 * no sign flipping). A structure without at least one inflow AND one outflow is INVALID_CASH_FLOW_STRUCTURE.
 */
import type { Ccy, Entry } from "./types";
import { bisect } from "./units";

export interface Flow {
  t: number;
  amount: number;
}

export function aggregate(entries: Entry[], ccy: Ccy, filter?: (e: Entry) => boolean): Flow[] {
  const m = new Map<number, number>();
  for (const e of entries) {
    if (e.ccy !== ccy) continue;
    if (filter && !filter(e)) continue;
    m.set(e.t, (m.get(e.t) ?? 0) + e.amount);
  }
  return [...m.entries()].map(([t, amount]) => ({ t, amount })).sort((a, b) => a.t - b.t);
}

export function npv(flows: Flow[], r: number): number {
  let s = 0;
  for (const f of flows) s += f.amount / Math.pow(1 + r, f.t);
  return s;
}

export type IrrResult = { ok: true; rate: number } | { ok: false; code: "INVALID_CASH_FLOW_STRUCTURE" | "NO_ROOT" };

export function irr(flows: Flow[]): IrrResult {
  const nz = flows.filter((f) => f.amount !== 0);
  const hasPos = nz.some((f) => f.amount > 0);
  const hasNeg = nz.some((f) => f.amount < 0);
  if (!hasPos || !hasNeg) return { ok: false, code: "INVALID_CASH_FLOW_STRUCTURE" };
  const f = (r: number) => npv(nz, r);
  for (const hi of [1, 5, 50]) {
    const root = bisect(f, -0.95, hi);
    if (root !== null) return { ok: true, rate: root };
  }
  return { ok: false, code: "NO_ROOT" };
}

/** PV by kind at rate r — used for the exact PV attribution. */
export function pvByKey(entries: Entry[], ccy: Ccy, r: number, key: (e: Entry) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    if (e.ccy !== ccy) continue;
    const k = key(e);
    m.set(k, (m.get(k) ?? 0) + e.amount / Math.pow(1 + r, e.t));
  }
  return m;
}
