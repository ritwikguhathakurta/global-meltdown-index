import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { mean, stdev, rollingZScoreSeries, type Point } from "../metrics/stats";

/**
 * Individual-commodity mean-reversion diagnostics — deliberately NOT the same
 * kind of claim as the cointegrated pairs spreads in oilseedsPairsCointegration.ts.
 * A real ADF unit-root test (via OpenBB/statsmodels, one-time, hardcoded below
 * for the same production-runtime reason as the pairs constants) confirms
 * each of these three price LEVELS is non-stationary — there is no fixed
 * price a single commodity's own history statistically "pulls back to."
 * Their RETURNS are stationary (also tested), which is the standard basis
 * for two honestly different tools, not a fabricated "mean reversion target":
 *
 * 1. A rolling-moving-average deviation z-score — a real, empirically
 *    backtested SHORT-HORIZON technical statistic (does a stretched reading
 *    vs. the trailing MA actually narrow a few days/months later, in this
 *    series' own real history?), not a proven long-run equilibrium the way
 *    cointegration proved for the pairs.
 * 2. A volatility-scaled statistical expected range at each horizon bucket
 *    (using the real, measured return volatility and a random-walk/sqrt-time
 *    projection — the same logic an options desk uses for an "expected
 *    move," not a support/resistance level the price is fated to respect).
 */

export type AdfResult = { stat: number; pValue: number; sampleSize: number };

export type IndividualDiagnosticsConfig = {
  metricKey: string;
  label: string;
  unit: string;
  frequency: "daily" | "monthly";
  maWindow: number; // rolling window, in the series' own native periods
  adfLevel: AdfResult; // one-time OpenBB/statsmodels ADF test on the raw price level
  adfReturns: AdfResult; // same test on log returns
  reversionHorizons: number[]; // short-horizon periods (days or months) the MA-deviation backtest checks
  bandHorizons: { periods: number; bucketLabel: string }[]; // exactly 3: short/medium/long
  testedOn: string; // date this session's OpenBB tests were run
};

export const PALM_OIL_DIAGNOSTICS_CONFIG: IndividualDiagnosticsConfig = {
  metricKey: "commodity.palm_oil.cme_futures_price",
  label: "Palm Oil",
  unit: "$/mt",
  frequency: "daily",
  maWindow: 20,
  adfLevel: { stat: -0.5362425832722385, pValue: 0.8847478679393209, sampleSize: 252 },
  adfReturns: { stat: -16.54952633163493, pValue: 1.9507950758408248e-29, sampleSize: 251 },
  reversionHorizons: [5, 10, 20],
  bandHorizons: [
    { periods: 30, bucketLabel: "Short term (0-30 days)" },
    { periods: 90, bucketLabel: "Medium term (31-90 days)" },
    { periods: 180, bucketLabel: "Long term (>90 days)" },
  ],
  testedOn: "2026-09-17",
};

export const SOYBEAN_OIL_DIAGNOSTICS_CONFIG: IndividualDiagnosticsConfig = {
  metricKey: "commodity.soybean_oil.price",
  label: "Soybean Oil",
  unit: "$/mt",
  frequency: "monthly",
  maWindow: 12,
  adfLevel: { stat: -1.6273109565068593, pValue: 0.46889857686282277, sampleSize: 786 },
  adfReturns: { stat: -18.14075498310645, pValue: 2.491230030716898e-30, sampleSize: 797 },
  reversionHorizons: [1, 3, 6],
  bandHorizons: [
    { periods: 1, bucketLabel: "Short term (~0-30 days)" },
    { periods: 3, bucketLabel: "Medium term (~31-90 days)" },
    { periods: 12, bucketLabel: "Long term (>90 days)" },
  ],
  testedOn: "2026-09-17",
};

export const WTI_CRUDE_DIAGNOSTICS_CONFIG: IndividualDiagnosticsConfig = {
  metricKey: "commodity.wti_crude.price",
  label: "WTI Crude Oil",
  unit: "$/bbl",
  frequency: "monthly",
  maWindow: 12,
  adfLevel: { stat: -1.7999380704371462, pValue: 0.38049244034937296, sampleSize: 529 },
  adfReturns: { stat: -12.685745417643217, pValue: 1.1607084249778889e-23, sampleSize: 531 },
  reversionHorizons: [1, 3, 6],
  bandHorizons: [
    { periods: 1, bucketLabel: "Short term (~0-30 days)" },
    { periods: 3, bucketLabel: "Medium term (~31-90 days)" },
    { periods: 12, bucketLabel: "Long term (>90 days)" },
  ],
  testedOn: "2026-09-17",
};

export type BandRow = { periods: number; bucketLabel: string; lo1: number; hi1: number; lo2: number; hi2: number };
export type MaReversionStat = { horizonPeriods: number; sampleSize: number; revertedPct: number | null };

export type IndividualDiagnostics = {
  config: IndividualDiagnosticsConfig;
  latestDate: string | null;
  price: number | null;
  movingAverage: number | null;
  zScore: number | null;
  interpretation: "Extreme rich vs own trend" | "Rich vs own trend" | "Near own trend" | "Cheap vs own trend" | "Extreme cheap vs own trend" | null;
  sigma: number | null; // stdev of log returns, per native period
  bands: BandRow[];
  reversionStats: MaReversionStat[];
  zScoreHistory: Point[];
};

function interpret(z: number | null): IndividualDiagnostics["interpretation"] {
  if (z === null) return null;
  if (z >= 2) return "Extreme rich vs own trend";
  if (z >= 1) return "Rich vs own trend";
  if (z <= -2) return "Extreme cheap vs own trend";
  if (z <= -1) return "Cheap vs own trend";
  return "Near own trend";
}

function computeReversionStats(zHistory: Point[], horizons: number[]): MaReversionStat[] {
  return horizons.map((horizonPeriods) => {
    let sampleSize = 0;
    let reverted = 0;
    for (let i = 0; i < zHistory.length - horizonPeriods; i++) {
      if (Math.abs(zHistory[i].v) < 1) continue;
      sampleSize++;
      if (Math.abs(zHistory[i + horizonPeriods].v) < Math.abs(zHistory[i].v)) reverted++;
    }
    return { horizonPeriods, sampleSize, revertedPct: sampleSize > 0 ? Math.round((reverted / sampleSize) * 100) : null };
  });
}

async function computeIndividualDiagnostics(db: SupabaseClient, config: IndividualDiagnosticsConfig): Promise<IndividualDiagnostics | null> {
  const series = await fetchSeries(db, config.metricKey, "1900-01-01T00:00:00.000Z");
  if (series.length < config.maWindow + 20) return null;

  const sorted = [...series].sort((a, b) => (a.t < b.t ? -1 : 1));
  const returns: number[] = [];
  for (let i = 1; i < sorted.length; i++) returns.push(Math.log(sorted[i].v / sorted[i - 1].v));
  const sigma = stdev(returns);

  const zScoreHistory = rollingZScoreSeries(sorted, config.maWindow);
  if (zScoreHistory.length === 0) return null;
  const latestZ = zScoreHistory[zScoreHistory.length - 1];
  const latestPrice = sorted[sorted.length - 1];

  const window = sorted.slice(Math.max(0, sorted.length - 1 - config.maWindow), sorted.length - 1).map((p) => p.v);
  const movingAverage = window.length > 0 ? mean(window) : null;

  const bands: BandRow[] = Number.isNaN(sigma)
    ? []
    : config.bandHorizons.map(({ periods, bucketLabel }) => {
        const width1 = sigma * Math.sqrt(periods);
        return {
          periods,
          bucketLabel,
          lo1: latestPrice.v * Math.exp(-width1),
          hi1: latestPrice.v * Math.exp(width1),
          lo2: latestPrice.v * Math.exp(-2 * width1),
          hi2: latestPrice.v * Math.exp(2 * width1),
        };
      });

  return {
    config,
    latestDate: latestPrice.t,
    price: latestPrice.v,
    movingAverage,
    zScore: latestZ.v,
    interpretation: interpret(latestZ.v),
    sigma: Number.isNaN(sigma) ? null : sigma,
    bands,
    reversionStats: computeReversionStats(zScoreHistory, config.reversionHorizons),
    zScoreHistory,
  };
}

export async function getPalmOilIndividualDiagnostics(db: SupabaseClient): Promise<IndividualDiagnostics | null> {
  return computeIndividualDiagnostics(db, PALM_OIL_DIAGNOSTICS_CONFIG);
}

export async function getSoybeanOilIndividualDiagnostics(db: SupabaseClient): Promise<IndividualDiagnostics | null> {
  return computeIndividualDiagnostics(db, SOYBEAN_OIL_DIAGNOSTICS_CONFIG);
}

export async function getWtiCrudeIndividualDiagnostics(db: SupabaseClient): Promise<IndividualDiagnostics | null> {
  return computeIndividualDiagnostics(db, WTI_CRUDE_DIAGNOSTICS_CONFIG);
}
