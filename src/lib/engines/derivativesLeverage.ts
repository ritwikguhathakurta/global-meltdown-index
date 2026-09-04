import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { absSeries } from "../metrics/stats";

/**
 * CFTC-based positioning/leverage proxy. No free source exists for options
 * open interest, dealer gamma, or margin debt (V3 §31 lists these but they
 * are behind paid data providers), so this engine is scoped to futures
 * positioning only. S&P 500 e-mini uses positioning *extremity* (either
 * direction can be a crowded, forced-unwind-prone trade); VIX futures uses
 * net-short specifically, since crowded short-vol positioning has a
 * well-documented history of disorderly unwinds (e.g. Feb 2018).
 */
export async function runDerivativesLeverageEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [sp500Net, vixNet] = await Promise.all([
    buildIndicator(ctx.db, "cot.sp500_emini.noncomm_net_pct_oi", "CFTC E-mini S&P 500 Non-Commercial Net Position (% OI)", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "cot.vix_futures.noncomm_net_pct_oi", "CFTC VIX Futures Non-Commercial Net Position (% OI)", "leading", "weekly", "%"),
  ]);

  const sp500Extremity = absSeries(sp500Net.series);

  return composeEngineResult({
    engineKey: "derivatives_leverage",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["BALANCED", "NORMAL", "BUILDING", "CROWDED", "FORCED_UNWIND_RISK"],
    inputs: [
      {
        ref: { ...sp500Net.ref, key: "cot.sp500_emini.positioning_extremity", label: "E-mini S&P 500 Positioning Extremity (|net %OI|, derived)" },
        series: sp500Extremity,
        weight: 0.8,
        zDirection: 1,
      },
      {
        ref: { ...vixNet.ref, label: "CFTC VIX Futures Net Short Positioning (inverted)" },
        series: vixNet.series,
        weight: 1.0,
        zDirection: -1,
      },
    ],
    triggerDesc:
      "Crowded short-volatility positioning (leveraged/non-commercial funds net short VIX futures near a trailing extreme) combined with extreme one-sided S&P e-mini positioning has historically preceded disorderly, self-reinforcing unwinds when a shock forces simultaneous covering.",
    transmissionMechanism:
      "When positioning is one-sided and a shock moves price against the crowd, margin calls force rapid covering, which itself moves price further, creating a feedback loop distinct from — and often faster than — fundamentals-driven moves.",
    amplifiers: [
      "Margin debt at a cycle high (not tracked — no clean free source; FINRA publishes only as an HTML table)",
      "Negative dealer gamma positioning (not tracked — requires paid options-flow data)",
      "Simultaneous Equity Fragility engine deterioration",
    ],
    invalidationConditions: ["Positioning normalizes toward its trailing median in both markets", "No confirmed forced-unwind event despite elevated readings"],
    confirmationConditions: ["A realized-volatility spike coincides with rapid VIX futures short-covering", "Open interest declines sharply alongside the price move (confirms deleveraging, not new risk-taking)"],
    notYetHappened: ["No confirmed forced-unwind event has been detected in the tracked positioning data"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}
