import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { spreadByLastKnown } from "../metrics/stats";
import { currentSeasonalAmplifiers } from "./indiaSeasonality";

/**
 * India Yield Curve — a standalone engine tracking the short/medium/long
 * shape of India's sovereign curve and its inversion risk, separate from
 * India Liquidity (banking-system funding conditions) and India Market
 * Regime (an equity-direction call).
 *
 * CCIL (the Clearing Corporation of India) is the natural source for a full
 * secondary-market G-Sec curve (its Zero Coupon Yield Curve is the
 * industry-standard reference), but its own Terms of Use explicitly forbid
 * "systematic or automated data collection" (§4.8, covering scraping/data
 * mining/harvesting outright, not just a commercial-use carve-out) and any
 * commercial use of its Content without express written consent (§4.1) —
 * verified directly against CCIL's published Terms of Use PDF. This project
 * does not scrape sources whose own terms forbid it, the same standard
 * already applied to RBI's Imperva-protected PDF subdomain elsewhere in
 * this codebase (see rbiLiquidity.ts) — so this engine is built entirely
 * from RBI's own primary-auction results instead (see rbiYieldCurve.ts):
 * - SHORT: the 91-Day and 364-Day T-Bill weekly auction cut-off yields.
 * - MEDIUM: dated-security ("G-Sec") auction cut-offs bucketed to <=8Y
 *   residual maturity at issuance (e.g. 5Y/7Y reissues).
 * - LONG: the same auctions bucketed to >8Y residual maturity (10Y/14Y/
 *   30Y/40Y), cross-checked against india.gsec_10y — the OECD/FRED-mirrored
 *   India 10Y benchmark (fred.ts) — which updates monthly regardless of
 *   whether RBI's own borrowing calendar hits a 10Y-ish tenor that week.
 *
 * Three derived spreads (as-of joined across these genuinely different,
 * irregular publication cadences via spreadByLastKnown) do the actual
 * curve-shape reading: 1Y-10Y (the primary inversion gauge — India's
 * closest analog to the US 2s10s, since India doesn't have a liquid 2Y
 * benchmark), 1Y-5Y (front-end steepness) and 5Y-10Y+ (back-end steepness).
 * Comparing the front-end and back-end spreads is what answers "is the
 * curve steepening more at the short end or the long end" — both are
 * exposed as their own leading indicators below, not just baked into a
 * single composite score.
 */
export async function runIndiaYieldCurveEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [tbill91, tbill364, gsecMedium, gsecLong, gsec10y] = await Promise.all([
    buildIndicator(ctx.db, "india.tbill_91d", "91-Day T-Bill Cutoff Yield (short, ~3M)", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "india.tbill_364d", "364-Day T-Bill Cutoff Yield (short, ~1Y)", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "india.gsec_medium_yield", "G-Sec Auction Cutoff, <=8Y bucket (medium)", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "india.gsec_long_yield", "G-Sec Auction Cutoff, >8Y bucket (long)", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "india.gsec_10y", "India 10Y G-Sec Yield (OECD/FRED benchmark, monthly)", "coincident", "monthly", "%"),
  ]);

  const shortLongSpread = spreadByLastKnown(tbill364.series, gsec10y.series, 100);
  const shortMediumSpread = spreadByLastKnown(gsecMedium.series, tbill364.series, 100);
  const mediumLongSpread = spreadByLastKnown(gsecLong.series, gsecMedium.series, 100);

  return composeEngineResult({
    engineKey: "india_yield_curve",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["STEEP_NORMAL", "NORMAL", "FLATTENING", "NEAR_INVERSION", "INVERTED"],
    inputs: [
      { ref: tbill91.ref, series: tbill91.series, weight: 0.4, zDirection: 1 },
      { ref: tbill364.ref, series: tbill364.series, weight: 0.5, zDirection: 1 },
      { ref: gsecMedium.ref, series: gsecMedium.series, weight: 0.3, zDirection: 1 },
      { ref: gsecLong.ref, series: gsecLong.series, weight: 0.3, zDirection: 1 },
      { ref: gsec10y.ref, series: gsec10y.series, weight: 0.5, zDirection: 1 },
      {
        ref: {
          key: "india.curve_1y10y_spread",
          label: "1Y-10Y Spread (bps, derived) — primary inversion gauge",
          classification: "leading",
          value: shortLongSpread.at(-1)?.v ?? null,
          unit: "bps",
          status: tbill364.ref.status,
          sourceKey: tbill364.ref.sourceKey,
          sourceTier: tbill364.ref.sourceTier,
          asOf: shortLongSpread.at(-1)?.t ?? null,
        },
        series: shortLongSpread,
        weight: 1.2,
        zDirection: -1,
      },
      {
        ref: {
          key: "india.curve_short_medium_spread",
          label: "1Y-5Y Spread (bps, derived) — front-end steepness",
          classification: "leading",
          value: shortMediumSpread.at(-1)?.v ?? null,
          unit: "bps",
          status: gsecMedium.ref.status,
          sourceKey: gsecMedium.ref.sourceKey,
          sourceTier: gsecMedium.ref.sourceTier,
          asOf: shortMediumSpread.at(-1)?.t ?? null,
        },
        series: shortMediumSpread,
        weight: 0.6,
        zDirection: -1,
      },
      {
        ref: {
          key: "india.curve_medium_long_spread",
          label: "5Y-10Y+ Spread (bps, derived) — back-end steepness",
          classification: "leading",
          value: mediumLongSpread.at(-1)?.v ?? null,
          unit: "bps",
          status: gsecLong.ref.status,
          sourceKey: gsecLong.ref.sourceKey,
          sourceTier: gsecLong.ref.sourceTier,
          asOf: mediumLongSpread.at(-1)?.t ?? null,
        },
        series: mediumLongSpread,
        weight: 0.6,
        zDirection: -1,
      },
    ],
    triggerDesc:
      "A compression or inversion of the 1Y-10Y spread — short-tenor T-Bill yields rising toward or above the 10Y G-Sec yield — has historically signaled either an aggressively tight RBI policy stance relative to growth expectations, or acute short-end funding stress (see India Liquidity); a steepening led by the back end instead typically reflects fiscal/supply concerns (heavy long-dated borrowing) or rising term premium rather than near-term stress.",
    transmissionMechanism:
      "India's short end is set primarily by RBI's repo-rate stance and banking-system liquidity conditions (see India Liquidity), while the long end is driven by the government's borrowing calendar, inflation expectations, and FII debt-flow demand for duration; when the short end rises faster than the long end, it compresses bank net interest margins on duration mismatches and signals the market pricing tighter-for-longer policy, historically a precursor to slower credit growth.",
    amplifiers: [
      ...currentSeasonalAmplifiers(ctx.asOf),
      "A large upcoming G-Sec borrowing calendar (H2 fiscal-year supply) pressuring long-end yields higher independent of the short end",
      "RBI rate-cut/OMO-purchase expectations compressing the short end faster than the long end",
      "FII debt-market outflows pressuring the long end (see Emerging-Market Debt engine for the cross-border flow side)",
    ],
    invalidationConditions: [
      "The 1Y-10Y spread stabilizes or widens back toward its trailing range",
      "RBI liquidity operations shift toward sustained surplus/absorption (see India Liquidity), easing short-end pressure",
    ],
    confirmationConditions: [
      "A weak G-Sec auction (devolvement on primary dealers, a wide cut-off vs the previous auction) — not yet tracked as its own indicator, only visible qualitatively in the raw RBI releases this engine already parses",
    ],
    notYetHappened: ["No sustained 1Y-10Y inversion has yet been observed in the tracked series"],
    contradictoryEvidence: [
      "CCIL's own secondary-market Zero Coupon Yield Curve — the industry-standard reference — is not used here because CCIL's Terms of Use explicitly prohibit automated data collection and commercial use of its Content without written consent; this engine instead uses RBI's own primary-auction cut-offs, which are genuine but are auction-day snapshots, not a continuously-quoted secondary-market curve, and the medium/long buckets only update on weeks RBI actually auctions a security in that bucket (irregular by the government's own borrowing calendar, not a pipeline gap).",
      "india.gsec_10y (the continuous long-end cross-check) is an OECD-mirrored monthly series, typically 1-2 months lagged versus RBI's own same-week auction cut-offs when one is available.",
    ],
    methodologyVersion: "v0.1-freedata-rbi-auctions",
  });
}
