import { fetchFredSeries, FRED_SERIES } from "./fred";
import { fetchUkShortRates, fetchCanadaShortRates, fetchBojCallRate } from "./govBondYields";
import { fetchIndiaLiquiditySeries } from "./rbiLiquidity";
import type { MetricPoint } from "../metrics/store";
import type { CentralBankKey } from "../engines/centralBankDecisionImpact";

/**
 * On-demand, un-stored "live" central-bank rate readings for the Banking
 * tab — reuses the EXACT same connector functions the once-daily pipeline
 * already calls (fetchFredSeries, fetchUkShortRates, fetchCanadaShortRates,
 * fetchBojCallRate, fetchIndiaLiquiditySeries), just invoked directly from
 * the page at render time instead of waiting for the next cron run. Same
 * sources, same Tier 1 official data, just fetched fresher.
 *
 * "Live" here means "as fresh as this source has ever published" (matching
 * this app's freshness-badge convention elsewhere), NOT an intraday tick —
 * these are policy/near-policy rates, most of which only carry one
 * observation per business day (BOJ's call rate and RBI's WACR are
 * REALIZED averages that do settle once per session; the target-rate
 * series like BoE Bank Rate or BoC's target only change on a decision day
 * but are still republished daily). Display-only, like liveCommodityQuotes.ts/
 * liveMarketQuotes.ts — never fed into the stored series' own z-score/
 * event-study math, which needs a consistent historical run, not a live
 * splice.
 */

export type LiveRateReading = { rate: number; asOfDate: string; fetchedAt: string };

function latestOf(points: MetricPoint[], metricKey: string): LiveRateReading | null {
  const filtered = points.filter((p) => p.metric_key === metricKey);
  if (filtered.length === 0) return null;
  const sorted = [...filtered].sort((a, b) => (a.observed_at < b.observed_at ? -1 : 1));
  const last = sorted[sorted.length - 1];
  return { rate: last.value, asOfDate: last.observed_at.slice(0, 10), fetchedAt: new Date().toISOString() };
}

function recentSinceIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function fetchLiveFred(metricKey: string, lookbackDays: number): Promise<LiveRateReading | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;
  const def = FRED_SERIES.find((d) => d.metricKey === metricKey);
  if (!def) return null;
  const points = await fetchFredSeries(def, apiKey, recentSinceIso(lookbackDays));
  return latestOf(points, metricKey);
}

export async function fetchLiveCentralBankRate(key: CentralBankKey): Promise<LiveRateReading | null> {
  try {
    switch (key) {
      case "fed":
        return await fetchLiveFred("rate.fed_funds_effective", 14);
      case "ecb":
        return await fetchLiveFred("rate.ecb_deposit_facility", 14);
      // China's 3-month interbank rate is monthly (no free daily PBOC-adjacent
      // series exists — see centralBankDecisionImpact.ts) so needs a much
      // longer lookback to reliably contain at least one observation.
      case "pboc":
        return await fetchLiveFred("rate.china_interbank_3m", 120);
      case "boe": {
        const points = await fetchUkShortRates();
        return latestOf(points, "rate.uk_bank_rate");
      }
      case "boc": {
        const points = await fetchCanadaShortRates();
        return latestOf(points, "rate.canada_target");
      }
      case "boj": {
        const points = await fetchBojCallRate();
        return latestOf(points, "rate.japan_call_rate");
      }
      case "rbi": {
        const points = await fetchIndiaLiquiditySeries();
        return latestOf(points, "india.wacr");
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function fetchAllLiveCentralBankRates(keys: CentralBankKey[]): Promise<Map<CentralBankKey, LiveRateReading | null>> {
  const results = await Promise.all(keys.map((key) => fetchLiveCentralBankRate(key)));
  return new Map(keys.map((key, i) => [key, results[i]]));
}
