import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * India Liquidity — a standalone engine, deliberately separate from India
 * Market Regime (indiaRegime.ts, a bullish/bearish equity-regime read on a
 * different 0-100 scale) since this tracks banking-system funding
 * conditions, the same concept Global Liquidity tracks for the rest of
 * G7+China, not a market-direction call.
 *
 * Both inputs come from RBI's own daily "Money Market Operations as on
 * <date>" press release (rbiLiquidity.ts) — a genuine official release with
 * real numbers inline in the HTML, not a PDF (RBI's PDF-serving subdomain,
 * rbidocs.rbi.org.in, sits behind an Imperva/TSPD bot-mitigation JS
 * challenge, verified directly; this project does not solve bot challenges
 * to reach blocked content, which is why the PDF "Weekly Statistical
 * Supplement" release was not used):
 * - RBI's own headline "net liquidity injected/absorbed" figure — India's
 *   direct analog to the Fed's RRP/reserve-operations signal already
 *   tracked in globalLiquidity.ts. Negative = RBI absorbing a banking-system
 *   surplus (ample liquidity); positive = RBI net injecting (a deficit).
 * - The Call Money segment's Weighted Average Rate (WACR) — India's
 *   overnight interbank rate, the direct analog to SOFR/EFFR.
 * USDINR (already tracked elsewhere in this project, e.g. indiaRegime.ts)
 * is reused here as a coincident cross-check: rupee depreciation pressure
 * often coincides with RBI liquidity operations aimed at defending the
 * currency.
 */
export async function runIndiaLiquidityEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [netLiquidity, wacr, usdinr] = await Promise.all([
    buildIndicator(ctx.db, "india.rbi_net_liquidity", "RBI Net Liquidity (LAF, injection+/absorption-)", "leading", "daily", "INR crore"),
    buildIndicator(ctx.db, "india.wacr", "Weighted Average Call Rate (WACR)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "fx.usdinr", "USDINR", "coincident", "daily", "INR"),
  ]);

  return composeEngineResult({
    engineKey: "india_liquidity",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["AMPLE", "ADEQUATE", "TIGHTENING", "TIGHT", "SEVERE_DRAIN"],
    inputs: [
      { ref: netLiquidity.ref, series: netLiquidity.series, weight: 1.2, zDirection: 1 },
      { ref: wacr.ref, series: wacr.series, weight: 0.8, zDirection: 1 },
      { ref: usdinr.ref, series: usdinr.series, weight: 0.6, zDirection: 1 },
    ],
    triggerDesc:
      "A shift from RBI net-absorbing (surplus) to net-injecting (deficit) liquidity operations, alongside a rising Weighted Average Call Rate and rupee depreciation pressure, has historically signaled banking-system funding stress in India — the same pattern the Fed's RRP-to-repo-market-stress transition signals in the US.",
    transmissionMechanism:
      "A liquidity deficit raises the marginal cost of overnight funding for Indian banks, which passes through to bank lending rates and NBFC (non-bank financial company) funding costs — India's NBFC sector is particularly sensitive to money-market conditions, having driven a real funding crisis in 2018-19 (the IL&FS default) when market liquidity tightened.",
    amplifiers: ["Simultaneous FII outflow pressure on the rupee (see India Market Regime)", "Simultaneous EM Debt or Global Liquidity engine stress", "RBI FX intervention to defend the rupee, which itself drains rupee liquidity"],
    invalidationConditions: ["RBI liquidity operations return to net absorption (a surplus)", "WACR reverts toward the repo rate", "USDINR stabilizes"],
    confirmationConditions: ["A confirmed RBI policy response (CRR cut, OMO purchase, or explicit liquidity injection announcement) — not yet tracked, would require RBI monetary-policy-statement monitoring"],
    notYetHappened: ["No sustained shift to net liquidity injection has yet been observed in the tracked series"],
    contradictoryEvidence: [
      "RBI's weekly forex-reserves and reserve-money figures are not tracked here — the official Weekly Statistical Supplement PDF that carries them is bot-protected on rbidocs.rbi.org.in — so a reserves-driven liquidity shift could occur without showing up in this engine's daily LAF/WACR inputs.",
    ],
    methodologyVersion: "v0.1-freedata-rbi",
  });
}
