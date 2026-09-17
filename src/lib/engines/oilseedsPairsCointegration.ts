import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { mean, stdev, rollingZScoreSeries, type Point } from "../metrics/stats";

/**
 * Cointegrated pairs spreads — hedge-ratio-adjusted companions to the naive
 * 1:1 spreads in oilseedsSpreads.ts. Both pairs below share the same
 * methodology: a one-time Engle-Granger cointegration test run locally
 * against this app's own real price history via OpenBB's econometrics
 * extension (statsmodels) fixes a hedge ratio (GAMMA) and intercept as
 * constants — refitting requires a Python/statsmodels runtime this app
 * doesn't run in production, so these are refreshed manually if/when a
 * relationship visibly breaks, not silently on every page load. The z-score,
 * chart, price bands, and empirical reversion stats DO update automatically
 * on every page load, since that part is plain arithmetic against the live
 * price series already in this app's own database.
 */

const ZSCORE_WINDOW_MONTHS = 60; // trailing 5 years — same convention as oilseedsSpreads.ts and the crush margin engine

export const SOY_PALM_COINTEGRATION = {
  aMetricKey: "commodity.soybean_oil.price",
  bMetricKey: "commodity.palm_oil.price",
  aLabel: "Soybean Oil",
  bLabel: "Palm Oil",
  intercept: 32.95703889925652,
  gamma: 1.131453538312826,
  estimationWindow: "2000-01 through 2026-08, monthly (World Bank Pink Sheet)",
  sampleSize: 320,
  adfPValue: 8.647168569440247e-8,
  halfLifeMonths: 5.4,
  method: "Engle-Granger two-step cointegration test (OLS + ADF on residuals), computed via OpenBB's econometrics extension (statsmodels), run locally on 2026-09-17",
  reversionHorizonsMonths: [3, 6, 12],
  strength: "strong" as const,
} as const;

/**
 * Palm Oil / WTI Crude Oil — the biodiesel-demand linkage between vegetable
 * oil and energy markets, not a direct substitute-good relationship like
 * soybean oil vs palm oil. Confirmed cointegrated (ADF p=0.024, 2010-2026,
 * n=200 — the post-RFS2/EU-RED biodiesel-mandate era, not the full
 * 1982-2026 history that predates any structural link at all), but MUCH
 * weaker: correlation 0.62 (vs 0.98 for soy/palm), and the fitted
 * error-correction speed implies a half-life of roughly 11 years, not
 * months. Granger causality (lag 3, modern era) found palm oil leads WTI
 * (p=0.024) but not the reverse (p=0.60) — the opposite direction from the
 * "energy prices drive biodiesel feedstock demand" assumption, reported as
 * found rather than adjusted to match expectation.
 */
export const PALM_WTI_COINTEGRATION = {
  aMetricKey: "commodity.palm_oil.price",
  bMetricKey: "commodity.wti_crude.price",
  aLabel: "Palm Oil",
  bLabel: "WTI Crude Oil",
  intercept: 409.4604649143939,
  gamma: 6.827185857515563,
  estimationWindow: "2010-01 through 2026-08, monthly (World Bank Pink Sheet / EIA)",
  sampleSize: 200,
  adfPValue: 0.024160892065932756,
  halfLifeMonths: 131,
  method: "Engle-Granger two-step cointegration test (OLS + ADF on residuals), computed via OpenBB's econometrics extension (statsmodels), run locally on 2026-09-17",
  reversionHorizonsMonths: [3, 6, 12, 24, 36],
  strength: "weak" as const,
} as const;

export type PairConfig = typeof SOY_PALM_COINTEGRATION | typeof PALM_WTI_COINTEGRATION;

export type PriceBand = { z: -2 | -1 | 0 | 1 | 2; price: number };

export type ReversionStat = {
  horizonMonths: number;
  sampleSize: number; // overlapping monthly observations, NOT independent events — see disclosure
  revertedPct: number | null; // % of the time |z| was smaller this many months later
};

export type CointegratedPairSpread = {
  latestDate: string | null;
  aPrice: number | null;
  bPrice: number | null;
  spread: number | null; // a_price - intercept - gamma * b_price
  zScore5y: number | null;
  interpretation: string | null;
  history: Point[]; // full residual (spread) series, for the raw-spread panel
  zScoreHistory: Point[]; // rolling 5Y z-score series, for the chart
  /** aLabel's price implied at each z-score level, holding today's actual bLabel price fixed. */
  priceBands: PriceBand[];
  /** Historical frequency that a similarly stretched reading moved back toward 0 by each horizon. */
  reversionStats: ReversionStat[];
};

function interpret(z: number | null, config: PairConfig): string | null {
  if (z === null) return null;
  if (z >= 2) return `${config.aLabel} extreme rich vs ${config.bLabel}`;
  if (z >= 1) return `${config.aLabel} rich vs ${config.bLabel}`;
  if (z <= -2) return `${config.aLabel} extreme cheap vs ${config.bLabel}`;
  if (z <= -1) return `${config.aLabel} cheap vs ${config.bLabel}`;
  return "Fair value";
}

/** For each |z|>=1 reading on/after the config's own estimation-window start, did |z| shrink by `horizon` months later? Plain historical frequency, not a fitted model — same convention as this app's other empirical-odds engines (e.g. price cycle transition probabilities). */
function computeReversionStats(zHistory: Point[], config: PairConfig): ReversionStat[] {
  const estimationStart = config.estimationWindow.slice(0, 7); // "YYYY-MM"
  const modern = zHistory.filter((p) => p.t.slice(0, 7) >= estimationStart);
  return config.reversionHorizonsMonths.map((horizonMonths) => {
    let sampleSize = 0;
    let reverted = 0;
    for (let i = 0; i < modern.length - horizonMonths; i++) {
      if (Math.abs(modern[i].v) < 1) continue; // only count already-stretched readings
      sampleSize++;
      if (Math.abs(modern[i + horizonMonths].v) < Math.abs(modern[i].v)) reverted++;
    }
    return { horizonMonths, sampleSize, revertedPct: sampleSize > 0 ? Math.round((reverted / sampleSize) * 100) : null };
  });
}

async function computeCointegratedPairSpread(db: SupabaseClient, config: PairConfig): Promise<CointegratedPairSpread | null> {
  const [a, b] = await Promise.all([
    fetchSeries(db, config.aMetricKey, "1900-01-01T00:00:00.000Z"),
    fetchSeries(db, config.bMetricKey, "1900-01-01T00:00:00.000Z"),
  ]);
  if (a.length === 0 || b.length === 0) return null;

  const bByDate = new Map(b.map((p) => [p.t, p.v]));
  const aByDate = new Map(a.map((p) => [p.t, p.v]));
  const residual: Point[] = [];
  for (const p of a) {
    const bVal = bByDate.get(p.t);
    if (bVal === undefined) continue;
    residual.push({ t: p.t, v: p.v - config.intercept - config.gamma * bVal });
  }
  residual.sort((x, y) => (x.t < y.t ? -1 : 1));
  if (residual.length < 20) return null;

  const zHistory = rollingZScoreSeries(residual, ZSCORE_WINDOW_MONTHS);
  const latestResidual = residual[residual.length - 1];
  const windowVals = residual.slice(Math.max(0, residual.length - 1 - ZSCORE_WINDOW_MONTHS), residual.length - 1).map((p) => p.v);
  let currentZ: number | null = null;
  let windowMean: number | null = null;
  let windowSd: number | null = null;
  if (windowVals.length >= 20) {
    windowMean = mean(windowVals);
    windowSd = stdev(windowVals);
    currentZ = Number.isNaN(windowSd) ? null : windowSd === 0 ? (latestResidual.v === windowMean ? 0 : latestResidual.v > windowMean ? 3 : -3) : (latestResidual.v - windowMean) / windowSd;
  }

  const latestB = bByDate.get(latestResidual.t) ?? null;
  const priceBands: PriceBand[] =
    latestB !== null && windowMean !== null && windowSd !== null && !Number.isNaN(windowSd)
      ? ([-2, -1, 0, 1, 2] as const).map((z) => ({
          z,
          price: config.intercept + config.gamma * latestB + windowMean! + z * windowSd!,
        }))
      : [];

  return {
    latestDate: latestResidual.t,
    aPrice: aByDate.get(latestResidual.t) ?? null,
    bPrice: latestB,
    spread: latestResidual.v,
    zScore5y: currentZ,
    interpretation: interpret(currentZ, config),
    history: residual,
    zScoreHistory: zHistory,
    priceBands,
    reversionStats: computeReversionStats(zHistory, config),
  };
}

export async function getSoyPalmPairsSpread(db: SupabaseClient): Promise<CointegratedPairSpread | null> {
  return computeCointegratedPairSpread(db, SOY_PALM_COINTEGRATION);
}

export async function getPalmWtiPairsSpread(db: SupabaseClient): Promise<CointegratedPairSpread | null> {
  return computeCointegratedPairSpread(db, PALM_WTI_COINTEGRATION);
}
