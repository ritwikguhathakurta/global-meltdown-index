/**
 * Signal engine + alert cooldown. Signals are derived from the CURRENT analysis and (optionally) the previous
 * saved snapshot. A signal only re-alerts when its value changed materially (threshold), never merely because
 * a currency has the lowest headline rate.
 */
import type { Analysis } from "./analyze";
import type { CarryInputs } from "./types";
import { BP } from "./units";

export type SignalType =
  | "NEW_ARBITRAGE"
  | "ARBITRAGE_STRENGTHENING"
  | "ARBITRAGE_WEAKENING"
  | "ARBITRAGE_CLOSED"
  | "EXECUTION_WINDOW"
  | "HEDGE_WINDOW"
  | "NEGOTIATION_WINDOW"
  | "REGULATORY_WINDOW"
  | "DATA_STALE"
  | "DATA_CONFLICT"
  | "FALSE_ARBITRAGE"
  | "MODEL_VALIDATION_FAILED"
  | "FUNDING_SWITCH_ALERT"
  | "USD_CARRY_OPENED"
  | "USD_CARRY_STRENGTHENED"
  | "USD_CARRY_CLOSED"
  | "USD_CARRY_SWITCH"
  | "USD_TO_INR_ARBITRAGE";

export interface Signal {
  id: string;
  type: SignalType;
  route: string;
  message: string;
  value: number | null;
}

export interface Snapshot {
  asOf: string;
  routes: { label: string; status: string; arbitrageBp: number | null; effective: number | null; maxSpreadBp: number | null; hedgeBp: number | null }[];
  best: string | null;
  usdCarryBp: Record<string, number | null>;
}

export function takeSnapshot(a: Analysis): Snapshot {
  const usd: Record<string, number | null> = {};
  for (const c of a.carry) usd[c.ccy] = c.usdCarryExec === null ? null : c.usdCarryExec / BP;
  return {
    asOf: a.asOf,
    routes: a.routes.map((r) => ({ label: r.label, status: r.status, arbitrageBp: r.exec ? r.exec.arbitrage / BP : null, effective: r.exec?.effective ?? null, maxSpreadBp: r.maxSpread === null ? null : r.maxSpread / BP, hedgeBp: r.explain ? r.explain.hedgeCost / BP : null })),
    best: a.best?.label ?? null,
    usdCarryBp: usd,
  };
}

const CHANGE_BP = 10;

export function deriveSignals(inp: CarryInputs, a: Analysis, prev: Snapshot | null, conflicts: number): Signal[] {
  const out: Signal[] = [];
  const min = inp.deal.minSaving / BP;
  const add = (type: SignalType, route: string, message: string, value: number | null) => out.push({ id: `${type}|${route}`, type, route, message, value });
  for (const r of a.routes) {
    if (!r.exec || !r.mid) {
      continue;
    }
    const arb = r.exec.arbitrage / BP;
    const p = prev?.routes.find((x) => x.label === r.label);
    const pa = p?.arbitrageBp ?? null;
    if (r.status === "MODEL_VALIDATION_FAILED") add("MODEL_VALIDATION_FAILED", r.label, `${r.label}: model validation failed — no execution signal`, null);
    if (r.mid.arbitrage / BP >= min && arb < 0) add("FALSE_ARBITRAGE", r.label, `${r.label}: attractive at mid (${(r.mid.arbitrage / BP).toFixed(0)} bp) but negative after bid/offer (${arb.toFixed(0)} bp) — not a real arbitrage`, arb);
    if (arb >= min && (pa === null || pa < min)) add(pa === null ? "NEW_ARBITRAGE" : "NEW_ARBITRAGE", r.label, `${r.label}: executable advantage ${arb.toFixed(0)} bp now meets your ${min.toFixed(0)} bp minimum`, arb);
    if (pa !== null && pa >= min && arb < min) add("ARBITRAGE_CLOSED", r.label, `${r.label}: advantage fell from ${pa.toFixed(0)} bp to ${arb.toFixed(0)} bp, below your ${min.toFixed(0)} bp minimum`, arb);
    if (pa !== null && arb - pa >= CHANGE_BP && arb >= min) add("ARBITRAGE_STRENGTHENING", r.label, `${r.label}: advantage increased from ${pa.toFixed(0)} bp to ${arb.toFixed(0)} bp`, arb);
    if (pa !== null && pa - arb >= CHANGE_BP && arb >= 0) add("ARBITRAGE_WEAKENING", r.label, `${r.label}: advantage decreased from ${pa.toFixed(0)} bp to ${arb.toFixed(0)} bp`, arb);
    if (r.status === "EXECUTE") add("EXECUTION_WINDOW", r.label, `${r.label}: all gates pass on firm, fresh quotes — execution window open (decision support only; nothing is executed)`, arb);
    const hb = r.explain ? r.explain.hedgeCost / BP : null;
    if (p?.hedgeBp != null && hb !== null && p.hedgeBp - hb >= CHANGE_BP) add("HEDGE_WINDOW", r.label, `${r.label}: hedge cost fell ${(p.hedgeBp - hb).toFixed(0)} bp to ${hb.toFixed(0)} bp`, hb);
    if (r.status === "EXECUTE" || r.status === "WATCH") {
      const room = r.maxSpread !== null ? (r.maxSpread - (inp.quotesByTenor[String(inp.deal.tenorYears)]?.lenders[r.start]?.spread ?? 0)) / BP : null;
      if (room !== null && room > 0) add("NEGOTIATION_WINDOW", r.label, `${r.label}: the lender can widen by up to ${room.toFixed(0)} bp before your minimum saving is lost — room to negotiate`, room);
    }
    if (r.quality.stale.length) add("DATA_STALE", r.label, `${r.label}: stale inputs — ${r.quality.stale[0]}`, null);
  }
  if (conflicts > 0) add("DATA_CONFLICT", "market", `${conflicts} spot pair(s) differ materially between your dealer quote and the live reference — check before relying on either`, conflicts);
  if (a.swap && inp.rbi.windowOpenUntil) {
    const days = Math.ceil((Date.parse(inp.rbi.windowOpenUntil) - Date.parse(inp.nowIso)) / 86400000);
    if (days >= 0 && days <= 45) add("REGULATORY_WINDOW", "RBI swap", `RBI swap facility window closes in ${days} day(s) (${inp.rbi.windowOpenUntil}) — drawdown must be inside the eligible window`, days);
  }
  if (prev?.best && a.best && prev.best !== a.best.label) add("FUNDING_SWITCH_ALERT", a.best.label, `Best structure changed from ${prev.best} to ${a.best.label}`, null);
  const bestAbove = a.routes.filter((r) => r.exec && r.exec.arbitrage >= inp.deal.minSaving && r.status !== "MODEL_VALIDATION_FAILED").sort((x, y) => (y.exec?.arbitrage ?? 0) - (x.exec?.arbitrage ?? 0));
  const usdRow = a.routes.find((r) => r.label === "USD → INR");
  if (usdRow?.exec && usdRow.exec.arbitrage < inp.deal.minSaving && bestAbove[0]) add("FUNDING_SWITCH_ALERT", bestAbove[0].label, `USD advantage ${(usdRow.exec.arbitrage / BP).toFixed(0)} bp is below your ${min.toFixed(0)} bp hurdle — switch candidate ${bestAbove[0].label} at ${(bestAbove[0].exec!.arbitrage / BP).toFixed(0)} bp (do not auto-execute)`, bestAbove[0].exec!.arbitrage / BP);
  for (const c of a.carry) {
    const now = c.usdCarryExec === null ? null : c.usdCarryExec / BP;
    const was = prev?.usdCarryBp[c.ccy] ?? null;
    if (now !== null && now >= min && (was === null || was < min)) add("USD_CARRY_OPENED", `${c.ccy}→USD`, `${c.ccy} → USD synthetic funding is ${now.toFixed(0)} bp cheaper than direct USD`, now);
    if (now !== null && was !== null && now - was >= CHANGE_BP && now >= min) add("USD_CARRY_STRENGTHENED", `${c.ccy}→USD`, `${c.ccy}/USD carry increased from ${was.toFixed(0)} bp to ${now.toFixed(0)} bp`, now);
    if (now !== null && was !== null && was >= min && now < min) add("USD_CARRY_CLOSED", `${c.ccy}→USD`, `${c.ccy} → USD synthetic advantage fell below your minimum`, now);
    if (c.inrCarryViaUsd !== null && c.inrCarryViaUsd >= inp.deal.minSaving) add("USD_TO_INR_ARBITRAGE", `${c.ccy}→USD→INR`, `${c.ccy} → USD → INR remains ${(c.inrCarryViaUsd / BP).toFixed(0)} bp cheaper than domestic INR funding after the hedge`, c.inrCarryViaUsd / BP);
  }
  const usdList = a.carry.filter((c) => c.usdCarryExec !== null).sort((x, y) => (y.usdCarryExec as number) - (x.usdCarryExec as number));
  if (prev && usdList[0]) {
    const pb = Object.entries(prev.usdCarryBp).filter(([, v]) => v !== null).sort((x, y) => (y[1] as number) - (x[1] as number))[0];
    if (pb && pb[0] !== usdList[0].ccy) add("USD_CARRY_SWITCH", `${usdList[0].ccy}→USD`, `${usdList[0].ccy} → USD is now cheaper than ${pb[0]} → USD`, null);
  }
  return out;
}

export interface SignalRecord {
  signal_id: string;
  first_seen: string;
  last_seen: string;
  threshold: number;
  previous_value: number | null;
  current_value: number | null;
  notification_status: "NOTIFIED" | "SUPPRESSED";
  message: string;
  type: SignalType;
}

/** Alert cooldown: re-alert only when the condition materially changes (|Δvalue| ≥ threshold) or it is new. */
export function applyCooldown(records: SignalRecord[], signals: Signal[], nowIso: string, threshold = 5): { records: SignalRecord[]; alerts: Signal[] } {
  const byId = new Map(records.map((r) => [r.signal_id, r]));
  const alerts: Signal[] = [];
  const next: SignalRecord[] = [];
  for (const s of signals) {
    const ex = byId.get(s.id);
    if (!ex) {
      alerts.push(s);
      next.push({ signal_id: s.id, first_seen: nowIso, last_seen: nowIso, threshold, previous_value: null, current_value: s.value, notification_status: "NOTIFIED", message: s.message, type: s.type });
      continue;
    }
    const moved = s.value !== null && ex.current_value !== null ? Math.abs(s.value - ex.current_value) >= threshold : false;
    if (moved) {
      alerts.push(s);
      next.push({ ...ex, last_seen: nowIso, previous_value: ex.current_value, current_value: s.value, notification_status: "NOTIFIED", message: s.message });
    } else next.push({ ...ex, last_seen: nowIso, notification_status: "SUPPRESSED", message: s.message });
  }
  return { records: next, alerts };
}
