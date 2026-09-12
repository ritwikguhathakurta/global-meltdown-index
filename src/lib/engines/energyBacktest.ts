import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { rollingZScoreSeries, zToRiskScore, computeAUC, computeBrierScore } from "../metrics/stats";

/**
 * Historical Backtesting proxy (spec §142-145: lead-time/AUC/Brier-score
 * validation against real crises back to 1973). GESRI's own structural
 * inputs (IMF PortWatch chokepoint data, EIA country balances) only exist
 * from ~2019 onward — fabricating a 50-year retroactive history for the
 * full multi-domain composite would violate this project's own data-
 * integrity rule, so this does NOT claim to backtest GESRI itself.
 *
 * Instead: a single real long-run series that genuinely does go back to
 * 1973 and beyond — FRED's WTISPLC (WTI spot price, monthly, since 1946) —
 * is used as a simplified PROXY risk signal (a rolling z-score of the price
 * level against its own trailing 5-year mean), validated against a fixed
 * list of well-documented historical energy-crisis dates. This tests
 * whether "oil price is unusually high relative to its own recent history"
 * would have flagged elevated risk around real crises — a legitimate but
 * narrow sensitivity check on ONE signal, explicitly not a claim that this
 * engine (or anything resembling its current 4-domain methodology) existed
 * or would have scored the same way during any of these events.
 */

const WTI_LONGRUN_KEY = "energy.wti_longrun_monthly";
const ZSCORE_WINDOW_MONTHS = 60; // 5-year trailing monthly baseline
const RISK_THRESHOLD = 60;
const POSITIVE_WINDOW_MONTHS = 2; // crisis month + following 2 months count as "in crisis" for labeling
export const LEAD_LOOKBACK_MONTHS = 12;

export type HistoricalCrisisEvent = { id: string; label: string; date: string; description: string };

export const HISTORICAL_ENERGY_CRISES: HistoricalCrisisEvent[] = [
  { id: "1973_oil_embargo", label: "1973 OPEC Oil Embargo", date: "1973-10-01", description: "OAPEC's embargo against the US and other nations following the Yom Kippur War roughly quadrupled oil prices within months." },
  { id: "1979_iranian_revolution", label: "1979 Iranian Revolution", date: "1979-01-01", description: "Iranian oil exports collapsed amid revolution, contributing to a second oil price shock through 1980." },
  { id: "1980_iran_iraq_war", label: "1980 Iran-Iraq War", date: "1980-09-01", description: "War between two major OPEC producers removed a large share of their combined export capacity." },
  { id: "1990_gulf_war", label: "1990 Gulf War (Iraq invades Kuwait)", date: "1990-08-01", description: "Iraq's invasion of Kuwait removed both countries' oil exports from the market simultaneously." },
  { id: "2008_price_spike", label: "2008 Oil Price Spike", date: "2008-07-01", description: "WTI crude peaked near $147/barrel amid strong demand and speculative flows, shortly before the global financial crisis." },
  { id: "2014_price_collapse", label: "2014-2016 Oil Price Collapse", date: "2014-11-01", description: "OPEC's decision not to cut output amid the US shale boom triggered a prolonged price collapse." },
  { id: "2020_covid_collapse", label: "2020 COVID Demand Collapse", date: "2020-03-01", description: "Global lockdowns crushed oil demand; WTI futures briefly traded negative in April 2020." },
  { id: "2022_russia_invasion", label: "2022 Russia's Invasion of Ukraine", date: "2022-02-01", description: "Sanctions and supply fears drove a sharp spike in oil and especially European gas prices." },
];

export type BacktestMonthPoint = { date: string; price: number | null; score: number };

export type CrisisBacktestRow = {
  event: HistoricalCrisisEvent;
  scoreAtEvent: number | null;
  peakScoreNearby: number | null; // max proxy score within +/-3 months of the event
  leadTimeMonths: number | null; // months before the event the proxy first crossed the threshold (0 = same month); null = never crossed within the lookback window
};

export type EnergyBacktestResult = {
  series: BacktestMonthPoint[];
  events: CrisisBacktestRow[];
  threshold: number;
  positiveWindowMonths: number;
  auc: number | null;
  brierScore: number | null;
  dataStart: string | null;
  dataEnd: string | null;
};

function addMonths(yyyyMm: string, delta: number): string {
  const d = new Date(`${yyyyMm}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export async function getEnergyBacktestResult(db: SupabaseClient): Promise<EnergyBacktestResult> {
  const raw = await fetchSeries(db, WTI_LONGRUN_KEY, "1940-01-01");
  if (raw.length === 0) {
    return { series: [], events: [], threshold: RISK_THRESHOLD, positiveWindowMonths: POSITIVE_WINDOW_MONTHS, auc: null, brierScore: null, dataStart: null, dataEnd: null };
  }

  const priceByMonth = new Map(raw.map((p) => [p.t.slice(0, 7), p.v]));
  const zSeries = rollingZScoreSeries(raw, ZSCORE_WINDOW_MONTHS);
  const scoreByMonth = new Map<string, number>();
  for (const p of zSeries) {
    const month = p.t.slice(0, 7);
    scoreByMonth.set(month, zToRiskScore(p.v, 1) ?? 0);
  }

  const months = [...scoreByMonth.keys()].sort();
  const series: BacktestMonthPoint[] = months.map((month) => ({
    date: month,
    price: priceByMonth.get(month) ?? null,
    score: scoreByMonth.get(month) as number,
  }));

  const positiveMonths = new Set<string>();
  for (const ev of HISTORICAL_ENERGY_CRISES) {
    const evMonth = ev.date.slice(0, 7);
    for (let k = 0; k <= POSITIVE_WINDOW_MONTHS; k++) positiveMonths.add(addMonths(evMonth, k));
  }

  const labeled = series.map((p) => ({ score: p.score, positive: positiveMonths.has(p.date) }));
  const auc = computeAUC(labeled);
  const brierScore = computeBrierScore(labeled.map((p) => ({ probability: p.score / 100, positive: p.positive })));

  const events: CrisisBacktestRow[] = HISTORICAL_ENERGY_CRISES.map((ev) => {
    const evMonth = ev.date.slice(0, 7);
    const scoreAtEvent = scoreByMonth.get(evMonth) ?? null;

    let peakScoreNearby: number | null = null;
    for (let k = -3; k <= 3; k++) {
      const s = scoreByMonth.get(addMonths(evMonth, k));
      if (s !== undefined) peakScoreNearby = peakScoreNearby === null ? s : Math.max(peakScoreNearby, s);
    }

    let leadTimeMonths: number | null = null;
    for (let k = LEAD_LOOKBACK_MONTHS; k >= 0; k--) {
      const s = scoreByMonth.get(addMonths(evMonth, -k));
      if (s !== undefined && s >= RISK_THRESHOLD) {
        leadTimeMonths = k;
        break;
      }
    }

    return { event: ev, scoreAtEvent, peakScoreNearby, leadTimeMonths };
  });

  return {
    series,
    events,
    threshold: RISK_THRESHOLD,
    positiveWindowMonths: POSITIVE_WINDOW_MONTHS,
    auc: auc !== null ? Math.round(auc * 1000) / 1000 : null,
    brierScore: brierScore !== null ? Math.round(brierScore * 1000) / 1000 : null,
    dataStart: series[0]?.date ?? null,
    dataEnd: series[series.length - 1]?.date ?? null,
  };
}
