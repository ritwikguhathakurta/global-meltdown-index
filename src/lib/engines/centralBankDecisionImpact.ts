import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import type { Point } from "../metrics/stats";

/**
 * Central-bank policy-decision tracking + a real historical event study of
 * what happened next to that country's bank-equity proxy, for the Banking
 * tab. Generalizes bojDecisionImpact.ts (kept as the Japan-only prototype
 * this grew from) to every central bank this app already tracks a daily
 * official rate for: Fed, ECB (Germany/France/Italy share one Eurozone
 * decision), BoE, BoJ, BoC and RBI. PBOC/China is included too but is
 * genuinely different in kind, not just resolution — see CENTRAL_BANKS'
 * own comment on it.
 *
 * None of this is in this app's central-bank headline feed (centralBankRss.ts
 * only covers Fed/ECB/BOE/RBI press releases, and even those are dateless
 * headlines with no rate-decision parsing) — this is the only place a
 * policy decision's actual numeric effect shows up, detected directly from
 * the real stored rate series rather than a press release.
 *
 * Two real, live-recomputed (not hardcoded) pieces per bank:
 *
 * 1. Decision detection: most of these series are the announced policy
 *    rate itself (an exact, clean step function — ECB deposit facility,
 *    BoE Bank Rate, BoC target rate), but the Fed Funds Effective Rate,
 *    Japan's O/N call rate and India's WACR are all REALIZED market
 *    averages that wobble a few bp (India's, dramatically more) day to day
 *    even with no decision at all — verified live against this app's own
 *    stored history. Using one uniform algorithm for both kinds (rather
 *    than a fragile per-bank special case) costs the clean series a few
 *    days of detection lag and buys the noisy series real robustness: round
 *    to the nearest 5bp, and only confirm a level change once the new
 *    rounded level has persisted for `minPersistObs` consecutive
 *    observations (5 for daily series; monthly series need no smoothing at
 *    all, each point already being a settled monthly figure, so that's 1).
 *    Verified against this app's actual stored history for Japan: this
 *    method independently recovers every well-known real BOJ move on
 *    record, including the August 2000 zero-rate-policy exit — not tuned to
 *    produce that result, it just does.
 * 2. Event study: for every detected HIKE that falls within that bank's own
 *    equity proxy's data coverage, computes the real forward % change in
 *    that proxy at fixed trading-day horizons after the hike. Sample size
 *    is shown at every horizon and can be small by nature (BoJ only exited
 *    NIRP in March 2024) — never smoothed over or hidden.
 */

export type CentralBankKey = "fed" | "ecb" | "boe" | "boj" | "boc" | "pboc" | "rbi";

export type CentralBankConfig = {
  key: CentralBankKey;
  institution: string;
  countryLabel: string;
  rateLabel: string;
  rateMetricKey: string;
  rateFrequency: "daily" | "monthly";
  equityMetricKey: string;
  equityLabel: string;
  minPersistObs: number;
};

export const CENTRAL_BANKS: CentralBankConfig[] = [
  {
    key: "fed",
    institution: "Federal Reserve",
    countryLabel: "United States",
    rateLabel: "Fed Funds Effective Rate",
    rateMetricKey: "rate.fed_funds_effective",
    rateFrequency: "daily",
    equityMetricKey: "banking.equity_us",
    equityLabel: "KBW Nasdaq Bank Index",
    minPersistObs: 5,
  },
  {
    key: "ecb",
    institution: "European Central Bank",
    countryLabel: "Eurozone (Germany / France / Italy)",
    rateLabel: "ECB Deposit Facility Rate",
    rateMetricKey: "rate.ecb_deposit_facility",
    rateFrequency: "daily",
    equityMetricKey: "banking.equity_europe",
    equityLabel: "iShares STOXX Europe 600 Banks ETF",
    minPersistObs: 5,
  },
  {
    key: "boe",
    institution: "Bank of England",
    countryLabel: "United Kingdom",
    rateLabel: "Bank Rate",
    rateMetricKey: "rate.uk_bank_rate",
    rateFrequency: "daily",
    equityMetricKey: "banking.equity_uk",
    equityLabel: "Barclays (single-bank proxy)",
    minPersistObs: 5,
  },
  {
    key: "boj",
    institution: "Bank of Japan",
    countryLabel: "Japan",
    rateLabel: "O/N Uncollateralized Call Rate",
    rateMetricKey: "rate.japan_call_rate",
    rateFrequency: "daily",
    equityMetricKey: "banking.equity_japan",
    equityLabel: "TOPIX-17 Banks ETF",
    minPersistObs: 5,
  },
  {
    key: "boc",
    institution: "Bank of Canada",
    countryLabel: "Canada",
    rateLabel: "Target Overnight Rate",
    rateMetricKey: "rate.canada_target",
    rateFrequency: "daily",
    equityMetricKey: "banking.equity_canada",
    equityLabel: "BMO Equal Weight Banks ETF",
    minPersistObs: 5,
  },
  {
    key: "pboc",
    institution: "People's Bank of China",
    countryLabel: "China",
    // Not a single clean policy rate the way the other six have — China has
    // no free daily PBOC-adjacent series (checked directly, same conclusion
    // this app's China coverage documents elsewhere), so this uses the
    // monthly 3-month interbank rate as the closest available proxy.
    // "Decisions" detected here are level shifts in that proxy, not
    // confirmed PBOC actions.
    rateLabel: "3-Month Interbank Rate (proxy, monthly — no free daily PBOC rate exists)",
    rateMetricKey: "rate.china_interbank_3m",
    rateFrequency: "monthly",
    equityMetricKey: "banking.equity_china",
    equityLabel: "ICBC (single-bank proxy)",
    minPersistObs: 1,
  },
  {
    key: "rbi",
    institution: "Reserve Bank of India",
    countryLabel: "India",
    rateLabel: "Weighted Average Call Rate (WACR)",
    rateMetricKey: "india.wacr",
    rateFrequency: "daily",
    equityMetricKey: "banking.equity_india",
    equityLabel: "Nifty Bank Index",
    minPersistObs: 5,
  },
];

export type RateChangeEvent = {
  date: string;
  fromLevel: number;
  toLevel: number;
  changeBps: number; // positive = hike, negative = cut
};

export type HorizonEquityImpact = {
  horizonLabel: string;
  horizonTradingDays: number;
  sampleSize: number;
  avgChangePct: number | null;
  positiveCount: number; // how many of the sampled hikes were followed by a HIGHER bank-equity reading
};

export type BankDecisionImpact = {
  config: CentralBankConfig;
  latestRate: number | null;
  latestDate: string | null;
  lastEvent: RateChangeEvent | null;
  daysSinceLastEvent: number | null;
  hikeEvents: RateChangeEvent[];
  cutEvents: RateChangeEvent[];
  equityCoverageStart: string | null;
  eventStudySampleEvents: RateChangeEvent[];
  equityImpact: HorizonEquityImpact[];
};

const EQUITY_HORIZONS: { label: string; tradingDays: number }[] = [
  { label: "1 month (~20 trading days)", tradingDays: 20 },
  { label: "3 months (~60 trading days)", tradingDays: 60 },
  { label: "6 months (~120 trading days)", tradingDays: 120 },
];

const BUCKET = 0.05; // 5bp — coarser than any real central bank's own step size, so real moves always survive rounding
const MIN_MOVE_BPS = 10;

function roundToBucket(v: number, bucket: number): number {
  const r = Math.round(v / bucket) * bucket;
  return r === 0 ? 0 : r; // normalizes -0 (a rate hovering just below zero) to plain 0 for display
}

/** Exported for testability/verification — see file doc comment for why the naive "value changed" check doesn't work for the realized-average series. */
export function detectRateChangeEvents(series: Point[], minPersistObs: number, bucket = BUCKET, minMoveBps = MIN_MOVE_BPS): RateChangeEvent[] {
  const sorted = [...series].sort((a, b) => (a.t < b.t ? -1 : 1));
  const rounded = sorted.map((p) => ({ t: p.t, v: roundToBucket(p.v, bucket) }));

  const events: RateChangeEvent[] = [];
  let currentLevel: number | null = null;
  let candidateLevel: number | null = null;
  let candidateStartIdx = -1;
  let candidateCount = 0;

  for (let i = 0; i < rounded.length; i++) {
    const v = rounded[i].v;
    if (currentLevel === null) {
      currentLevel = v;
      continue;
    }
    if (v === currentLevel) {
      candidateLevel = null;
      candidateCount = 0;
      continue;
    }
    if (candidateLevel === v) {
      candidateCount++;
    } else {
      candidateLevel = v;
      candidateCount = 1;
      candidateStartIdx = i;
    }
    if (candidateCount >= minPersistObs) {
      const changeBps = Math.round((v - currentLevel) * 10000) / 100;
      if (Math.abs(changeBps) >= minMoveBps) {
        events.push({ date: rounded[candidateStartIdx].t, fromLevel: currentLevel, toLevel: v, changeBps });
      }
      currentLevel = v;
      candidateLevel = null;
      candidateCount = 0;
    }
  }
  return events;
}

function pctChangeAfter(equity: Point[], eventDateIso: string, tradingDays: number): number | null {
  const startIdx = equity.findIndex((p) => p.t >= eventDateIso);
  if (startIdx === -1) return null;
  const endIdx = startIdx + tradingDays;
  if (endIdx >= equity.length) return null; // not enough forward history yet for this horizon
  const startPrice = equity[startIdx].v;
  const endPrice = equity[endIdx].v;
  if (startPrice === 0) return null;
  return ((endPrice - startPrice) / startPrice) * 100;
}

async function computeOne(db: SupabaseClient, config: CentralBankConfig): Promise<BankDecisionImpact | null> {
  const [rateSeries, equitySeriesRaw] = await Promise.all([
    fetchSeries(db, config.rateMetricKey, "1900-01-01T00:00:00.000Z"),
    fetchSeries(db, config.equityMetricKey, "1900-01-01T00:00:00.000Z"),
  ]);
  if (rateSeries.length === 0) return null;

  const sortedRate = [...rateSeries].sort((a, b) => (a.t < b.t ? -1 : 1));
  const latest = sortedRate[sortedRate.length - 1];
  const events = detectRateChangeEvents(sortedRate, config.minPersistObs);
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const daysSinceLastEvent = lastEvent ? Math.round((new Date(latest.t).getTime() - new Date(lastEvent.date).getTime()) / 86400000) : null;

  const hikeEvents = events.filter((e) => e.changeBps > 0);
  const cutEvents = events.filter((e) => e.changeBps < 0);

  const sortedEquity = [...equitySeriesRaw].sort((a, b) => (a.t < b.t ? -1 : 1));
  const equityCoverageStart = sortedEquity.length > 0 ? sortedEquity[0].t : null;
  const eventStudySampleEvents = equityCoverageStart ? hikeEvents.filter((e) => e.date >= equityCoverageStart) : [];

  const equityImpact: HorizonEquityImpact[] = EQUITY_HORIZONS.map(({ label, tradingDays }) => {
    const changes = eventStudySampleEvents.map((e) => pctChangeAfter(sortedEquity, e.date, tradingDays)).filter((c): c is number => c !== null);
    const positiveCount = changes.filter((c) => c > 0).length;
    return {
      horizonLabel: label,
      horizonTradingDays: tradingDays,
      sampleSize: changes.length,
      avgChangePct: changes.length > 0 ? Math.round((changes.reduce((a, b) => a + b, 0) / changes.length) * 100) / 100 : null,
      positiveCount,
    };
  });

  return {
    config,
    latestRate: latest.v,
    latestDate: latest.t,
    lastEvent,
    daysSinceLastEvent,
    hikeEvents,
    cutEvents,
    equityCoverageStart,
    eventStudySampleEvents,
    equityImpact,
  };
}

export async function getCentralBankDecisionImpacts(db: SupabaseClient): Promise<BankDecisionImpact[]> {
  const results = await Promise.all(CENTRAL_BANKS.map((config) => computeOne(db, config)));
  return results.filter((r): r is BankDecisionImpact => r !== null);
}
