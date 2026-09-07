import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * Emerging-Market Debt — extended beyond the original BRL/ZAR/MXN basket to
 * the full set of MSCI Emerging Markets constituents the ECB publishes a
 * daily reference rate for (Turkey, India, Indonesia, China, Philippines,
 * Poland, Hungary, Czech Republic, Thailand, Malaysia, South Korea — see
 * fx.ts). Each currency is a modest, equally-weighted composite input
 * (0.3) so the basket as a whole moves the score without any single
 * additional country overwhelming the two broad EM-wide indices (EM OAS,
 * EM Dollar Index), which remain the largest individual weights. The full
 * per-country breakout (all 14 currencies) is shown on the dashboard page
 * — see emDebtRegime.ts — since a single composite score can mask which
 * specific country is actually under stress.
 */
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

  return composeEngineResult({
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
      "A broad, simultaneous depreciation of EM currencies across multiple regions (not just one idiosyncratic move) alongside a widening EM dollar-bond spread is the classic 'sudden stop' pattern — dollar funding for EM issuers becomes scarce and expensive at the same time.",
    transmissionMechanism:
      "EM sovereigns and corporates with dollar-denominated debt face a rising local-currency cost of debt service as their currency weakens, while widening spreads raise the cost (or close the window) of rolling that debt at maturity.",
    amplifiers: ["Simultaneous US Treasury yield spike (dollar funding cost rises everywhere at once)", "A high-profile EM sovereign credit event", "Simultaneous Yen Carry unwind (cross-carry contagion into EM FX)"],
    invalidationConditions: ["EM currencies stabilize or strengthen together", "EM corporate OAS compresses back toward its trailing median"],
    confirmationConditions: ["EM local-currency bond yields spike alongside FX weakness", "A credit-rating action on a major EM sovereign"],
    notYetHappened: ["No confirmed simultaneous, broad-based EM currency depreciation across the full tracked basket"],
    contradictoryEvidence: [
      "No free per-country EM sovereign dollar-bond spread (the JPMorgan EMBI standard) was found — it is a paid, proprietary benchmark. FX vs USD is used as the per-country stress proxy instead; see emDebtRegime.ts for the full country breakout shown on the dashboard.",
    ],
    methodologyVersion: "v0.2-freedata-msci-em-basket",
  });
}
