import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

export async function runGlobalLiquidityEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [dxy, sofr, fedBS, rrp, tga, m2, nfci, ecbBS, bojBS, ecbRate] = await Promise.all([
    buildIndicator(ctx.db, "fx.dxy_broad", "Broad Dollar Index (DXY proxy)", "coincident", "daily", "index"),
    buildIndicator(ctx.db, "rate.sofr", "SOFR", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "liquidity.fed_balance_sheet", "Fed Balance Sheet (WALCL)", "leading", "weekly", "USD mm"),
    buildIndicator(ctx.db, "liquidity.reverse_repo", "Reverse Repo (RRP) Usage", "leading", "daily", "USD bn"),
    buildIndicator(ctx.db, "liquidity.treasury_general_account", "Treasury General Account", "leading", "weekly", "USD bn"),
    buildIndicator(ctx.db, "liquidity.m2", "M2 Money Supply", "lagging", "monthly", "USD bn"),
    buildIndicator(ctx.db, "liquidity.chicago_fed_nfci", "Chicago Fed National Financial Conditions Index", "coincident", "weekly", "index"),
    buildIndicator(ctx.db, "liquidity.ecb_balance_sheet", "ECB Balance Sheet", "leading", "weekly", "EUR mm"),
    buildIndicator(ctx.db, "liquidity.boj_balance_sheet", "BOJ Balance Sheet", "leading", "monthly", "JPY bn"),
    buildIndicator(ctx.db, "rate.ecb_deposit_facility", "ECB Deposit Facility Rate", "coincident", "daily", "%"),
  ]);

  const result = composeEngineResult({
    engineKey: "global_liquidity",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["AMPLE", "ADEQUATE", "TIGHTENING", "TIGHT", "SEVERE_DRAIN"],
    inputs: [
      { ref: dxy.ref, series: dxy.series, weight: 1.0, zDirection: 1 },
      { ref: sofr.ref, series: sofr.series, weight: 0.8, zDirection: 1 },
      { ref: fedBS.ref, series: fedBS.series, weight: 1.2, zDirection: -1 },
      { ref: rrp.ref, series: rrp.series, weight: 0.6, zDirection: -1 },
      { ref: tga.ref, series: tga.series, weight: 0.6, zDirection: 1 },
      { ref: m2.ref, series: m2.series, weight: 0.5, zDirection: -1 },
      { ref: nfci.ref, series: nfci.series, weight: 0.9, zDirection: 1 },
      { ref: ecbBS.ref, series: ecbBS.series, weight: 0.6, zDirection: -1 },
      { ref: bojBS.ref, series: bojBS.series, weight: 0.5, zDirection: -1 },
      { ref: ecbRate.ref, series: ecbRate.series, weight: 0.4, zDirection: 1 },
    ],
    triggerDesc:
      "A sustained rise in DXY and SOFR alongside Fed *and* ECB/BOJ balance-sheet contraction — not just the Fed alone — has historically preceded the most severe funding-market stress, since dollar funding depends on global, not only US, central-bank liquidity provision.",
    transmissionMechanism:
      "Dollar liquidity tightening raises funding costs for dollar-short borrowers (EM, carry trades, leveraged funds) everywhere, not only in the US; simultaneous tightening by the ECB and BOJ removes the offsetting liquidity that has historically cushioned Fed-only tightening episodes.",
    amplifiers: ["Simultaneous Treasury issuance surge", "Foreign official-sector dollar demand shock", "Quarter-end/year-end balance-sheet constraints", "ECB and BOJ balance sheets contracting in the same window as the Fed's"],
    invalidationConditions: [
      "Fed balance sheet stabilizes or expands",
      "SOFR-IORB spread normalizes",
      "RRP usage rebuilds, indicating ample reserves",
    ],
    confirmationConditions: [
      "FRA-OIS spread widening (not yet tracked — Phase 2)",
      "Repo rate spikes above IORB with size",
      "Cross-currency basis (USDJPY, EUR) widening (not yet tracked — Phase 2)",
    ],
    notYetHappened: [
      "No repo-market rate spike has yet been observed in the tracked SOFR series",
      "RRP balances have not shown a disorderly draw",
    ],
    contradictoryEvidence: [],
    methodologyVersion: "v0.1-freedata",
  });

  return result;
}
