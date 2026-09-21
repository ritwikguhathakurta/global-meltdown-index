/**
 * FX conversion. Convention (docs/CARRY_ENGINE.md §FX):
 *  - A pair {base, quote, bid, ask} means: quote units per 1 base unit.
 *  - Bid = what the DEALER pays for 1 base (borrower sells base). Ask = what the dealer charges for 1 base.
 *  - Callers never choose bid/ask: convert(from -> to) derives the adverse side from the direction.
 */
import type { Ccy, Mode, SpotQuote } from "./types";
import { ModelError, isNum } from "./units";

export interface FxPair {
  base: Ccy;
  quote: Ccy;
  bid: number;
  ask: number;
}

export interface FxTable {
  pairs: FxPair[];
}

export function buildFxTable(spots: SpotQuote[], mode: Mode, liquidityWiden = 0): FxTable {
  const pairs: FxPair[] = [];
  for (const s of spots) {
    if (!isNum(s.bid) && !isNum(s.ask)) continue;
    const bid = isNum(s.bid) ? s.bid : (s.ask as number);
    const ask = isNum(s.ask) ? s.ask : (s.bid as number);
    if (bid <= 0 || ask <= 0) throw new ModelError("BAD_FX", `${s.base}/${s.quote} must be positive`);
    const lo = Math.min(bid, ask);
    const hi = Math.max(bid, ask);
    const mid = (lo + hi) / 2;
    const half = ((hi - lo) / 2) * (1 + liquidityWiden);
    if (mode === "mid") pairs.push({ base: s.base, quote: s.quote, bid: mid, ask: mid });
    else pairs.push({ base: s.base, quote: s.quote, bid: mid - half, ask: mid + half });
  }
  return { pairs };
}

function direct(t: FxTable, from: Ccy, to: Ccy): number | null {
  const p1 = t.pairs.find((p) => p.base === from && p.quote === to);
  if (p1) return p1.bid; // borrower sells `from`, dealer buys base -> bid
  const p2 = t.pairs.find((p) => p.base === to && p.quote === from);
  if (p2) return 1 / p2.ask; // borrower buys `to`, dealer sells base -> ask
  return null;
}

/** Units of `to` the borrower RECEIVES per 1 unit of `from` GIVEN, at the adverse (dealer) side. null = no route. */
export function convertRate(t: FxTable, from: Ccy, to: Ccy): number | null {
  if (from === to) return 1;
  const d = direct(t, from, to);
  if (d !== null) return d;
  for (const via of ["USD", "INR", "EUR"]) {
    if (via === from || via === to) continue;
    const a = direct(t, from, via);
    const b = direct(t, via, to);
    if (a !== null && b !== null) return a * b;
  }
  return null;
}

/** Units of `pay` the borrower PAYS to buy 1 unit of `buy` (adverse side). */
export function buyCost(t: FxTable, buy: Ccy, pay: Ccy): number | null {
  const r = convertRate(t, pay, buy);
  return r === null ? null : 1 / r;
}

/** Mid rate for `from`->`to` (units of `to` per `from`) — reporting only. */
export function midRate(t: FxTable, from: Ccy, to: Ccy): number | null {
  const mid: FxTable = { pairs: t.pairs.map((p) => ({ ...p, bid: (p.bid + p.ask) / 2, ask: (p.bid + p.ask) / 2 })) };
  return convertRate(mid, from, to);
}
