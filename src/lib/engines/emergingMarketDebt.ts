import type { EngineContext, EngineResult, Horizon, IndicatorRef } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { getCountryEmDebtTable, crisisStageFor } from "./emDebtRegime";

/**
 * Emerging-Market Debt Systemic Risk — rebuilt from a 76-section institutional
 * spec ("EM Debt Systemic Risk Engine") that explicitly objected to scoring EM
 * debt risk from exchange rates alone. Checked every requested component against
 * what free, verified data actually supports (see emDebtRegime.ts for the full
 * per-component breakdown of what's real here vs. genuinely unavailable without
 * paid data — CDS acceleration, foreign bond ownership, capital flows,
 * sovereign-bank nexus, corporate FX debt by hedge status, auctions).
 *
 * Two-level architecture, matching the spec's own design (it separately scores
 * Sovereign Vulnerability, Market Stress and Contagion before blending them —
 * not one flat pool of z-scored indicators):
 *
 * 1. MARKET bucket: the existing FX time-series composite (14 EM currencies +
 *    broad EM OAS + EM Dollar Index — genuine daily series, scored the normal
 *    composeEngineResult way) blended with the average sovereign CDS score
 *    across countries with a quoted CDS (Damodaran/NYU Stern annual snapshot).
 * 2. STRUCTURAL bucket: the average per-country Sovereign Vulnerability score
 *    from emDebtRegime.ts (World Bank debt/GDP, external debt, rollover,
 *    reserves, current account, growth, fiscal balance — cross-sectionally
 *    z-scored against the EM peer set, annual).
 * 3. CONTAGION bucket: the fraction of the 14 tracked EM economies currently
 *    at Funding-Stress-or-worse (vulnerabilityScore >= 60) — a real, computed
 *    breadth measure (spec §30/36/58), not weighted by GDP/creditor exposure
 *    (no free data for that), scaled so the spec's own stated calibration
 *    ("40%+ = CRITICAL") maps to a 100 score.
 *
 * The three buckets are blended with adaptive weights keyed off contagion
 * breadth as the regime signal (spec §31's NORMAL/STRESS/CRISIS adaptive
 * weighting, simplified to use the one real cross-country signal available
 * instead of an invented regime detector). FX/OAS alone is now at most 40% of
 * the final score, and usually less — directly answering the spec's core
 * complaint.
 */

function regimeForBlendedScore(score: number): string {
  if (score < 20) return "AMPLE_ACCESS";
  if (score < 40) return "NORMAL";
  if (score < 60) return "TIGHTENING";
  if (score < 80) return "FUNDING_STRESS";
  return "SUDDEN_STOP";
}

export async function runEmergingMarketDebtEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [emOas, emDollarIdx, usdbrl, usdzar, usdmxn, usdtry, usdinr, usdidr, usdcny, usdphp, usdpln, usdhuf, usdczk, usdthb, usdmyr, usdkrw] =
    await Promise.all([
      buildIndicator(ctx.db, "credit.em_oas", "ICE BofA EM Corporate Plus OAS", "coincident", "daily", "%"),
      buildIndicator(ctx.db, "credit.em_dollar_index", "Broad Emerging Market Dollar Index", "leading", "daily", "index"),
      buildIndicator(ctx.db, "fx.usdbrl", "USDBRL", "coincident", "daily", "BRL"),
      buildIndicator(ctx.db, "fx.usdzar", "USDZAR", "coincident", "daily", "ZAR"),
      buildIndicator(ctx.db, "fx.usdmxn", "USDMXN", "coincident", "daily", "MXN"),
      buildIndicator(ctx.db, "fx.usdtry", "USDTRY", "coincident", "daily", "TRY"),
      buildIndicator(ctx.db, "fx.usdinr", "USDINR", "coincident", "daily", "INR"),
      buildIndicator(ctx.db, "fx.usdidr", "USDIDR", "coincident", "daily", "IDR"),
      buildIndicator(ctx.db, "fx.usdcny", "USDCNY", "coincident", "daily", "CNY"),
      buildIndicator(ctx.db, "fx.usdphp", "USDPHP", "coincident", "daily", "PHP"),
      buildIndicator(ctx.db, "fx.usdpln", "USDPLN", "coincident", "daily", "PLN"),
      buildIndicator(ctx.db, "fx.usdhuf", "USDHUF", "coincident", "daily", "HUF"),
      buildIndicator(ctx.db, "fx.usdczk", "USDCZK", "coincident", "daily", "CZK"),
      buildIndicator(ctx.db, "fx.usdthb", "USDTHB", "coincident", "daily", "THB"),
      buildIndicator(ctx.db, "fx.usdmyr", "USDMYR", "coincident", "daily", "MYR"),
      buildIndicator(ctx.db, "fx.usdkrw", "USDKRW", "coincident", "daily", "KRW"),
    ]);

  const marketResult = composeEngineResult({
    engineKey: "emerging_market_debt",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["AMPLE_ACCESS", "NORMAL", "TIGHTENING", "FUNDING_STRESS", "SUDDEN_STOP"],
    inputs: [
      { ref: emOas.ref, series: emOas.series, weight: 1.0, zDirection: 1 },
      { ref: emDollarIdx.ref, series: emDollarIdx.series, weight: 0.9, zDirection: 1 },
      { ref: usdbrl.ref, series: usdbrl.series, weight: 0.5, zDirection: 1 },
      { ref: usdzar.ref, series: usdzar.series, weight: 0.5, zDirection: 1 },
      { ref: usdmxn.ref, series: usdmxn.series, weight: 0.4, zDirection: 1 },
      { ref: usdtry.ref, series: usdtry.series, weight: 0.3, zDirection: 1 },
      { ref: usdinr.ref, series: usdinr.series, weight: 0.3, zDirection: 1 },
      { ref: usdidr.ref, series: usdidr.series, weight: 0.3, zDirection: 1 },
      { ref: usdcny.ref, series: usdcny.series, weight: 0.3, zDirection: 1 },
      { ref: usdphp.ref, series: usdphp.series, weight: 0.3, zDirection: 1 },
      { ref: usdpln.ref, series: usdpln.series, weight: 0.3, zDirection: 1 },
      { ref: usdhuf.ref, series: usdhuf.series, weight: 0.3, zDirection: 1 },
      { ref: usdczk.ref, series: usdczk.series, weight: 0.3, zDirection: 1 },
      { ref: usdthb.ref, series: usdthb.series, weight: 0.3, zDirection: 1 },
      { ref: usdmyr.ref, series: usdmyr.series, weight: 0.3, zDirection: 1 },
      { ref: usdkrw.ref, series: usdkrw.series, weight: 0.3, zDirection: 1 },
    ],
    triggerDesc:
      "A broad, simultaneous depreciation of EM currencies across multiple regions alongside a widening EM dollar-bond spread is the classic 'sudden stop' market-stress pattern. On its own this captures only the market/FX bucket, not the full structural picture — see the blended score below.",
    transmissionMechanism:
      "EM sovereigns and corporates with dollar-denominated debt face a rising local-currency cost of debt service as their currency weakens, while widening spreads raise the cost (or close the window) of rolling that debt at maturity.",
    amplifiers: ["Simultaneous US Treasury yield spike (dollar funding cost rises everywhere at once)", "A high-profile EM sovereign credit event", "Simultaneous Yen Carry unwind (cross-carry contagion into EM FX)"],
    invalidationConditions: ["EM currencies stabilize or strengthen together", "EM corporate OAS compresses back toward its trailing median", "Structural vulnerability scores improve across the tracked EM peer set"],
    confirmationConditions: ["EM local-currency bond yields spike alongside FX weakness", "A credit-rating action on a major EM sovereign", "Sovereign CDS widens for multiple tracked countries at once"],
    notYetHappened: ["No confirmed simultaneous, broad-based EM currency depreciation across the full tracked basket"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.3-freedata-structural-cds-contagion",
  });

  const countryTable = await getCountryEmDebtTable(ctx.db);

  const structuralScores = countryTable.map((r) => r.structuralScore).filter((s): s is number => s !== null);
  const avgStructuralScore = structuralScores.length > 0 ? Math.round(structuralScores.reduce((a, b) => a + b, 0) / structuralScores.length) : null;

  const cdsScores = countryTable.map((r) => r.sovereignCds.score).filter((s): s is number => s !== null);
  const avgCdsScore = cdsScores.length > 0 ? Math.round(cdsScores.reduce((a, b) => a + b, 0) / cdsScores.length) : null;

  const vulnerabilityScores = countryTable.map((r) => r.vulnerabilityScore).filter((s): s is number => s !== null);
  const stressedCount = vulnerabilityScores.filter((s) => s >= 60).length;
  const breadth = vulnerabilityScores.length > 0 ? stressedCount / vulnerabilityScores.length : 0;
  const contagionScore = Math.min(100, Math.round(breadth * 250)); // spec's own "40%+ = CRITICAL" -> breadth 0.4 maps to 100

  const marketBucketParts = [marketResult.score, avgCdsScore].filter((s): s is number => s !== null);
  const marketBucketScore = marketBucketParts.length > 0 ? Math.round(marketBucketParts.reduce((a, b) => a + b, 0) / marketBucketParts.length) : null;

  // Adaptive weighting per spec §31 (NORMAL/STRESS/CRISIS), using contagion
  // breadth — the one real cross-country signal available — as the regime
  // trigger rather than an invented detector.
  const weights =
    breadth >= 0.25
      ? { structural: 0.25, market: 0.4, contagion: 0.35 } // CRISIS
      : breadth >= 0.1
        ? { structural: 0.35, market: 0.4, contagion: 0.25 } // STRESS
        : { structural: 0.5, market: 0.3, contagion: 0.2 }; // NORMAL

  const blendParts: { score: number; weight: number }[] = [{ score: contagionScore, weight: weights.contagion }];
  if (avgStructuralScore !== null) blendParts.push({ score: avgStructuralScore, weight: weights.structural });
  if (marketBucketScore !== null) blendParts.push({ score: marketBucketScore, weight: weights.market });
  const blendWeightSum = blendParts.reduce((a, b) => a + b.weight, 0);
  const blendedScore = blendWeightSum > 0 ? Math.round(blendParts.reduce((a, b) => a + b.score * b.weight, 0) / blendWeightSum) : marketResult.score;

  const topCountryDrivers: IndicatorRef[] = [...countryTable]
    .filter((r) => r.vulnerabilityScore !== null)
    .sort((a, b) => (b.vulnerabilityScore ?? 0) - (a.vulnerabilityScore ?? 0))
    .slice(0, 5)
    .map((r) => ({
      key: `emdebt.${r.country.toLowerCase().replace(/ /g, "_")}.vulnerability`,
      label: `${r.country} Sovereign Vulnerability`,
      classification: "leading" as const,
      value: r.vulnerabilityScore,
      unit: "score/100",
      status: (r.dataCompleteness >= 0.5 ? "LIVE" : r.dataCompleteness > 0 ? "RECENT" : "UNAVAILABLE") as IndicatorRef["status"],
      sourceKey: "world_bank",
      sourceTier: 1,
      asOf: null,
    }));

  const structuralCoverage = countryTable.length > 0 ? structuralScores.length / countryTable.length : 0;
  const blendedConfidence = Math.min(marketResult.confidence, 0.5 + 0.5 * structuralCoverage);
  const blendedDataCompleteness = Math.round(((marketResult.dataCompleteness + structuralCoverage) / 2) * 100) / 100;

  const overallStage = crisisStageFor(blendedScore, false, false);
  const worstCountry = [...countryTable]
    .filter((r) => r.crisisStage !== null)
    .sort((a, b) => (b.crisisStage ?? 0) - (a.crisisStage ?? 0))[0];
  const stageNote = overallStage
    ? `Composite crisis stage: ${overallStage.label} (score-band only — see methodology for why Stage 7 is not a detected default).${
        worstCountry && worstCountry.crisisStage !== null && worstCountry.crisisStage > overallStage.stage
          ? ` Worst individual country: ${worstCountry.country} at ${worstCountry.crisisStageLabel} (Stage ${worstCountry.crisisStage}).`
          : ""
      }`
    : "Composite crisis stage: insufficient data.";

  return {
    ...marketResult,
    score: blendedScore,
    regime: blendedScore !== null ? regimeForBlendedScore(blendedScore) : "INSUFFICIENT_DATA",
    confidence: blendedConfidence,
    dataCompleteness: blendedDataCompleteness,
    leadingIndicators: [...marketResult.leadingIndicators, ...topCountryDrivers],
    contradictoryEvidence: [
      `Blended score = structural ${Math.round(weights.structural * 100)}% (avg ${avgStructuralScore ?? "N/A"}) + market ${Math.round(weights.market * 100)}% (FX/OAS composite blended with avg sovereign CDS = ${marketBucketScore ?? "N/A"}) + contagion breadth ${Math.round(weights.contagion * 100)}% (${(breadth * 100).toFixed(0)}% of tracked EMs at Funding-Stress-or-worse). No free per-country EM sovereign dollar-bond spread (JPMorgan's EMBI) exists — FX and a Damodaran/NYU Stern annual CDS snapshot are used as the market-priced proxies instead; see emDebtRegime.ts and the dashboard's per-country table for the full breakdown.`,
      stageNote,
    ],
    methodologyVersion: "v0.3-freedata-structural-cds-contagion",
  };
}
