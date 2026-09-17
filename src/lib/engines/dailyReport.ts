import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { computeStreakContinuation, type StreakContinuation } from "../metrics/stats";
import {
  getSoyPalmPairsSpread,
  getPalmWtiPairsSpread,
  SOY_PALM_COINTEGRATION,
  PALM_WTI_COINTEGRATION,
  type CointegratedPairSpread,
} from "./oilseedsPairsCointegration";
import {
  getPalmOilIndividualDiagnostics,
  getSoybeanOilIndividualDiagnostics,
  getWtiCrudeIndividualDiagnostics,
  type IndividualDiagnostics,
} from "./individualMeanReversion";

/**
 * Synthesizes the real cointegration + individual mean-reversion engines
 * into one daily briefing — every number here is read from those engines
 * (already tested against real data), not recomputed or invented. This file
 * only adds plain-language framing (regime labels, watch levels, streak
 * continuation) on top of numbers that already exist elsewhere in the app.
 */

export type RegimeLabel = "Overheated (Extreme)" | "Overheated" | "Neutral" | "Underperforming" | "Underperforming (Extreme)";

function regimeFromZ(z: number | null): RegimeLabel | null {
  if (z === null) return null;
  if (z >= 2) return "Overheated (Extreme)";
  if (z >= 1) return "Overheated";
  if (z <= -2) return "Underperforming (Extreme)";
  if (z <= -1) return "Underperforming";
  return "Neutral";
}

const REGIME_TONE: Record<RegimeLabel, "rich" | "neutral" | "cheap"> = {
  "Overheated (Extreme)": "rich",
  Overheated: "rich",
  Neutral: "neutral",
  Underperforming: "cheap",
  "Underperforming (Extreme)": "cheap",
};

function guidanceFor(z: number | null, subject: string, actionableFair: boolean): string {
  if (z === null) return "Not enough data yet to characterize this one.";
  const regime = regimeFromZ(z)!;
  const tone = REGIME_TONE[regime];
  const anchor = actionableFair ? "its fitted fair-value level" : "its own recent trend";
  if (tone === "rich") {
    const intensity = regime === "Overheated (Extreme)" ? "Historically rare and stretched" : "Somewhat stretched";
    return `${intensity} above ${anchor}. In the historical record, buying fresh at levels like this had less support than waiting — the data leans toward Hold or Trim, not fresh Buying.`;
  }
  if (tone === "cheap") {
    const intensity = regime === "Underperforming (Extreme)" ? "Historically rare and stretched" : "Somewhat stretched";
    return `${intensity} below ${anchor}. In the historical record, levels like this were more often followed by a firming than a further slide — the data leans toward Hold or Accumulate, not fresh Selling.`;
  }
  return `Close to ${anchor} right now — no strong historical lean toward Buying or Selling from here. The data supports Hold / wait for a clearer stretch in either direction.`;
}

export type TurnaroundEntry = { timelineLabel: string; confidencePct: number | null; sampleSize: number };

export type ReportRow = {
  id: string;
  title: string;
  kind: "individual" | "pair";
  unit: string;
  currentValue: number | null;
  asOfDate: string | null;
  zScore: number | null;
  regime: RegimeLabel | null;
  guidance: string;
  watchLow: number | null; // nearest short-horizon "support"/lower band
  watchHigh: number | null; // nearest short-horizon "resistance"/upper band
  fairValue: number | null; // only set for pairs (real tested turnaround anchor); null for individual commodities
  turnaround: TurnaroundEntry[];
  streak: StreakContinuation;
  streakPeriodLabel: string; // "trading day" or "month"
};

function pairToRow(data: CointegratedPairSpread, config: typeof SOY_PALM_COINTEGRATION | typeof PALM_WTI_COINTEGRATION, id: string, title: string, unit: string): ReportRow {
  const short = data.reversionStats[0];
  const mid = data.reversionStats[1];
  const long = data.reversionStats[data.reversionStats.length - 1];
  const fairBand = data.priceBands.find((b) => b.z === 0) ?? null;
  const lowBand = data.priceBands.find((b) => b.z === -1) ?? null;
  const highBand = data.priceBands.find((b) => b.z === 1) ?? null;
  return {
    id,
    title,
    kind: "pair",
    unit,
    currentValue: data.aPrice,
    asOfDate: data.latestDate,
    zScore: data.zScore5y,
    regime: regimeFromZ(data.zScore5y),
    guidance: guidanceFor(data.zScore5y, title, true),
    watchLow: lowBand?.price ?? null,
    watchHigh: highBand?.price ?? null,
    fairValue: fairBand?.price ?? null,
    turnaround: [
      { timelineLabel: `${short.horizonMonths} months`, confidencePct: short.revertedPct, sampleSize: short.sampleSize },
      { timelineLabel: `${mid.horizonMonths} months`, confidencePct: mid.revertedPct, sampleSize: mid.sampleSize },
      { timelineLabel: `${long.horizonMonths} months`, confidencePct: long.revertedPct, sampleSize: long.sampleSize },
    ],
    streak: { direction: 0, currentLength: 0, historicalSampleSize: 0, continuationPct: null }, // filled by caller with real spread-history streak
    streakPeriodLabel: "month",
  };
}

function individualToRow(data: IndividualDiagnostics, id: string): ReportRow {
  const short = data.reversionStats[0];
  const mid = data.reversionStats[1];
  const long = data.reversionStats[data.reversionStats.length - 1];
  const shortBand = data.bands[0] ?? null;
  return {
    id,
    title: data.config.label,
    kind: "individual",
    unit: data.config.unit,
    currentValue: data.price,
    asOfDate: data.latestDate,
    zScore: data.zScore,
    regime: regimeFromZ(data.zScore),
    guidance: guidanceFor(data.zScore, data.config.label, false),
    watchLow: shortBand?.lo1 ?? null,
    watchHigh: shortBand?.hi1 ?? null,
    fairValue: null, // no real mean-reversion target exists for a single non-stationary price — see individualMeanReversion.ts
    turnaround: [
      { timelineLabel: `+${short.horizonPeriods} ${data.config.frequency === "daily" ? "trading days" : "months"}`, confidencePct: short.revertedPct, sampleSize: short.sampleSize },
      { timelineLabel: `+${mid.horizonPeriods} ${data.config.frequency === "daily" ? "trading days" : "months"}`, confidencePct: mid.revertedPct, sampleSize: mid.sampleSize },
      { timelineLabel: `+${long.horizonPeriods} ${data.config.frequency === "daily" ? "trading days" : "months"}`, confidencePct: long.revertedPct, sampleSize: long.sampleSize },
    ],
    streak: { direction: 0, currentLength: 0, historicalSampleSize: 0, continuationPct: null }, // filled by caller
    streakPeriodLabel: data.config.frequency === "daily" ? "trading day" : "month",
  };
}

export type DailyReport = {
  generatedAt: string;
  rows: ReportRow[];
};

export async function getDailyReport(db: SupabaseClient): Promise<DailyReport | null> {
  const [soyPalm, palmWti, palmDiag, soyDiag, wtiDiag] = await Promise.all([
    getSoyPalmPairsSpread(db),
    getPalmWtiPairsSpread(db),
    getPalmOilIndividualDiagnostics(db),
    getSoybeanOilIndividualDiagnostics(db),
    getWtiCrudeIndividualDiagnostics(db),
  ]);

  const rows: ReportRow[] = [];

  if (palmDiag) {
    const series = await fetchSeries(db, palmDiag.config.metricKey, "1900-01-01T00:00:00.000Z");
    const row = individualToRow(palmDiag, "palm_oil");
    row.streak = computeStreakContinuation(series);
    rows.push(row);
  }
  if (soyDiag) {
    const series = await fetchSeries(db, soyDiag.config.metricKey, "1900-01-01T00:00:00.000Z");
    const row = individualToRow(soyDiag, "soybean_oil");
    row.streak = computeStreakContinuation(series);
    rows.push(row);
  }
  if (wtiDiag) {
    const series = await fetchSeries(db, wtiDiag.config.metricKey, "1900-01-01T00:00:00.000Z");
    const row = individualToRow(wtiDiag, "wti_crude");
    row.streak = computeStreakContinuation(series);
    rows.push(row);
  }
  if (soyPalm) {
    const row = pairToRow(soyPalm, SOY_PALM_COINTEGRATION, "soy_palm_spread", "Soybean Oil / Palm Oil Spread", "$/mt");
    row.streak = computeStreakContinuation(soyPalm.history);
    rows.push(row);
  }
  if (palmWti) {
    const row = pairToRow(palmWti, PALM_WTI_COINTEGRATION, "palm_wti_spread", "Palm Oil / WTI Crude Spread", "$/mt");
    row.streak = computeStreakContinuation(palmWti.history);
    rows.push(row);
  }

  if (rows.length === 0) return null;
  return { generatedAt: new Date().toISOString(), rows };
}
