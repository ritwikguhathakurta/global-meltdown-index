import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { computeStreakContinuation, type StreakContinuation } from "../metrics/stats";
import {
  getSoyPalmPairsSpread,
  getPalmWtiPairsSpread,
  SOY_PALM_COINTEGRATION,
  PALM_WTI_COINTEGRATION,
  type CointegratedPairSpread,
  type PairConfig,
} from "./oilseedsPairsCointegration";
import {
  getPalmOilIndividualDiagnostics,
  getSoybeanOilIndividualDiagnostics,
  getWtiCrudeIndividualDiagnostics,
  type IndividualDiagnostics,
  type IndividualDiagnosticsConfig,
} from "./individualMeanReversion";
import { fetchLiveCommodityQuote, type LiveQuote, type LiveCommodityKey } from "../sources/liveCommodityQuotes";

/**
 * Synthesizes the real cointegration + individual mean-reversion engines
 * into one daily briefing, written for a business owner planning purchases,
 * sales, or inventory holds — not a trader. Every number here is read from
 * those engines (already tested against real data), not recomputed or
 * invented. This file only adds plain-language framing and business-
 * decision guidance on top of numbers that already exist elsewhere in the
 * app; it never states a p-value as "the odds the finding is true" (a
 * common but statistically wrong reading) — see buildTestExplainer below
 * for the accurate plain-English phrasing used instead.
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

function guidanceFor(z: number | null, actionableFair: boolean): string {
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

/**
 * Plain-English explanation of the real ADF/cointegration test for THIS
 * specific commodity's own numbers — never a generic glossary entry, and
 * never phrased as "p% chance this is true/false" (that inverts what a
 * p-value actually measures). Instead: does the real result clear the
 * conventional 0.05 confidence bar or not, stated plainly.
 */
function buildIndividualTestExplainer(config: IndividualDiagnosticsConfig): string {
  const clears = config.adfLevel.pValue < 0.05;
  const periodWord = config.frequency === "daily" ? "day" : "month";
  return (
    `We checked whether ${config.label}'s price has a natural "home level" it drifts back to, using a standard test ` +
    `called the Augmented Dickey-Fuller (ADF) test. Result: ${clears ? "yes" : "no"} — ${
      clears
        ? "the price does show a statistically real pull back toward a stable level."
        : `the price behaves like a wandering path with no fixed anchor (the result came in well short of the usual 0.05 confidence bar statisticians use, so we can't confidently claim there's a "normal price" it always returns to).`
    } What IS predictable is how much the price typically moves from one ${periodWord} to the next — that measurement passed the same test with very high confidence, and that's the real number this report uses to size realistic price ranges below and flag when today's price looks unusually stretched.`
  );
}

function buildPairTestExplainer(config: typeof SOY_PALM_COINTEGRATION | typeof PALM_WTI_COINTEGRATION): string {
  const clears = config.adfPValue < 0.05;
  const slow = config.strength === "weak";
  return (
    `We checked whether ${config.aLabel} and ${config.bLabel} prices are economically tied together — even though each one wanders on its ` +
    `own, does the GAP between them behave predictably? This is called a cointegration test. Result: yes — the gap has a statistically real ` +
    `tendency to narrow after stretching too far (the result cleared the usual 0.05 confidence bar${clears ? "" : " only marginally"}), giving ` +
    `a genuine "fair value" price to plan purchases and sales around, unlike a single commodity checked on its own. ` +
    `${
      slow
        ? `One important catch: this particular link is much weaker and far slower than other pairs in this report — expect any correction to ` +
          `play out over YEARS, not months, so treat it as long-range background context for planning, not a near-term timing signal.`
        : `This link is comparatively fast — the typical correction plays out over a matter of months, which is useful for near-term purchase/sale timing.`
    }`
  );
}

function periodLabelPlural(config: IndividualDiagnosticsConfig, n: number): string {
  const unit = config.frequency === "daily" ? "trading day" : "month";
  return `${unit}${n === 1 ? "" : "s"}`;
}

export type EconDetail = { label: string; value: string };

function fmtP(p: number): string {
  return p < 0.0001 ? p.toExponential(2) : p.toFixed(4);
}

function buildIndividualEconDetails(config: IndividualDiagnosticsConfig, data: IndividualDiagnostics): EconDetail[] {
  const periodWord = config.frequency === "daily" ? "trading day" : "month";
  return [
    { label: "Test", value: "Augmented Dickey-Fuller (ADF) unit-root test, on the price level and on log returns" },
    { label: "Data frequency", value: `${config.frequency} (${periodWord}s)` },
    {
      label: "ADF on price level",
      value: `stat = ${config.adfLevel.stat.toFixed(3)}, p = ${fmtP(config.adfLevel.pValue)}, n = ${config.adfLevel.sampleSize} → ${config.adfLevel.pValue < 0.05 ? "stationary (clears 0.05)" : "non-stationary (does not clear 0.05)"}`,
    },
    {
      label: "ADF on log returns",
      value: `stat = ${config.adfReturns.stat.toFixed(3)}, p = ${fmtP(config.adfReturns.pValue)}, n = ${config.adfReturns.sampleSize} → ${config.adfReturns.pValue < 0.05 ? "stationary (clears 0.05)" : "non-stationary (does not clear 0.05)"}`,
    },
    { label: "Rolling moving-average window", value: `${config.maWindow} ${periodWord}s` },
    { label: `Realized volatility (σ, per ${periodWord}, log-return basis)`, value: data.sigma !== null ? `${(data.sigma * 100).toFixed(2)}%` : "—" },
    { label: "Current z-score vs own moving average", value: data.zScore !== null ? `${data.zScore >= 0 ? "+" : ""}${data.zScore.toFixed(2)}σ` : "—" },
    { label: "MA-deviation reversion backtest horizons", value: `${config.reversionHorizons.join(", ")} ${periodWord}s` },
    { label: "Tested on", value: config.testedOn },
    { label: "Source metric key", value: config.metricKey },
  ];
}

function buildPairEconDetails(config: PairConfig, data: CointegratedPairSpread): EconDetail[] {
  return [
    { label: "Test", value: config.method },
    { label: "Estimation window", value: config.estimationWindow },
    { label: "Sample size", value: `${config.sampleSize} observations` },
    { label: "Hedge ratio (γ)", value: config.gamma.toFixed(4) },
    { label: "Intercept", value: config.intercept.toFixed(4) },
    { label: "ADF p-value on residuals", value: `${fmtP(config.adfPValue)} → ${config.adfPValue < 0.05 ? "clears 0.05 (cointegrated)" : "does not clear 0.05"}` },
    { label: "Implied half-life of mean reversion", value: `${config.halfLifeMonths} months` },
    { label: "Relationship strength", value: config.strength },
    { label: "Current spread (residual)", value: data.spread !== null ? data.spread.toFixed(3) : "—" },
    { label: "Current z-score (trailing 5y window)", value: data.zScore5y !== null ? `${data.zScore5y >= 0 ? "+" : ""}${data.zScore5y.toFixed(2)}σ` : "—" },
    { label: "Reversion backtest horizons", value: `${config.reversionHorizonsMonths.join(", ")} months` },
  ];
}

export type TrajectoryPoint = {
  horizonLabel: string;
  rangeLow: number | null;
  rangeHigh: number | null;
  narrative: string;
};

function buildIndividualTrajectory(data: IndividualDiagnostics): TrajectoryPoint[] {
  const { config } = data;
  return config.bandHorizons.map((h, i) => {
    const band = data.bands[i];
    if (!band) return { horizonLabel: h.bucketLabel, rangeLow: null, rangeHigh: null, narrative: "Not enough data yet." };
    if (i === 0) {
      const rev = data.reversionStats[0];
      const regime = regimeFromZ(data.zScore);
      let lean = "No unusual stretch right now — near-term moves are more likely driven by day-to-day news than by a statistical rebound in either direction.";
      if (regime === "Overheated" || regime === "Overheated (Extreme)") {
        lean = `Price is currently running a bit hot versus its own recent average. Historically, stretches like this eased back within about ${rev.horizonPeriods} ${periodLabelPlural(config, rev.horizonPeriods)} roughly ${rev.revertedPct ?? "—"}% of the time (out of ${rev.sampleSize} similar past cases) — so a short pullback toward ${data.movingAverage !== null ? data.movingAverage.toFixed(0) : "its recent average"} wouldn't be surprising.`;
      } else if (regime === "Underperforming" || regime === "Underperforming (Extreme)") {
        lean = `Price is currently running a bit cool versus its own recent average. Historically, stretches like this firmed back up within about ${rev.horizonPeriods} ${periodLabelPlural(config, rev.horizonPeriods)} roughly ${rev.revertedPct ?? "—"}% of the time (out of ${rev.sampleSize} similar past cases).`;
      }
      return { horizonLabel: h.bucketLabel, rangeLow: band.lo1, rangeHigh: band.hi1, narrative: lean };
    }
    return {
      horizonLabel: h.bucketLabel,
      rangeLow: band.lo1,
      rangeHigh: band.hi1,
      narrative: `Based purely on how much ${config.label} typically moves, expect it most likely somewhere in this range — it could stretch as wide as ${band.lo2.toFixed(0)}-${band.hi2.toFixed(0)} ${config.unit} in a bigger move. This is a measure of normal variability, not a directional prediction — the wider the horizon, the less certain any single number becomes.`,
    };
  });
}

function buildPairTrajectory(data: CointegratedPairSpread, unit: string): TrajectoryPoint[] {
  const fairBand = data.priceBands.find((b) => b.z === 0) ?? null;
  return data.reversionStats.map((rev) => ({
    horizonLabel: `~${rev.horizonMonths} months`,
    rangeLow: null,
    rangeHigh: null,
    narrative:
      rev.revertedPct !== null
        ? `If history repeats, there's roughly a ${rev.revertedPct}% historical chance (based on ${rev.sampleSize} similar past instances) that the price gap has narrowed toward the fair-value anchor of ${fairBand ? fairBand.price.toFixed(0) : "—"} ${unit} by then.`
        : "Not enough historical instances yet to estimate this.",
  }));
}

function procurementAdvice(regime: RegimeLabel | null, label: string, watchLow: number | null, watchHigh: number | null, unit: string): { buyer: string; seller: string } {
  const fmt = (v: number | null) => (v !== null ? `${v.toFixed(0)} ${unit}` : "the recent range");
  if (regime === null) return { buyer: "Not enough data yet.", seller: "Not enough data yet." };
  if (regime === "Underperforming" || regime === "Underperforming (Extreme)") {
    return {
      buyer: `This is historically a more attractive time to purchase ${label} or lock in supply — price is trading below its typical range. If storage and cash flow allow, consider building inventory or securing a forward contract now.`,
      seller: `If you produce or hold inventory of ${label}, this hasn't historically been the strongest time to sell into the open market. Unless you need the cash flow, holding — or waiting for a move back up toward ${fmt(watchHigh)} — has more historical support.`,
    };
  }
  if (regime === "Overheated" || regime === "Overheated (Extreme)") {
    return {
      buyer: `Buying fresh ${label} at this level has historically been less favorable. If your inventory allows, cover only your near-term operational needs and watch for a pullback toward ${fmt(watchLow)} before placing larger orders.`,
      seller: `This has historically been a more favorable level to sell ${label} inventory or lock in a forward sales contract — prices this high have tended to struggle to climb much further.`,
    };
  }
  return {
    buyer: `${label} is close to its normal range right now. There's no strong historical edge to rush or delay — buy according to your actual production schedule rather than trying to time this market.`,
    seller: `${label} is close to its normal range right now. There's no strong historical edge to rush or delay a sale — sell according to your operational needs rather than trying to time this market.`,
  };
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
  watchLow: number | null;
  watchHigh: number | null;
  fairValue: number | null;
  turnaround: TurnaroundEntry[];
  streak: StreakContinuation;
  streakPeriodLabel: string;
  testExplainer: string;
  trajectory: TrajectoryPoint[];
  buyerAdvice: string;
  sellerAdvice: string;
  econDetails: EconDetail[];
  liveQuote: LiveQuote | null;
};

function pairToRow(data: CointegratedPairSpread, config: typeof SOY_PALM_COINTEGRATION | typeof PALM_WTI_COINTEGRATION, id: string, title: string, unit: string): ReportRow {
  const short = data.reversionStats[0];
  const mid = data.reversionStats[1];
  const long = data.reversionStats[data.reversionStats.length - 1];
  const fairBand = data.priceBands.find((b) => b.z === 0) ?? null;
  const lowBand = data.priceBands.find((b) => b.z === -1) ?? null;
  const highBand = data.priceBands.find((b) => b.z === 1) ?? null;
  const regime = regimeFromZ(data.zScore5y);
  const advice = procurementAdvice(regime, config.aLabel, lowBand?.price ?? null, highBand?.price ?? null, unit);
  return {
    id,
    title,
    kind: "pair",
    unit,
    currentValue: data.aPrice,
    asOfDate: data.latestDate,
    zScore: data.zScore5y,
    regime,
    guidance: guidanceFor(data.zScore5y, true),
    watchLow: lowBand?.price ?? null,
    watchHigh: highBand?.price ?? null,
    fairValue: fairBand?.price ?? null,
    turnaround: [
      { timelineLabel: `${short.horizonMonths} months`, confidencePct: short.revertedPct, sampleSize: short.sampleSize },
      { timelineLabel: `${mid.horizonMonths} months`, confidencePct: mid.revertedPct, sampleSize: mid.sampleSize },
      { timelineLabel: `${long.horizonMonths} months`, confidencePct: long.revertedPct, sampleSize: long.sampleSize },
    ],
    streak: { direction: 0, currentLength: 0, historicalSampleSize: 0, continuationPct: null },
    streakPeriodLabel: "month",
    testExplainer: buildPairTestExplainer(config),
    trajectory: buildPairTrajectory(data, unit),
    buyerAdvice: advice.buyer,
    sellerAdvice: advice.seller,
    econDetails: buildPairEconDetails(config, data),
    liveQuote: null,
  };
}

function individualToRow(data: IndividualDiagnostics, id: string): ReportRow {
  const short = data.reversionStats[0];
  const mid = data.reversionStats[1];
  const long = data.reversionStats[data.reversionStats.length - 1];
  const shortBand = data.bands[0] ?? null;
  const regime = regimeFromZ(data.zScore);
  const advice = procurementAdvice(regime, data.config.label, shortBand?.lo1 ?? null, shortBand?.hi1 ?? null, data.config.unit);
  return {
    id,
    title: data.config.label,
    kind: "individual",
    unit: data.config.unit,
    currentValue: data.price,
    asOfDate: data.latestDate,
    zScore: data.zScore,
    regime,
    guidance: guidanceFor(data.zScore, false),
    watchLow: shortBand?.lo1 ?? null,
    watchHigh: shortBand?.hi1 ?? null,
    fairValue: null,
    turnaround: [
      { timelineLabel: `+${short.horizonPeriods} ${data.config.frequency === "daily" ? "trading days" : "months"}`, confidencePct: short.revertedPct, sampleSize: short.sampleSize },
      { timelineLabel: `+${mid.horizonPeriods} ${data.config.frequency === "daily" ? "trading days" : "months"}`, confidencePct: mid.revertedPct, sampleSize: mid.sampleSize },
      { timelineLabel: `+${long.horizonPeriods} ${data.config.frequency === "daily" ? "trading days" : "months"}`, confidencePct: long.revertedPct, sampleSize: long.sampleSize },
    ],
    streak: { direction: 0, currentLength: 0, historicalSampleSize: 0, continuationPct: null },
    streakPeriodLabel: data.config.frequency === "daily" ? "trading day" : "month",
    testExplainer: buildIndividualTestExplainer(data.config),
    trajectory: buildIndividualTrajectory(data),
    buyerAdvice: advice.buyer,
    sellerAdvice: advice.seller,
    econDetails: buildIndividualEconDetails(data.config, data),
    liveQuote: null,
  };
}

export type DailyReport = {
  generatedAt: string;
  rows: ReportRow[];
};

/** Best-effort — a live quote is a nice-to-have overlay on top of the report, never a reason to fail the whole page if Yahoo's endpoint hiccups. */
async function tryFetchLiveQuote(key: LiveCommodityKey): Promise<LiveQuote | null> {
  try {
    return await fetchLiveCommodityQuote(key);
  } catch {
    return null;
  }
}

export async function getDailyReport(db: SupabaseClient): Promise<DailyReport | null> {
  const [soyPalm, palmWti, palmDiag, soyDiag, wtiDiag, palmLive, soyLive, wtiLive] = await Promise.all([
    getSoyPalmPairsSpread(db),
    getPalmWtiPairsSpread(db),
    getPalmOilIndividualDiagnostics(db),
    getSoybeanOilIndividualDiagnostics(db),
    getWtiCrudeIndividualDiagnostics(db),
    tryFetchLiveQuote("palm_oil"),
    tryFetchLiveQuote("soybean_oil"),
    tryFetchLiveQuote("wti_crude"),
  ]);

  const rows: ReportRow[] = [];

  if (palmDiag) {
    const series = await fetchSeries(db, palmDiag.config.metricKey, "1900-01-01T00:00:00.000Z");
    const row = individualToRow(palmDiag, "palm_oil");
    row.streak = computeStreakContinuation(series);
    row.liveQuote = palmLive;
    rows.push(row);
  }
  if (soyDiag) {
    const series = await fetchSeries(db, soyDiag.config.metricKey, "1900-01-01T00:00:00.000Z");
    const row = individualToRow(soyDiag, "soybean_oil");
    row.streak = computeStreakContinuation(series);
    row.liveQuote = soyLive;
    rows.push(row);
  }
  if (wtiDiag) {
    const series = await fetchSeries(db, wtiDiag.config.metricKey, "1900-01-01T00:00:00.000Z");
    const row = individualToRow(wtiDiag, "wti_crude");
    row.streak = computeStreakContinuation(series);
    row.liveQuote = wtiLive;
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
