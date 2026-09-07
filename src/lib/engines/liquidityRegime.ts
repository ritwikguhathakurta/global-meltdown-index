import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { zScore, subtractSeriesByDate, type Point } from "../metrics/stats";
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
 * - PBOC (China): already a rate-side-only proxy elsewhere in this project
 *   (no free PBOC balance-sheet/reserve-money series exists) — classified
 *   on its 3-month interbank rate's own level trend.
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
  };
}

export async function getCentralBankLiquidityTable(db: SupabaseClient): Promise<CentralBankLiquidityRow[]> {
  const [fedBS, iorb, sofr, ukReserves, sonia, bankRate, ecbBS, estr, dfr, bojBS, callRate, bocAssets, corra, target, chinaRate] =
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
    ]);

  return [
    spreadRow("Federal Reserve (US)", "Reserve Balances", fedBS, "USD mm", "SOFR − IORB", sofr, iorb),
    spreadRow("Bank of England (UK)", "Reserve Balances", ukReserves, "GBP mm", "SONIA − Bank Rate", sonia, bankRate),
    spreadRow("European Central Bank", "Balance Sheet", ecbBS, "EUR mm", "€STR − Deposit Facility Rate", estr, dfr),
    spreadRow("Bank of Canada", "Total Assets", bocAssets, "CAD mm", "CORRA − Target Rate", corra, target),
    levelRow("Bank of Japan", "Balance Sheet (monthly)", bojBS, "JPY bn", "O/N Call Rate (level, no free target-rate series to pair it with)", "%", callRate),
    levelRow("PBOC (China)", "No free balance-sheet/reserve-money series found", [], "", "3M Interbank Rate (level, rate-side proxy only)", "%", chinaRate),
  ];
}
