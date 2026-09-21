import type { DayCount, PayFreq } from "./types";
import { ModelError } from "./units";

const MS_DAY = 86_400_000;

export function parseISO(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new ModelError("BAD_DATE", `invalid date: ${s}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}

/** Modified-following on weekends only (no holiday calendar is bundled — see limitations). */
export function adjustBusinessDay(d: Date): Date {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) {
    const fwd = new Date(d.getTime() + (dow === 6 ? 2 : 1) * MS_DAY);
    if (fwd.getUTCMonth() === d.getUTCMonth()) return fwd;
    return new Date(d.getTime() - (dow === 6 ? 1 : 2) * MS_DAY);
  }
  return d;
}

function days(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_DAY);
}

export function yearFraction(a: Date, b: Date, dc: DayCount): number {
  switch (dc) {
    case "ACT/360":
      return days(a, b) / 360;
    case "ACT/365":
      return days(a, b) / 365;
    case "30/360": {
      const d1 = Math.min(a.getUTCDate(), 30);
      const d2 = d1 === 30 ? Math.min(b.getUTCDate(), 30) : b.getUTCDate();
      return (360 * (b.getUTCFullYear() - a.getUTCFullYear()) + 30 * (b.getUTCMonth() - a.getUTCMonth()) + (d2 - d1)) / 360;
    }
    case "ACT/ACT": {
      let total = 0;
      let cur = a;
      while (cur < b) {
        const yEnd = new Date(Date.UTC(cur.getUTCFullYear() + 1, 0, 1));
        const seg = yEnd < b ? yEnd : b;
        const yDays = days(new Date(Date.UTC(cur.getUTCFullYear(), 0, 1)), yEnd);
        total += days(cur, seg) / yDays;
        cur = seg;
      }
      return total;
    }
  }
}

export interface Period {
  k: number;
  start: string;
  end: string;
  /** Model time in years = k / freq (regular periods count as exactly 1/freq). */
  t: number;
  /** Accrual fraction under the instrument's day-count convention. */
  accr: number;
  principalFrac: number;
  /** Outstanding fraction during this period (before this period's repayment). */
  outstanding: number;
}

export interface ScheduleSpec {
  startDate: string;
  tenorYears: number;
  paymentFreq: PayFreq;
  dayCount: DayCount;
  amortisation: "bullet" | "equal";
  graceYears: number;
}

export function buildSchedule(spec: ScheduleSpec): Period[] {
  const n = Math.round(spec.tenorYears * spec.paymentFreq);
  if (!Number.isFinite(n) || n < 1) throw new ModelError("BAD_TENOR", "tenor must cover at least one payment period");
  if (n > 480) throw new ModelError("BAD_TENOR", "tenor/frequency produces too many periods");
  const start = parseISO(spec.startDate);
  const months = 12 / spec.paymentFreq;
  const nGrace = Math.min(n - 1, Math.max(0, Math.round(spec.graceYears * spec.paymentFreq)));
  const nAmort = n - nGrace;
  const out: Period[] = [];
  let prev = start;
  let prevUnadj = start;
  let outstanding = 1;
  for (let k = 1; k <= n; k++) {
    const endUnadj = addMonths(start, months * k);
    const end = adjustBusinessDay(endUnadj);
    let frac = 0;
    if (spec.amortisation === "bullet") frac = k === n ? 1 : 0;
    else frac = k > nGrace ? 1 / nAmort : 0;
    out.push({
      k,
      start: isoDate(prev),
      end: isoDate(end),
      t: k / spec.paymentFreq,
      accr: yearFraction(prevUnadj, endUnadj, spec.dayCount),
      principalFrac: frac,
      outstanding,
    });
    outstanding -= frac;
    prev = end;
    prevUnadj = endUnadj;
  }
  return out;
}

/** Weighted average life (years) of the principal repayments. */
export function averageMaturity(sched: Period[]): number {
  return sched.reduce((s, p) => s + p.principalFrac * p.t, 0);
}
