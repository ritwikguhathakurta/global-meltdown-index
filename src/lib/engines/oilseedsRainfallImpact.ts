import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import type { Point } from "../metrics/stats";
import { NASA_POWER_REGIONS } from "../sources/nasaPowerRainfall";

/**
 * Rainfall Impact Engine — Oilseeds. Answers three questions from data
 * already ingested this session (NASA POWER rainfall, BPS Indonesia
 * monthly production, World Bank Pink Sheet palm oil price, NOAA ONI, and
 * the new CPC ENSO probability forecast):
 *
 *  1. Was a given month's rainfall Deficit / Normal / Excess relative to
 *     that region's own history for that calendar month?
 *  2. Historically, when rainfall was in each regime, what fraction of
 *     the time did production (18 months later — a commonly cited oil
 *     palm FFB gestation lag in agronomic literature; NOT fitted or
 *     optimized against this data, to avoid look-ahead bias on a 66-item
 *     series) come in above / at / below its own seasonal norm? And how
 *     did palm oil price react in the following 3 months (a separate,
 *     much shorter market-reaction window, since prices respond to
 *     rainfall NEWS well before the resulting harvest actually prints)?
 *  3. Given NOAA CPC's own forecast of upcoming ENSO-phase probabilities,
 *     and this app's own historical ENSO-phase-vs-rainfall-regime
 *     relationship, what's the resulting near-term rainfall regime
 *     outlook per region — recomputed every time the pipeline re-ingests
 *     a fresh CPC forecast (monthly), not a static snapshot.
 *
 * Every probability here is a plain empirical frequency from paired
 * historical observations (with a Wilson 95% confidence interval), not a
 * fitted econometric or ML model — consistent with how the cycle-
 * transition-probability feature on this same page was built, and for
 * the same reason: the underlying overlap windows are short (rainfall
 * only starts 2006; Indonesia's monthly production only starts 2009), so
 * a model complex enough to look precise would be overfitting, not
 * insight. Below a minimum sample size, no probability is shown.
 */

const REGIME_THRESHOLD_PCT = 15; // |anomaly| <= 15% = Normal; beyond that, Deficit/Excess
const PRODUCTION_LAG_MONTHS = 18; // literature-cited oil palm FFB gestation lag, not fitted
const PRICE_REACTION_MONTHS = 3; // near-term market-reaction window, distinct from the biological lag
const MIN_LINKAGE_SAMPLE = 3;
const MIN_PHASE_SAMPLE = 10;
const ENSO_PHASE_THRESHOLD = 0.5; // matches oilseedsEnso.ts's own convention

export type RainfallRegime = "Deficit" | "Normal" | "Excess";
export type ProductionOutcome = "Increase" | "At-Par" | "Decrease";
export type EnsoPhase = "El Nino" | "La Nina" | "Neutral";

export type OutcomeProbability = { outcome: ProductionOutcome; probability: number; ciLow: number; ciHigh: number };
export type ProductionLinkage = { regime: RainfallRegime; sampleSize: number; outcomes: OutcomeProbability[] };
export type PriceReactionBucket = { regime: RainfallRegime; sampleSize: number; avgForwardReturnPct: number | null; medianForwardReturnPct: number | null };

export type RegionRegimeNow = {
  slug: string;
  label: string;
  country: "Malaysia" | "Indonesia";
  anomalyPct: number | null;
  regime: RainfallRegime | null;
  asOf: string | null;
};

export type RegionForecastOutlook = {
  slug: string;
  label: string;
  country: "Malaysia" | "Indonesia";
  phaseSampleSizes: Record<EnsoPhase, number>;
  months: { targetMonth: string; deficitProb: number; normalProb: number; excessProb: number }[] | null; // null if any phase sample is below MIN_PHASE_SAMPLE
};

export type RainfallImpactResult = {
  regimeThresholdPct: number;
  productionLagMonths: number;
  priceReactionMonths: number;
  currentRegimeByRegion: RegionRegimeNow[];
  productionLinkage: ProductionLinkage[]; // Indonesia only — the only product with long-enough monthly production history
  priceReaction: PriceReactionBucket[];
  priceSensitivity: { slopePctPer10ptAnomaly: number | null; rSquared: number | null; sampleSize: number } | null;
  forecastIssuedAt: string | null; // earliest target month in the current CPC forecast, i.e. roughly the issue month
  forecastByRegion: RegionForecastOutlook[];
};

function wilsonInterval(successes: number, n: number, z = 1.96): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const phat = successes / n;
  const denom = 1 + (z * z) / n;
  const center = phat + (z * z) / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, (center - margin) / denom), high: Math.min(1, (center + margin) / denom) };
}

// Leave-one-out anomaly vs. that calendar month's own average across all
// OTHER years in the series — a plain climatological baseline, the same
// approach already used (single latest point only) in oilseedsRainfall.ts.
function buildAnomalySeries(series: Point[]): { t: string; anomalyPct: number }[] {
  const byMonth = new Map<number, number[]>();
  for (const p of series) {
    const m = new Date(p.t).getUTCMonth();
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(p.v);
  }
  const out: { t: string; anomalyPct: number }[] = [];
  for (const p of series) {
    const m = new Date(p.t).getUTCMonth();
    const vals = byMonth.get(m)!;
    if (vals.length < 2) continue;
    const othersAvg = (vals.reduce((a, b) => a + b, 0) - p.v) / (vals.length - 1);
    if (othersAvg === 0) continue;
    out.push({ t: p.t, anomalyPct: ((p.v - othersAvg) / othersAvg) * 100 });
  }
  return out;
}

function classifyRegime(anomalyPct: number): RainfallRegime {
  if (anomalyPct <= -REGIME_THRESHOLD_PCT) return "Deficit";
  if (anomalyPct >= REGIME_THRESHOLD_PCT) return "Excess";
  return "Normal";
}

function classifyProductionOutcome(anomalyPct: number): ProductionOutcome {
  if (anomalyPct <= -REGIME_THRESHOLD_PCT) return "Decrease";
  if (anomalyPct >= REGIME_THRESHOLD_PCT) return "Increase";
  return "At-Par";
}

function classifyEnsoPhase(oni: number): EnsoPhase {
  if (oni >= ENSO_PHASE_THRESHOLD) return "El Nino";
  if (oni <= -ENSO_PHASE_THRESHOLD) return "La Nina";
  return "Neutral";
}

function monthKey(t: string): string {
  return t.slice(0, 7);
}

function addMonths(t: string, months: number): string {
  const d = new Date(t);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function buildProductionLinkage(rainfallAnomalies: { t: string; anomalyPct: number }[], productionAnomalies: { t: string; anomalyPct: number }[]): ProductionLinkage[] {
  const productionByMonth = new Map(productionAnomalies.map((p) => [monthKey(p.t), p.anomalyPct]));
  const pairs: { regime: RainfallRegime; outcome: ProductionOutcome }[] = [];
  for (const r of rainfallAnomalies) {
    const targetMonth = monthKey(addMonths(r.t, PRODUCTION_LAG_MONTHS));
    const prodAnomaly = productionByMonth.get(targetMonth);
    if (prodAnomaly === undefined) continue;
    pairs.push({ regime: classifyRegime(r.anomalyPct), outcome: classifyProductionOutcome(prodAnomaly) });
  }

  const regimes: RainfallRegime[] = ["Deficit", "Normal", "Excess"];
  const outcomes: ProductionOutcome[] = ["Increase", "At-Par", "Decrease"];
  return regimes.map((regime) => {
    const inRegime = pairs.filter((p) => p.regime === regime);
    const n = inRegime.length;
    if (n < MIN_LINKAGE_SAMPLE) return { regime, sampleSize: n, outcomes: [] };
    return {
      regime,
      sampleSize: n,
      outcomes: outcomes.map((outcome) => {
        const successes = inRegime.filter((p) => p.outcome === outcome).length;
        const { low, high } = wilsonInterval(successes, n);
        return { outcome, probability: successes / n, ciLow: low, ciHigh: high };
      }),
    };
  });
}

function buildPriceReaction(compositeAnomalies: { t: string; anomalyPct: number }[], priceSeries: Point[]): { priceReaction: PriceReactionBucket[]; sensitivity: RainfallImpactResult["priceSensitivity"] } {
  const priceByMonth = new Map(priceSeries.map((p) => [monthKey(p.t), p.v]));
  const observations: { anomalyPct: number; forwardReturnPct: number; regime: RainfallRegime }[] = [];
  for (const r of compositeAnomalies) {
    const startPrice = priceByMonth.get(monthKey(r.t));
    const endPrice = priceByMonth.get(monthKey(addMonths(r.t, PRICE_REACTION_MONTHS)));
    if (startPrice === undefined || endPrice === undefined || startPrice === 0) continue;
    observations.push({ anomalyPct: r.anomalyPct, forwardReturnPct: ((endPrice - startPrice) / startPrice) * 100, regime: classifyRegime(r.anomalyPct) });
  }

  const regimes: RainfallRegime[] = ["Deficit", "Normal", "Excess"];
  const priceReaction = regimes.map((regime) => {
    const inRegime = observations.filter((o) => o.regime === regime);
    return {
      regime,
      sampleSize: inRegime.length,
      avgForwardReturnPct: inRegime.length > 0 ? inRegime.reduce((a, o) => a + o.forwardReturnPct, 0) / inRegime.length : null,
      medianForwardReturnPct: median(inRegime.map((o) => o.forwardReturnPct)),
    };
  });

  let sensitivity: RainfallImpactResult["priceSensitivity"] = null;
  const n = observations.length;
  if (n >= 10) {
    const xs = observations.map((o) => o.anomalyPct);
    const ys = observations.map((o) => o.forwardReturnPct);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;
    let sumXY = 0,
      sumXX = 0,
      sumYY = 0;
    for (let i = 0; i < n; i++) {
      sumXY += (xs[i] - xMean) * (ys[i] - yMean);
      sumXX += (xs[i] - xMean) ** 2;
      sumYY += (ys[i] - yMean) ** 2;
    }
    const slope = sumXX !== 0 ? sumXY / sumXX : null;
    const rSquared = sumXX !== 0 && sumYY !== 0 ? (sumXY * sumXY) / (sumXX * sumYY) : null;
    sensitivity = { slopePctPer10ptAnomaly: slope !== null ? slope * 10 : null, rSquared, sampleSize: n };
  }

  return { priceReaction, sensitivity };
}

async function buildForecastOutlook(
  db: SupabaseClient,
  region: (typeof NASA_POWER_REGIONS)[number],
  regionAnomalies: { t: string; anomalyPct: number }[],
  oniSeries: Point[],
  forecastSeries: { t: string; laNina: number; neutral: number; elNino: number }[]
): Promise<RegionForecastOutlook> {
  const oniByMonth = new Map(oniSeries.map((p) => [monthKey(p.t), p.v]));
  const phaseCounts: Record<EnsoPhase, { total: number; regimeCounts: Record<RainfallRegime, number> }> = {
    "El Nino": { total: 0, regimeCounts: { Deficit: 0, Normal: 0, Excess: 0 } },
    "La Nina": { total: 0, regimeCounts: { Deficit: 0, Normal: 0, Excess: 0 } },
    Neutral: { total: 0, regimeCounts: { Deficit: 0, Normal: 0, Excess: 0 } },
  };

  for (const r of regionAnomalies) {
    const oni = oniByMonth.get(monthKey(r.t));
    if (oni === undefined) continue;
    const phase = classifyEnsoPhase(oni);
    const regime = classifyRegime(r.anomalyPct);
    phaseCounts[phase].total++;
    phaseCounts[phase].regimeCounts[regime]++;
  }

  const phaseSampleSizes: Record<EnsoPhase, number> = {
    "El Nino": phaseCounts["El Nino"].total,
    "La Nina": phaseCounts["La Nina"].total,
    Neutral: phaseCounts.Neutral.total,
  };

  const insufficientData = (Object.keys(phaseCounts) as EnsoPhase[]).some((phase) => phaseCounts[phase].total < MIN_PHASE_SAMPLE);
  if (insufficientData || forecastSeries.length === 0) {
    return { slug: region.slug, label: region.label, country: region.country, phaseSampleSizes, months: null };
  }

  const pRegimeGivenPhase = (phase: EnsoPhase, regime: RainfallRegime) => phaseCounts[phase].regimeCounts[regime] / phaseCounts[phase].total;

  const months = forecastSeries.map((f) => {
    const pElNino = f.elNino / 100;
    const pLaNina = f.laNina / 100;
    const pNeutral = f.neutral / 100;
    const mix = (regime: RainfallRegime) =>
      pElNino * pRegimeGivenPhase("El Nino", regime) + pLaNina * pRegimeGivenPhase("La Nina", regime) + pNeutral * pRegimeGivenPhase("Neutral", regime);
    return { targetMonth: monthKey(f.t), deficitProb: mix("Deficit"), normalProb: mix("Normal"), excessProb: mix("Excess") };
  });

  return { slug: region.slug, label: region.label, country: region.country, phaseSampleSizes, months };
}

export async function getOilseedsRainfallImpact(db: SupabaseClient): Promise<RainfallImpactResult> {
  const since = "2000-01-01";
  const [regionSeriesList, productionSeries, priceSeries, oniSeries, laNinaFc, neutralFc, elNinoFc] = await Promise.all([
    Promise.all(NASA_POWER_REGIONS.map((r) => fetchSeries(db, `climate.rainfall.${r.slug}`, since))),
    fetchSeries(db, "commodity.palm_oil.indonesia.production_monthly_large_estate", since),
    fetchSeries(db, "commodity.palm_oil.price", since),
    fetchSeries(db, "climate.enso.oni", since),
    fetchSeries(db, "climate.enso.forecast.la_nina", since),
    fetchSeries(db, "climate.enso.forecast.neutral", since),
    fetchSeries(db, "climate.enso.forecast.el_nino", since),
  ]);

  const regionAnomalies = regionSeriesList.map((s) => buildAnomalySeries(s));

  const currentRegimeByRegion: RegionRegimeNow[] = NASA_POWER_REGIONS.map((r, i) => {
    const anomalies = regionAnomalies[i];
    const last = anomalies[anomalies.length - 1];
    return {
      slug: r.slug,
      label: r.label,
      country: r.country,
      anomalyPct: last?.anomalyPct ?? null,
      regime: last ? classifyRegime(last.anomalyPct) : null,
      asOf: last?.t ?? null,
    };
  });

  // Indonesia composite (average across its 3 regions) for the production linkage.
  const indonesiaIdx = NASA_POWER_REGIONS.map((r, i) => (r.country === "Indonesia" ? i : -1)).filter((i) => i >= 0);
  const indonesiaByMonth = new Map<string, number[]>();
  for (const i of indonesiaIdx) {
    for (const a of regionAnomalies[i]) {
      const k = monthKey(a.t);
      if (!indonesiaByMonth.has(k)) indonesiaByMonth.set(k, []);
      indonesiaByMonth.get(k)!.push(a.anomalyPct);
    }
  }
  const indonesiaComposite = [...indonesiaByMonth.entries()]
    .map(([k, vs]) => ({ t: `${k}-01`, anomalyPct: vs.reduce((a, b) => a + b, 0) / vs.length }))
    .sort((a, b) => (a.t < b.t ? -1 : 1));

  const productionAnomalies = buildAnomalySeries(productionSeries);
  const productionLinkage = buildProductionLinkage(indonesiaComposite, productionAnomalies);

  // Palm-belt composite (average across all 6 regions) for the price-reaction analysis.
  const allByMonth = new Map<string, number[]>();
  for (const anomalies of regionAnomalies) {
    for (const a of anomalies) {
      const k = monthKey(a.t);
      if (!allByMonth.has(k)) allByMonth.set(k, []);
      allByMonth.get(k)!.push(a.anomalyPct);
    }
  }
  const compositeAnomalies = [...allByMonth.entries()]
    .map(([k, vs]) => ({ t: `${k}-01`, anomalyPct: vs.reduce((a, b) => a + b, 0) / vs.length }))
    .sort((a, b) => (a.t < b.t ? -1 : 1));

  const { priceReaction, sensitivity } = buildPriceReaction(compositeAnomalies, priceSeries);

  const forecastByMonth = new Map<string, { laNina: number; neutral: number; elNino: number }>();
  for (const p of laNinaFc) forecastByMonth.set(monthKey(p.t), { ...(forecastByMonth.get(monthKey(p.t)) ?? { laNina: 0, neutral: 0, elNino: 0 }), laNina: p.v });
  for (const p of neutralFc) forecastByMonth.set(monthKey(p.t), { ...(forecastByMonth.get(monthKey(p.t)) ?? { laNina: 0, neutral: 0, elNino: 0 }), neutral: p.v });
  for (const p of elNinoFc) forecastByMonth.set(monthKey(p.t), { ...(forecastByMonth.get(monthKey(p.t)) ?? { laNina: 0, neutral: 0, elNino: 0 }), elNino: p.v });
  const forecastSeries = [...forecastByMonth.entries()]
    .map(([k, v]) => ({ t: `${k}-01`, ...v }))
    .sort((a, b) => (a.t < b.t ? -1 : 1));

  const forecastByRegion = await Promise.all(
    NASA_POWER_REGIONS.map((r, i) => buildForecastOutlook(db, r, regionAnomalies[i], oniSeries, forecastSeries))
  );

  return {
    regimeThresholdPct: REGIME_THRESHOLD_PCT,
    productionLagMonths: PRODUCTION_LAG_MONTHS,
    priceReactionMonths: PRICE_REACTION_MONTHS,
    currentRegimeByRegion,
    productionLinkage,
    priceReaction,
    priceSensitivity: sensitivity,
    forecastIssuedAt: forecastSeries[0]?.t ?? null,
    forecastByRegion,
  };
}
