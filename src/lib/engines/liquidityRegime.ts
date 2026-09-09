import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { zScore, subtractSeriesByDate, mean, stdev, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";

/**
 * Per-central-bank AMPLE/ADEQUATE/NORMAL/TIGHTENING/DEFICIT classification
 * for the Liquidity dashboard — the Global Liquidity engine (globalLiquidity.ts)
 * blends everything below into ONE composite G7+China score, which answers
 * "how tight is liquidity globally" but not "is the Fed specifically ample
 * or the ECB specifically tight right now" — this module answers the
 * per-bank question directly, using the same real, free, daily data.
 *
 * The classification basis is deliberately the money-market-rate-vs-policy-
 * rate SPREAD (SOFR-IORB, SONIA-Bank Rate, CORRA-Target, €STR-Deposit
 * Facility Rate), not just balance-sheet size — this is the actual
 * "ample vs scarce reserves" framework central banks themselves use: under
 * a floor system the market rate should sit a few bps BELOW the policy
 * rate when reserves are ample, and prints AT or ABOVE it (arbitrage/
 * collateral pressure) when reserves are getting scarce — the same
 * mechanism behind the September 2019 US repo spike. A raw balance-sheet
 * z-score would only say "bigger/smaller than its own recent trend", which
 * is a real but much weaker signal.
 *
 * Two of six deliberately do NOT use a spread, disclosed rather than
 * papered over:
 * - Bank of Japan: no free daily BOJ policy/target-rate time series was
 *   found to pair with the uncollateralized overnight call rate (BOJ's
 *   MD07/"Reserves" database doesn't publish one as its own series) — so
 *   Japan is classified on the call rate's own level trend instead.
 * - PBOC (China): classified on its 3-month interbank rate's own level
 *   trend, the same rate-side proxy used elsewhere in this project (no free
 *   PBOC policy-rate/target-rate series exists to form a spread against it,
 *   the same limitation Japan has). Its Balance Sheet column is no longer
 *   empty, though: China's monthly Official Reserve Assets minus Gold
 *   (IMF-compiled via FRED, gap-filled forward each month by SAFE's own
 *   fresher release — see chinaFxReserves.ts) is shown as real context, the
 *   same "shown, not used for classification" role Japan's own balance
 *   sheet plays below.
 *
 * IMPORTANT: every regime label here is relative to that SAME bank's own
 * trailing ~1-year z-score, not a universal absolute threshold shared
 * across banks — the same convention every other z-scored engine in this
 * project already uses (see stats.ts). A "DEFICIT" read does not mean the
 * same absolute spread width for the Fed as for the ECB, and does not by
 * itself mean a crisis-level reading — e.g. the ECB narrowed its own rate
 * corridor in April 2024, which mechanically pushed €STR-DFR structurally
 * closer to zero than its pre-2024 range; a reading near the top of that
 * bank's OWN recent range can score as "DEFICIT" even at a numerically
 * modest spread. Read each row as "unusually tight/loose for this bank
 * lately," not as a cross-bank-comparable absolute scale.
 */

export type LiquidityRegimeLabel = "AMPLE" | "ADEQUATE" | "NORMAL" | "TIGHTENING" | "DEFICIT" | "INSUFFICIENT_DATA";

function regimeFromZ(z: number | null): LiquidityRegimeLabel {
  if (z === null) return "INSUFFICIENT_DATA";
  const clamped = Math.max(-3, Math.min(3, z));
  const score = ((clamped + 3) / 6) * 100;
  if (score < 20) return "AMPLE";
  if (score < 40) return "ADEQUATE";
  if (score < 60) return "NORMAL";
  if (score < 80) return "TIGHTENING";
  return "DEFICIT";
}

/**
 * Forecast: NOT a prediction from any forward-looking instrument (no free
 * OIS-forwards or central-bank-dot-plot feed is tracked here) — it is a
 * plain ordinary-least-squares extrapolation of each bank's OWN recent
 * trend in its real basis series (the same spread/rate used for the
 * current-regime classification above), projected forward and re-scored
 * against the same trailing baseline. It answers "if the trend of the last
 * N days continues unchanged, where would this bank's regime land" — a
 * momentum read, not a guaranteed outcome. A policy decision, QT
 * taper/restart, or funding-market shock is not modeled and can invalidate
 * it instantly; see the "Model estimate — not a guaranteed forecast"
 * disclaimer next to every engine.
 *
 * Three horizons, each with its own slope-estimation window (calendar
 * days, not observation count — this matters because China's basis series
 * is monthly while every other bank's is daily; a 30-calendar-day window
 * around a monthly print correctly yields INSUFFICIENT_DATA rather than a
 * regression fit to a single point):
 * - short term:  ~2 weeks ahead,  slope fit over the trailing 30 days
 * - medium term: ~2 months ahead, slope fit over the trailing 120 days
 * - long term:   ~6 months ahead, slope fit over the trailing 400 days
 */
export type MomentumLabel = "EASING" | "STABLE" | "TIGHTENING" | "INSUFFICIENT_DATA";

export type ForecastCell = {
  regime: LiquidityRegimeLabel;
  momentum: MomentumLabel;
};

export type CentralBankForecast = {
  shortTerm: ForecastCell;
  mediumTerm: ForecastCell;
  longTerm: ForecastCell;
};

const FORECAST_BASELINE_WINDOW = 252;
const MIN_SLOPE_POINTS = 5;
const INSUFFICIENT_FORECAST_CELL: ForecastCell = { regime: "INSUFFICIENT_DATA", momentum: "INSUFFICIENT_DATA" };

/** Ordinary-least-squares slope (value per calendar day) of a point series. */
function olsSlope(points: Point[]): number | null {
  if (points.length < 2) return null;
  const t0 = new Date(points[0].t).getTime();
  const xs = points.map((p) => (new Date(p.t).getTime() - t0) / 86400000);
  const ys = points.map((p) => p.v);
  const xMean = mean(xs);
  const yMean = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function forecastCell(sorted: Point[], baseline: Point[], slopeWindowDays: number, horizonDays: number): ForecastCell {
  if (baseline.length < 20 || sorted.length === 0) return INSUFFICIENT_FORECAST_CELL;
  const current = sorted[sorted.length - 1];
  const cutoffMs = new Date(current.t).getTime() - slopeWindowDays * 86400000;
  const recentForSlope = sorted.filter((p) => new Date(p.t).getTime() >= cutoffMs);
  if (recentForSlope.length < MIN_SLOPE_POINTS) return INSUFFICIENT_FORECAST_CELL;
  const slope = olsSlope(recentForSlope);
  if (slope === null) return INSUFFICIENT_FORECAST_CELL;
  const vals = baseline.map((p) => p.v);
  const m = mean(vals);
  const sd = stdev(vals);
  if (Number.isNaN(sd)) return INSUFFICIENT_FORECAST_CELL;
  const projected = current.v + slope * horizonDays;
  const zNow = sd === 0 ? 0 : (current.v - m) / sd;
  const zProjected = sd === 0 ? (projected === m ? 0 : projected > m ? 3 : -3) : (projected - m) / sd;
  const regime = regimeFromZ(zProjected);
  const delta = zProjected - zNow;
  const momentum: MomentumLabel = Math.abs(delta) < 0.25 ? "STABLE" : delta > 0 ? "TIGHTENING" : "EASING";
  return { regime, momentum };
}

/** Builds the 3-horizon forecast from the same basis series (spread or level) used for the current regime. */
function buildForecast(points: Point[]): CentralBankForecast {
  const sorted = [...points].sort((a, b) => (a.t < b.t ? -1 : 1));
  if (sorted.length < 20) {
    return { shortTerm: INSUFFICIENT_FORECAST_CELL, mediumTerm: INSUFFICIENT_FORECAST_CELL, longTerm: INSUFFICIENT_FORECAST_CELL };
  }
  const baseline = sorted.slice(Math.max(0, sorted.length - 1 - FORECAST_BASELINE_WINDOW), sorted.length - 1);
  return {
    shortTerm: forecastCell(sorted, baseline, 30, 14),
    mediumTerm: forecastCell(sorted, baseline, 120, 60),
    longTerm: forecastCell(sorted, baseline, 400, 180),
  };
}

export type CentralBankLiquidityRow = {
  bank: string;
  balanceSheetLabel: string;
  balanceSheetValue: number | null;
  balanceSheetUnit: string;
  balanceSheetAsOf: string | null;
  basisLabel: string;
  basisValue: number | null;
  basisUnit: string;
  basisAsOf: string | null;
  regime: LiquidityRegimeLabel;
  forecast: CentralBankForecast;
};

async function loadSeries(db: SupabaseClient, key: string, frequency: "daily" | "weekly" | "monthly" = "daily"): Promise<Point[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDaysFor(frequency));
  return fetchSeries(db, key, since.toISOString());
}

function latest(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.t > b.t ? a : b));
}

function spreadRow(
  bank: string,
  balanceSheetLabel: string,
  balanceSheet: Point[],
  balanceSheetUnit: string,
  basisLabel: string,
  moneyMarketRate: Point[],
  policyRate: Point[]
): CentralBankLiquidityRow {
  const spreadPp = subtractSeriesByDate(moneyMarketRate, policyRate);
  const spreadBps = spreadPp.map((p) => ({ t: p.t, v: p.v * 100 }));
  const regime = regimeFromZ(zScore(spreadBps, 252));
  const bs = latest(balanceSheet);
  const spread = latest(spreadBps);
  return {
    bank,
    balanceSheetLabel,
    balanceSheetValue: bs?.v ?? null,
    balanceSheetUnit,
    balanceSheetAsOf: bs?.t ?? null,
    basisLabel,
    basisValue: spread?.v ?? null,
    basisUnit: "bps",
    basisAsOf: spread?.t ?? null,
    regime,
    forecast: buildForecast(spreadBps),
  };
}

function levelRow(
  bank: string,
  balanceSheetLabel: string,
  balanceSheet: Point[],
  balanceSheetUnit: string,
  basisLabel: string,
  basisUnit: string,
  rate: Point[]
): CentralBankLiquidityRow {
  const regime = regimeFromZ(zScore(rate, 252));
  const bs = latest(balanceSheet);
  const r = latest(rate);
  return {
    bank,
    balanceSheetLabel,
    balanceSheetValue: bs?.v ?? null,
    balanceSheetUnit,
    balanceSheetAsOf: bs?.t ?? null,
    basisLabel,
    basisValue: r?.v ?? null,
    basisUnit,
    basisAsOf: r?.t ?? null,
    regime,
    forecast: buildForecast(rate),
  };
}

export async function getCentralBankLiquidityTable(db: SupabaseClient): Promise<CentralBankLiquidityRow[]> {
  const [fedBS, iorb, sofr, ukReserves, sonia, bankRate, ecbBS, estr, dfr, bojBS, callRate, bocAssets, corra, target, chinaRate, chinaReservesExGold] =
    await Promise.all([
      loadSeries(db, "liquidity.fed_reserve_balances", "weekly"),
      loadSeries(db, "rate.us_iorb"),
      loadSeries(db, "rate.sofr"),
      loadSeries(db, "liquidity.uk_boe_reserves", "weekly"),
      loadSeries(db, "rate.uk_sonia"),
      loadSeries(db, "rate.uk_bank_rate"),
      loadSeries(db, "liquidity.ecb_balance_sheet", "weekly"),
      loadSeries(db, "rate.ecb_estr"),
      loadSeries(db, "rate.ecb_deposit_facility"),
      loadSeries(db, "liquidity.boj_balance_sheet", "monthly"),
      loadSeries(db, "rate.japan_call_rate"),
      loadSeries(db, "liquidity.canada_boc_assets", "weekly"),
      loadSeries(db, "rate.canada_corra"),
      loadSeries(db, "rate.canada_target"),
      loadSeries(db, "china.interbank_rate_3m", "monthly"),
      loadSeries(db, "liquidity.china_reserves_ex_gold", "monthly"),
    ]);

  return [
    spreadRow("Federal Reserve (US)", "Reserve Balances", fedBS, "USD mm", "SOFR − IORB", sofr, iorb),
    spreadRow("Bank of England (UK)", "Reserve Balances", ukReserves, "GBP mm", "SONIA − Bank Rate", sonia, bankRate),
    spreadRow("European Central Bank", "Balance Sheet", ecbBS, "EUR mm", "€STR − Deposit Facility Rate", estr, dfr),
    spreadRow("Bank of Canada", "Total Assets", bocAssets, "CAD mm", "CORRA − Target Rate", corra, target),
    levelRow("Bank of Japan", "Balance Sheet (monthly)", bojBS, "JPY bn", "O/N Call Rate (level, no free target-rate series to pair it with)", "%", callRate),
    levelRow("PBOC (China)", "Official Reserves ex-Gold (SAFE/FRED)", chinaReservesExGold, "USD mm", "3M Interbank Rate (level, rate-side proxy)", "%", chinaRate),
  ];
}
