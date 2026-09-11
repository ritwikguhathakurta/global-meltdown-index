import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { previousOf, ratioSeriesByDate } from "../metrics/stats";

/**
 * Market Concentration engine (V3 §16 of the engine list). No free source
 * publishes literal index-weight concentration data (e.g. "top 10 holdings =
 * X% of the S&P 500"), so this uses a well-established practitioner proxy
 * instead: the ratio of a cap-weighted ETF to its equal-weighted counterpart
 * (SPY/RSP for the S&P 500, QQQ/QQQE for the Nasdaq 100). A rising ratio
 * means the index's return is increasingly driven by its largest names —
 * exactly what "concentration" means — computed here from real, live ETF
 * prices rather than fabricated from an unavailable weights dataset.
 */
export async function runMarketConcentrationEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [spy, rsp, qqq, qqqe] = await Promise.all([
    buildIndicator(ctx.db, "equity.spy_cap_weighted", "SPY (S&P 500, cap-weighted)", "coincident", "daily", "USD"),
    buildIndicator(ctx.db, "equity.rsp_equal_weighted", "RSP (S&P 500, equal-weighted)", "coincident", "daily", "USD"),
    buildIndicator(ctx.db, "equity.qqq_cap_weighted", "QQQ (Nasdaq 100, cap-weighted)", "coincident", "daily", "USD"),
    buildIndicator(ctx.db, "equity.qqqe_equal_weighted", "QQQE (Nasdaq 100, equal-weighted)", "coincident", "daily", "USD"),
  ]);

  const spyRspRatio = ratioSeriesByDate(spy.series, rsp.series);
  const qqqRatio = ratioSeriesByDate(qqq.series, qqqe.series);

  return composeEngineResult({
    engineKey: "market_concentration",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["BROAD", "NORMAL", "NARROWING", "CONCENTRATED", "EXTREME_CONCENTRATION"],
    inputs: [
      {
        ref: { key: "equity.spy_rsp_ratio", label: "SPY/RSP Ratio (S&P 500 cap-weighted vs equal-weighted, derived)", classification: "leading", value: spyRspRatio.at(-1)?.v ?? null, unit: "ratio", status: spy.ref.status, sourceKey: "yahoo_finance", sourceTier: 3, asOf: spy.ref.asOf, previousValue: previousOf(spyRspRatio)?.v ?? null },
        series: spyRspRatio,
        weight: 1.0,
        zDirection: 1,
      },
      {
        ref: { key: "equity.qqq_qqqe_ratio", label: "QQQ/QQQE Ratio (Nasdaq 100 cap-weighted vs equal-weighted, derived)", classification: "leading", value: qqqRatio.at(-1)?.v ?? null, unit: "ratio", status: qqq.ref.status, sourceKey: "yahoo_finance", sourceTier: 3, asOf: qqq.ref.asOf, previousValue: previousOf(qqqRatio)?.v ?? null },
        series: qqqRatio,
        weight: 0.8,
        zDirection: 1,
      },
    ],
    triggerDesc:
      "Both ratios rising together (S&P 500 and Nasdaq 100 breadth narrowing simultaneously) indicates market-wide, not sector-specific, mega-cap concentration — the pattern most associated with a small number of names becoming 'too big to correct without moving the whole index'.",
    transmissionMechanism:
      "When a handful of mega-cap names drive most of an index's return, passive fund flows mechanically reinforce their weight (a feedback loop), and any idiosyncratic shock to one of those names has an outsized, non-diversifiable effect on investors who believe they hold a 'broad market' index.",
    amplifiers: [
      "Simultaneous Equity Fragility engine deterioration (a concentration unwind is a specific failure mode of broad equity fragility, not a separate risk)",
      "Passive/index fund flows at a record share of total equity ownership (not tracked — no free source)",
    ],
    invalidationConditions: ["Both ratios decline or stabilize toward their trailing median (broadening participation)"],
    confirmationConditions: ["A drawdown in the largest 5-10 names produces an outsized index-level decline relative to equal-weighted peers"],
    notYetHappened: ["No confirmed disorderly unwind of index concentration has been detected in the tracked ratios"],
    contradictoryEvidence: ["This is a market-price proxy, not literal index-weight data — a genuine change in official index weights could exist without moving these ETF ratios if it hasn't yet been priced"],
    methodologyVersion: "v0.1-freedata",
  });
}
