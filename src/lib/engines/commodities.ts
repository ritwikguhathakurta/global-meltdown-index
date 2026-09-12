import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, percentileRank, pctChangeOverDays, type Point } from "../metrics/stats";
import { COMMODITIES, type CommodityCategory } from "../commodities/taxonomy";

/**
 * Commodities engine — Phase 1 of the ~115-section Commodity Intelligence
 * Platform spec. Real World Bank Pink Sheet prices (worldBankCommodities.ts)
 * across ~50 commodities, monthly since 1960.
 *
 * This is explicitly a PRICE MOMENTUM signal, not the spec's full Commodity
 * Direction Score (CDS) — that needs production/consumption/inventory/
 * balance data (USDA PSD, FAOSTAT, EIA, UN Comtrade — not yet wired into
 * this engine) weighted at only 10% momentum in the spec's own CDS formula
 * (§41). Building and displaying a "CDS" using price alone would overclaim
 * what's actually measured, so this engine's own score is named and scoped
 * accordingly: a momentum signal, quoting real returns, not a fundamental
 * supply-demand verdict.
 *
 * Methodology (spec §32's own horizon weights, applied honestly): for each
 * of 1M/3M/6M/12M/36M, the latest % return is z-scored against that same
 * commodity's own trailing distribution of returns at that horizon (not
 * against price levels), then blended 10/20/25/30/15 per the spec, and
 * classified into the spec's own STRONG POSITIVE..STRONG NEGATIVE buckets
 * (§43 thresholds, verbatim).
 */

export type CommodityDirectionLabel = "STRONG POSITIVE" | "POSITIVE" | "FLAT" | "NEGATIVE" | "STRONG NEGATIVE" | "INSUFFICIENT_DATA";

export type CommodityRow = {
  slug: string;
  label: string;
  category: CommodityCategory;
  unit: string;
  price: number | null;
  asOf: string | null;
  change1m: number | null;
  change3m: number | null;
  change12m: number | null;
  change36m: number | null;
  momentumScore: number | null; // -100 to +100
  direction: CommodityDirectionLabel;
  pricePercentile5y: number | null;
};

export type CommodityHeatmapResult = {
  rows: CommodityRow[];
  breadth: { bullishPct: number; neutralPct: number; bearishPct: number; withData: number; total: number };
  asOf: string | null;
};

const MOMENTUM_HORIZONS: { days: number; weight: number }[] = [
  { days: 30, weight: 0.1 },
  { days: 90, weight: 0.2 },
  { days: 182, weight: 0.25 },
  { days: 365, weight: 0.3 },
  { days: 1095, weight: 0.15 },
];

const RETURN_BASELINE_WINDOW = 48; // trailing observations used as each horizon's own return distribution

// z-score of the latest N-day return against that same commodity's own
// trailing distribution of N-day returns (not a level z-score) — this is
// what makes a -12% move meaningful only relative to how volatile that
// specific commodity's own N-day moves normally are.
function rollingReturnZScore(series: Point[], horizonDays: number): number | null {
  const sorted = [...series].sort((a, b) => (a.t < b.t ? -1 : 1));
  if (sorted.length < 20) return null;

  const returns: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cutoff = new Date(sorted[i].t);
    cutoff.setUTCDate(cutoff.getUTCDate() - horizonDays);
    let past: Point | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (new Date(sorted[j].t) <= cutoff) {
        past = sorted[j];
        break;
      }
    }
    returns.push(past && past.v !== 0 ? ((sorted[i].v - past.v) / Math.abs(past.v)) * 100 : NaN);
  }

  const latestReturn = returns[returns.length - 1];
  if (Number.isNaN(latestReturn)) return null;
  const baseline = returns.slice(0, -1).filter((r) => !Number.isNaN(r)).slice(-RETURN_BASELINE_WINDOW);
  if (baseline.length < 12) return null;
  const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const variance = baseline.reduce((a, b) => a + (b - mean) ** 2, 0) / (baseline.length - 1);
  const sd = Math.sqrt(variance);
  if (!sd || Number.isNaN(sd)) return null;
  return (latestReturn - mean) / sd;
}

function computeMomentumScore(series: Point[]): number | null {
  const parts = MOMENTUM_HORIZONS.map((h) => ({ z: rollingReturnZScore(series, h.days), weight: h.weight })).filter(
    (p): p is { z: number; weight: number } => p.z !== null
  );
  if (parts.length === 0) return null;
  const totalWeight = parts.reduce((a, b) => a + b.weight, 0);
  const blendedZ = parts.reduce((a, b) => a + b.z * b.weight, 0) / totalWeight;
  const clamped = Math.max(-3, Math.min(3, blendedZ));
  return Math.round((clamped / 3) * 100);
}

export function classifyDirection(score: number | null): CommodityDirectionLabel {
  if (score === null) return "INSUFFICIENT_DATA";
  if (score >= 65) return "STRONG POSITIVE";
  if (score >= 25) return "POSITIVE";
  if (score > -25) return "FLAT";
  if (score > -65) return "NEGATIVE";
  return "STRONG NEGATIVE";
}

export async function getCommodityHeatmap(db: SupabaseClient): Promise<CommodityHeatmapResult> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 10);
  const sinceIso = since.toISOString();

  const seriesList = await Promise.all(COMMODITIES.map((c) => fetchSeries(db, `commodity.${c.slug}.price`, sinceIso)));

  let asOf: string | null = null;
  const rows: CommodityRow[] = COMMODITIES.map((c, i) => {
    const series = seriesList[i];
    const last = latest(series);
    if (last && (!asOf || last.t > asOf)) asOf = last.t;
    const momentumScore = computeMomentumScore(series);
    return {
      slug: c.slug,
      label: c.label,
      category: c.category,
      unit: c.unit,
      price: last?.v ?? null,
      asOf: last?.t ?? null,
      change1m: pctChangeOverDays(series, 30),
      change3m: pctChangeOverDays(series, 90),
      change12m: pctChangeOverDays(series, 365),
      change36m: pctChangeOverDays(series, 1095),
      momentumScore,
      direction: classifyDirection(momentumScore),
      pricePercentile5y: percentileRank(series, 60),
    };
  });

  const withData = rows.filter((r) => r.direction !== "INSUFFICIENT_DATA");
  const bullish = withData.filter((r) => r.direction === "POSITIVE" || r.direction === "STRONG POSITIVE").length;
  const bearish = withData.filter((r) => r.direction === "NEGATIVE" || r.direction === "STRONG NEGATIVE").length;
  const neutral = withData.length - bullish - bearish;

  return {
    rows: rows.sort((a, b) => (b.momentumScore ?? -Infinity) - (a.momentumScore ?? -Infinity)),
    breadth: {
      bullishPct: withData.length > 0 ? Math.round((bullish / withData.length) * 100) : 0,
      neutralPct: withData.length > 0 ? Math.round((neutral / withData.length) * 100) : 0,
      bearishPct: withData.length > 0 ? Math.round((bearish / withData.length) * 100) : 0,
      withData: withData.length,
      total: rows.length,
    },
    asOf,
  };
}
