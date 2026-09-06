import type { Horizon, IndicatorRef } from "./types";

/**
 * Horizon differentiation shared by every engine (compose.ts and the
 * bespoke indiaRegime.ts). Before this, `horizon` was accepted by every
 * engine function but never actually used — short/medium/long produced the
 * literal same score and a confidence pinned at data-completeness (which
 * hits 100% whenever every indicator happens to have data). Neither is
 * defensible: near-term vs. medium-term vs. long-term risk reads should
 * differ, and no model's confidence should ever be absolute.
 *
 * The three horizon knobs below follow the same near-term/medium-term split
 * used in practice by the IMF Global Financial Stability Report and the
 * Fed's Financial Stability Report: near-term risk is read primarily off
 * market-price/high-frequency (leading/coincident) signals over a short
 * window, while medium- and longer-term vulnerability assessments (BIS's
 * financial-cycle framing: credit/GDP gaps and property prices measured
 * over multi-year windows) lean on structural/lagging buildups like
 * leverage and debt ratios measured over a much longer window.
 */

/** Trailing z-score window in observations. ~63 = one trading quarter, ~252 = one trading year, ~756 = three trading years. */
export const ZSCORE_WINDOW_BY_HORIZON: Record<Horizon, number> = {
  short: 63,
  medium: 252,
  long: 756,
};

/** Reweights each indicator by its classification so leading signals dominate near-term reads and lagging/structural signals dominate long-term reads. */
export const CLASSIFICATION_WEIGHT_BY_HORIZON: Record<Horizon, Record<IndicatorRef["classification"], number>> = {
  short: { leading: 1.35, coincident: 1.05, lagging: 0.55 },
  medium: { leading: 1.0, coincident: 1.0, lagging: 1.0 },
  long: { leading: 0.55, coincident: 0.85, lagging: 1.4 },
};

/**
 * Confidence discount factor per horizon, applied multiplicatively (not as
 * a min-cap) so confidence differs across horizons at every data-quality
 * level, not just when data is already near-perfect. Uncertainty compounds
 * with horizon — the same reasoning behind central-bank fan charts widening
 * further out — so the factor is highest for short-term and lowest for
 * long-term. Since it is always < 1, no horizon can ever reach 100%.
 */
export const CONFIDENCE_FACTOR_BY_HORIZON: Record<Horizon, number> = {
  short: 0.95,
  medium: 0.88,
  long: 0.75,
};

/** Freshness discount applied on top of raw data completeness — a STALE indicator should pull confidence down even if it's technically "present". */
export const FRESHNESS_WEIGHT_BY_STATUS: Record<IndicatorRef["status"], number> = {
  LIVE: 1.0,
  RECENT: 0.9,
  STALE: 0.6,
  UNAVAILABLE: 0,
};

/**
 * Computes (confidence, dataCompleteness) for a set of indicators at a given
 * horizon. `dataCompleteness` is a plain, honest fraction (can legitimately
 * be 100% — that's a true statement about coverage, not a confidence claim).
 * `confidence` folds in freshness and the horizon ceiling, so it can never
 * reach 1.0 and is always lowest for "long" given identical underlying data.
 */
export function computeConfidence(
  usableStatuses: IndicatorRef["status"][],
  totalCount: number,
  horizon: Horizon
): { confidence: number; dataCompleteness: number } {
  const dataCompleteness = totalCount > 0 ? usableStatuses.length / totalCount : 0;
  const freshnessSum = usableStatuses.reduce((a, s) => a + FRESHNESS_WEIGHT_BY_STATUS[s], 0);
  const freshnessFactor = usableStatuses.length > 0 ? freshnessSum / usableStatuses.length : 0;
  const confidence = dataCompleteness * freshnessFactor * CONFIDENCE_FACTOR_BY_HORIZON[horizon];
  return {
    confidence: Math.round(confidence * 100) / 100,
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
  };
}
