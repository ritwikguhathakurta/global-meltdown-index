import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * Trade/Economic Policy engine (V3 §23 of engine list). Scoped narrowly:
 * tariff schedules, trade-deadline calendars and policy-announcement text
 * mining have no free structured source, so this tracks only the
 * quantitative trade-balance and dollar-strength data that is free and
 * official. Explicitly thinner than the V3 spec envisions — see README.
 */
export async function runTradePolicyEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [tradeBalance, dxy, dxyAdvanced] = await Promise.all([
    buildIndicator(ctx.db, "trade.us_goods_services_balance", "US Goods & Services Trade Balance", "coincident", "monthly", "USD mm"),
    buildIndicator(ctx.db, "fx.dxy_broad", "Broad Dollar Index", "leading", "daily", "index"),
    buildIndicator(ctx.db, "credit.em_dollar_index", "Broad EM Dollar Index", "leading", "daily", "index"),
  ]);

  return composeEngineResult({
    engineKey: "trade_economic_policy",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["OPEN", "STABLE", "FRICTION_BUILDING", "RESTRICTIVE", "TRADE_SHOCK"],
    inputs: [
      { ref: tradeBalance.ref, series: tradeBalance.series, weight: 0.6, zDirection: -1 },
      { ref: dxy.ref, series: dxy.series, weight: 0.7, zDirection: 1 },
      { ref: dxyAdvanced.ref, series: dxyAdvanced.series, weight: 0.5, zDirection: 1 },
    ],
    triggerDesc:
      "A widening trade deficit alongside broad, sustained dollar strength against both advanced and emerging-market currencies together would indicate tightening global dollar-funding conditions with a trade-policy or capital-flow dimension, rather than an idiosyncratic single-country move.",
    transmissionMechanism:
      "Dollar strength tightens financial conditions globally for dollar-denominated borrowers (see Emerging-Market Debt engine); trade-balance deterioration can precede protectionist policy responses that disrupt supply chains (see Supply Chains engine).",
    amplifiers: ["A confirmed new tariff announcement or trade-deadline breach (not tracked — no free structured policy-calendar source)", "Simultaneous Emerging-Market Debt engine deterioration"],
    invalidationConditions: ["Dollar index stabilizes or weakens", "Trade balance stabilizes"],
    confirmationConditions: ["EM Debt engine confirms dollar-strength stress", "A confirmed policy announcement corroborates the market move"],
    notYetHappened: ["No confirmed trade-policy shock event has been detected — this engine tracks quantitative proxies only, not policy-text mining"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}
