import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * Global Liquidity engine, extended from Fed+ECB+BOJ to all of G7+China:
 * - UK: Bank of England reserve balances (RPWB56A) — BoE's Weekly Report has
 *   no single "total assets" line in its database (checked directly; it's
 *   broken into many specific instrument series), so reserve balances (the
 *   liabilities side — how much banks hold on deposit at the BoE) is used
 *   instead. This is the same underlying concept as the Fed's own reserve
 *   balances, and arguably the more directly relevant one for gauging
 *   ample-vs-scarce banking-system liquidity.
 * - Canada: Bank of Canada's own "Total assets" series (V36610) from its
 *   weekly balance sheet table, via the Valet API.
 * - Germany/France/Italy: already covered by the ECB balance sheet (there
 *   is no separate national central-bank balance sheet distinct from the
 *   consolidated Eurosystem one — the ECB figure IS their liquidity input).
 * - China: no free, verified PBOC total-assets or reserve-money series was
 *   found (checked pbc.gov.cn's own statistics pages directly) — so China's
 *   funding-rate proxy already tracked elsewhere in this project (the
 *   3-month SHIBOR-equivalent interbank rate) is reused here as China's
 *   liquidity signal, the same role SOFR and the ECB deposit rate play for
 *   the US and Eurozone respectively. This is a rate-side, not
 *   balance-sheet-side, proxy for China — disclosed as such, not papered
 *   over as equivalent to the others.
 */
export async function runGlobalLiquidityEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [dxy, sofr, fedBS, rrp, tga, m2, nfci, ecbBS, bojBS, ecbRate, ukReserves, canadaAssets, chinaRate] = await Promise.all([
    buildIndicator(ctx.db, "fx.dxy_broad", "Broad Dollar Index (DXY proxy)", "coincident", "daily", "index"),
    buildIndicator(ctx.db, "rate.sofr", "SOFR", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "liquidity.fed_balance_sheet", "Fed Balance Sheet (WALCL)", "leading", "weekly", "USD mm"),
    buildIndicator(ctx.db, "liquidity.reverse_repo", "Reverse Repo (RRP) Usage", "leading", "daily", "USD bn"),
    buildIndicator(ctx.db, "liquidity.treasury_general_account", "Treasury General Account", "leading", "weekly", "USD bn"),
    buildIndicator(ctx.db, "liquidity.m2", "M2 Money Supply", "lagging", "monthly", "USD bn"),
    buildIndicator(ctx.db, "liquidity.chicago_fed_nfci", "Chicago Fed National Financial Conditions Index", "coincident", "weekly", "index"),
    buildIndicator(ctx.db, "liquidity.ecb_balance_sheet", "ECB Balance Sheet (Germany/France/Italy)", "leading", "weekly", "EUR mm"),
    buildIndicator(ctx.db, "liquidity.boj_balance_sheet", "BOJ Balance Sheet", "leading", "monthly", "JPY bn"),
    buildIndicator(ctx.db, "rate.ecb_deposit_facility", "ECB Deposit Facility Rate", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "liquidity.uk_boe_reserves", "BoE Reserve Balances (UK)", "leading", "weekly", "GBP mm"),
    buildIndicator(ctx.db, "liquidity.canada_boc_assets", "BoC Total Assets (Canada)", "leading", "weekly", "CAD mm"),
    buildIndicator(ctx.db, "china.interbank_rate_3m", "China 3M Interbank Rate (liquidity proxy)", "coincident", "monthly", "%"),
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
      { ref: ukReserves.ref, series: ukReserves.series, weight: 0.5, zDirection: -1 },
      { ref: canadaAssets.ref, series: canadaAssets.series, weight: 0.4, zDirection: -1 },
      { ref: chinaRate.ref, series: chinaRate.series, weight: 0.5, zDirection: 1 },
    ],
    triggerDesc:
      "A sustained rise in DXY and SOFR alongside Fed *and* ECB/BOJ/BoE/BoC balance-sheet contraction — not just the Fed alone — has historically preceded the most severe funding-market stress, since dollar funding depends on global, not only US, central-bank liquidity provision. A simultaneous rise in China's interbank rate would signal the stress has spread to the largest non-G7 funding market too.",
    transmissionMechanism:
      "Dollar liquidity tightening raises funding costs for dollar-short borrowers (EM, carry trades, leveraged funds) everywhere, not only in the US; simultaneous tightening by the ECB, BOJ, BoE and BoC removes the offsetting liquidity that has historically cushioned Fed-only tightening episodes.",
    amplifiers: ["Simultaneous Treasury issuance surge", "Foreign official-sector dollar demand shock", "Quarter-end/year-end balance-sheet constraints", "ECB, BOJ, BoE and BoC balance sheets contracting in the same window as the Fed's"],
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
    contradictoryEvidence: [
      "China's input here is a money-market rate (3M interbank), not a PBOC balance-sheet/reserve-money figure — no free, verified source for the latter was found — so a PBOC balance-sheet-driven liquidity shift could occur without moving this engine's China signal.",
    ],
    methodologyVersion: "v0.2-freedata-g7-china",
  });

  return result;
}
