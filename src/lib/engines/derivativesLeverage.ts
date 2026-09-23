import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { absSeries } from "../metrics/stats";
import type { Point } from "../metrics/stats";

/** log(ratio) is 0 at parity (e.g. put OI == call OI), positive when the
 * first leg dominates, negative when the second does — the same symmetric-
 * around-neutral transform this file already relies on for net %OI, applied
 * to a ratio input (HKEX/B3 put/call) that isn't naturally zero-centered. */
function logSeries(points: Point[]): Point[] {
  return points.filter((p) => p.v > 0).map((p) => ({ t: p.t, v: Math.log(p.v) }));
}

/**
 * CFTC-based positioning/leverage proxy. No free source exists for options
 * open interest, dealer gamma, or margin debt (V3 §31 lists these but they
 * are behind paid data providers), so this engine is scoped to futures
 * positioning only. S&P 500 e-mini uses positioning *extremity* (either
 * direction can be a crowded, forced-unwind-prone trade); VIX futures uses
 * net-short specifically, since crowded short-vol positioning has a
 * well-documented history of disorderly unwinds (e.g. Feb 2018).
 *
 * Widened for the Derivatives & Leverage dashboard rebuild (see
 * docs/DERIVATIVES_ENGINE.md) with real participant-category positioning from
 * the Disaggregated COT and Traders-in-Financial-Futures reports (cftcCot.ts):
 * Treasury 10Y leveraged-funds extremity (the same participant category behind
 * the 2020 Treasury cash-futures basis-trade unwind) and gold/crude/natural-gas
 * managed-money extremity (commodity speculative crowding). This changes the
 * engine's GFMI score going forward (more inputs -> different z-scores) as an
 * expected side effect of genuinely broader coverage, not a bug.
 *
 * Widened again with real non-US exchange data after a live re-check found
 * two Phase-1 "not free" disclosures were wrong (see hkexDerivatives.ts and
 * b3Derivatives.ts): HKEX (Hong Kong) Hang Seng/H-shares index futures Gross
 * OI as a rising-leverage-in-the-system proxy, and both HKEX's and B3's
 * (Brazil) equity/index options put/call ratios as positioning-extremity
 * proxies (log-transformed to be symmetric around parity, same principle as
 * the existing net-%OI extremity inputs above). Every regulatory
 * body/exchange actually checked for this pass — including ones that turned
 * out to be paid/gated/bot-protected rather than free — is listed in
 * docs/DERIVATIVES_ENGINE.md's "Global leading-indicator coverage" section.
 */
export async function runDerivativesLeverageEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [sp500Net, vixNet, treasury10yNet, goldNet, crudeNet, natGasNet, hsiOi, hhiOi, hkexPcr, b3Pcr] = await Promise.all([
    buildIndicator(ctx.db, "cot.sp500_emini.noncomm_net_pct_oi", "CFTC E-mini S&P 500 Non-Commercial Net Position (% OI)", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "cot.vix_futures.noncomm_net_pct_oi", "CFTC VIX Futures Non-Commercial Net Position (% OI)", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "cot_tff.treasury_10y.leveraged_funds_net_pct_oi", "CFTC 10Y Treasury Leveraged-Funds Net Position (% OI)", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "cot_disagg.gold.managed_money_net_pct_oi", "CFTC Gold Managed-Money Net Position (% OI)", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "cot_disagg.crude_oil.managed_money_net_pct_oi", "CFTC Crude Oil Managed-Money Net Position (% OI)", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "cot_disagg.natural_gas.managed_money_net_pct_oi", "CFTC Natural Gas Managed-Money Net Position (% OI)", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "derivatives.hkex.hsi_futures.gross_oi", "HKEX Hang Seng Index Futures Gross Open Interest", "leading", "daily", "contracts"),
    buildIndicator(ctx.db, "derivatives.hkex.hhi_futures.gross_oi", "HKEX H-shares Index Futures Gross Open Interest", "leading", "daily", "contracts"),
    buildIndicator(ctx.db, "derivatives.hkex.options.pcr_oi", "HKEX Equity/Index Options Put/Call OI Ratio", "leading", "daily", "ratio"),
    buildIndicator(ctx.db, "derivatives.b3.options.pcr_volume", "B3 (Brazil) Equity Options Put/Call Volume Ratio", "leading", "daily", "ratio"),
  ]);

  const sp500Extremity = absSeries(sp500Net.series);
  const treasury10yExtremity = absSeries(treasury10yNet.series);
  const goldExtremity = absSeries(goldNet.series);
  const crudeExtremity = absSeries(crudeNet.series);
  const natGasExtremity = absSeries(natGasNet.series);
  const hkexPcrExtremity = absSeries(logSeries(hkexPcr.series));
  const b3PcrExtremity = absSeries(logSeries(b3Pcr.series));

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
      {
        ref: { ...treasury10yNet.ref, key: "cot_tff.treasury_10y.positioning_extremity", label: "10Y Treasury Leveraged-Funds Positioning Extremity (|net %OI|, derived)" },
        series: treasury10yExtremity,
        weight: 0.8,
        zDirection: 1,
      },
      {
        ref: { ...goldNet.ref, key: "cot_disagg.gold.positioning_extremity", label: "Gold Managed-Money Positioning Extremity (|net %OI|, derived)" },
        series: goldExtremity,
        weight: 0.4,
        zDirection: 1,
      },
      {
        ref: { ...crudeNet.ref, key: "cot_disagg.crude_oil.positioning_extremity", label: "Crude Oil Managed-Money Positioning Extremity (|net %OI|, derived)" },
        series: crudeExtremity,
        weight: 0.4,
        zDirection: 1,
      },
      {
        ref: { ...natGasNet.ref, key: "cot_disagg.natural_gas.positioning_extremity", label: "Natural Gas Managed-Money Positioning Extremity (|net %OI|, derived)" },
        series: natGasExtremity,
        weight: 0.3,
        zDirection: 1,
      },
      {
        ref: hsiOi.ref,
        series: hsiOi.series,
        weight: 0.4,
        zDirection: 1,
      },
      {
        ref: hhiOi.ref,
        series: hhiOi.series,
        weight: 0.3,
        zDirection: 1,
      },
      {
        ref: { ...hkexPcr.ref, key: "derivatives.hkex.options.pcr_extremity", label: "HKEX Options Put/Call Extremity (|log ratio|, derived)" },
        series: hkexPcrExtremity,
        weight: 0.5,
        zDirection: 1,
      },
      {
        ref: { ...b3Pcr.ref, key: "derivatives.b3.options.pcr_extremity", label: "B3 (Brazil) Options Put/Call Extremity (|log ratio|, derived)" },
        series: b3PcrExtremity,
        weight: 0.4,
        zDirection: 1,
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
