import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { mean } from "../metrics/stats";

/**
 * India has a well-documented, repeatedly-cited seasonal liquidity pattern:
 * banking-system liquidity tends to tighten in the weeks before Diwali
 * (festive currency demand pulls cash out of the banking system) and again
 * in the back half of March (advance-tax outflows into the government's
 * RBI account ahead of the March 15 due date, plus March 31 fiscal
 * year-end). This is RBI's and the financial press's own explanation for
 * repeated real episodes (e.g. reported deficits around Dec 2024 and March
 * 2026), not a pattern this project is asserting from nothing.
 *
 * This module turns that into a real, computed check against this
 * project's OWN ingested india.rbi_net_liquidity/india.wacr history
 * (rbiLiquidity.ts, backfilled via rbiArchive.ts) rather than just citing
 * the pattern in prose — but only makes a claim about a given year's window
 * when there are enough real observations in it to say something; thin
 * years are named as such (still accumulating), never silently skipped or
 * papered over with an assumed value.
 */

// Real, public dates (Diwali follows a lunar calendar, not a formula) — used only to define
// analysis windows, never as a substitute for an actual data point.
const DIWALI_DATES: string[] = ["2022-10-24", "2023-11-12", "2024-10-31", "2025-10-21", "2026-11-08", "2027-10-29"];

const MIN_WINDOW_OBSERVATIONS = 5;

function inWindow(points: { t: string; v: number }[], startIso: string, endIso: string): number[] {
  return points.filter((p) => p.t >= startIso && p.t <= endIso).map((p) => p.v);
}

function fmtCrore(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${Math.round(v).toLocaleString("en-IN")} crore`;
}

export async function computeIndiaSeasonalNotes(db: SupabaseClient, asOfIso: string): Promise<string[]> {
  const since = new Date(asOfIso);
  since.setUTCFullYear(since.getUTCFullYear() - 4);
  const [netLiquidity, wacr] = await Promise.all([
    fetchSeries(db, "india.rbi_net_liquidity", since.toISOString()),
    fetchSeries(db, "india.wacr", since.toISOString()),
  ]);

  if (netLiquidity.length < MIN_WINDOW_OBSERVATIONS) {
    return ["India liquidity seasonal analysis: still accumulating history (RBI daily net-liquidity backfill just started) — not enough real observations yet to check the documented pre-Diwali/March pattern against this project's own data."];
  }

  const fullPeriodMean = mean(netLiquidity.map((p) => p.v));
  const notes: string[] = [];

  for (const diwali of DIWALI_DATES) {
    const year = Number(diwali.slice(0, 4));
    const start = new Date(diwali);
    start.setUTCDate(start.getUTCDate() - 21);
    const startIso = start.toISOString().slice(0, 10);
    if (startIso > asOfIso.slice(0, 10)) continue; // window hasn't happened yet
    const windowVals = inWindow(netLiquidity, startIso, diwali);
    if (windowVals.length < MIN_WINDOW_OBSERVATIONS) {
      notes.push(`Diwali ${year} (${diwali}): pre-festival window not yet covered by this project's own RBI history (only ${windowVals.length} observation(s) — accumulating).`);
      continue;
    }
    const windowMean = mean(windowVals);
    const delta = windowMean - fullPeriodMean;
    notes.push(
      `21 days before Diwali ${year} (${diwali}): RBI's own net-liquidity figure averaged ${fmtCrore(windowMean)} vs a ${fmtCrore(fullPeriodMean)} multi-year average (${delta > 0 ? "tighter" : "looser"} than typical by ${fmtCrore(Math.abs(delta))}), from ${windowVals.length} real observations.`
    );
  }

  for (let year = Number(since.getUTCFullYear()); year <= Number(asOfIso.slice(0, 4)); year++) {
    const startIso = `${year}-03-15`;
    const endIso = `${year}-03-31`;
    if (endIso > asOfIso.slice(0, 10) && startIso > asOfIso.slice(0, 10)) continue;
    const windowVals = inWindow(netLiquidity, startIso, endIso);
    if (windowVals.length < MIN_WINDOW_OBSERVATIONS) {
      notes.push(`March ${year} fiscal year-end (Mar 15-31): not yet covered by this project's own RBI history (only ${windowVals.length} observation(s) — accumulating).`);
      continue;
    }
    const windowMean = mean(windowVals);
    const delta = windowMean - fullPeriodMean;
    notes.push(
      `March ${year} fiscal year-end (Mar 15-31): RBI's own net-liquidity figure averaged ${fmtCrore(windowMean)} vs a ${fmtCrore(fullPeriodMean)} multi-year average (${delta > 0 ? "tighter" : "looser"} than typical by ${fmtCrore(Math.abs(delta))}), from ${windowVals.length} real observations.`
    );
  }

  if (wacr.length >= MIN_WINDOW_OBSERVATIONS) {
    notes.push(`(WACR history also tracked, ${wacr.length} observations — see the India Liquidity engine for its current level relative to trailing range.)`);
  }

  return notes;
}

/** Real calendar fact, used only to flag current seasonal proximity — never to fabricate a data point. */
export function daysUntilNearestDiwali(asOfIso: string): number {
  const asOfMs = new Date(asOfIso).getTime();
  let nearest = Infinity;
  for (const d of DIWALI_DATES) {
    const diff = (new Date(d).getTime() - asOfMs) / 86400000;
    if (Math.abs(diff) < Math.abs(nearest)) nearest = diff;
  }
  return nearest;
}

export function currentSeasonalAmplifiers(asOfIso: string): string[] {
  const out: string[] = [];
  const untilDiwali = daysUntilNearestDiwali(asOfIso);
  if (untilDiwali >= 0 && untilDiwali <= 21) {
    out.push(
      `Within the pre-Diwali festive-currency-demand window (${Math.round(untilDiwali)} day(s) out) — historically the period when public cash withdrawals drain banking-system liquidity fastest.`
    );
  }
  const month = Number(asOfIso.slice(5, 7));
  const day = Number(asOfIso.slice(8, 10));
  if (month === 3 && day >= 15) {
    out.push(
      "Within India's fiscal year-end window (mid-to-late March) — advance-tax outflows (due Mar 15) and Mar 31 year-end have repeatedly driven banking-system liquidity into deficit around this date."
    );
  }
  return out;
}
