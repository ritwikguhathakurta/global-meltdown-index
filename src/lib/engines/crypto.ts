import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * Crypto/Stablecoins engine (V3 §19). Stablecoin peg deviation is the
 * financial-stability-relevant metric here (a depeg is the closest crypto
 * analogue to a money-market-fund "breaking the buck" event); raw price
 * moves and BTC dominance are included as coincident risk-appetite context,
 * not because a falling price is inherently "systemic" on its own.
 */
export async function runCryptoEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [usdtPeg, usdcPeg, totalMcap, btcDominance] = await Promise.all([
    buildIndicator(ctx.db, "crypto.usdt_peg_deviation_bps", "USDT Peg Deviation from $1", "leading", "daily", "bps"),
    buildIndicator(ctx.db, "crypto.usdc_peg_deviation_bps", "USDC Peg Deviation from $1", "leading", "daily", "bps"),
    buildIndicator(ctx.db, "crypto.total_market_cap_usd", "Total Crypto Market Cap", "coincident", "daily", "USD"),
    buildIndicator(ctx.db, "crypto.btc_dominance_pct", "Bitcoin Dominance", "coincident", "daily", "%"),
  ]);

  return composeEngineResult({
    engineKey: "crypto_stablecoins",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["STABLE", "NORMAL", "STRESSED", "PEG_STRAIN", "DEPEG_EVENT"],
    inputs: [
      { ref: usdtPeg.ref, series: usdtPeg.series, weight: 1.0, zDirection: 1 },
      { ref: usdcPeg.ref, series: usdcPeg.series, weight: 1.0, zDirection: 1 },
      { ref: totalMcap.ref, series: totalMcap.series, weight: 0.4, zDirection: -1 },
      { ref: btcDominance.ref, series: btcDominance.series, weight: 0.3, zDirection: 1 },
    ],
    triggerDesc:
      "A sustained (not momentary) deviation of USDT or USDC from their $1 peg — analogous to a money-market fund 'breaking the buck' — would indicate a loss of confidence in stablecoin reserve backing or redemption capacity.",
    transmissionMechanism:
      "Given stablecoins' role as the primary settlement/collateral asset across crypto trading and DeFi, a depeg forces rapid deleveraging across crypto-collateralized positions; spillover to traditional finance depends on bank/fund exposure to the issuer's reserves, which this free dataset cannot observe directly.",
    amplifiers: ["Rising BTC dominance during a selloff (capital fleeing altcoins into BTC, a classic risk-off-within-crypto pattern)", "A confirmed reserve-composition or redemption-freeze disclosure (not tracked — requires issuer disclosures)"],
    invalidationConditions: ["Both stablecoins trade within a few basis points of $1", "No confirmed redemption issues at either issuer"],
    confirmationConditions: ["Peg deviation widens and persists across multiple consecutive days rather than reverting intraday", "Total market cap falls sharply in tandem"],
    notYetHappened: ["No confirmed sustained depeg event in the tracked USDT/USDC series"],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });
}
