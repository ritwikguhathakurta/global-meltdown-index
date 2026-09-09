import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { subtractSeriesByDate } from "../metrics/stats";

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
 * - China: no free, verified PBOC total-assets series was found (checked
 *   pbc.gov.cn's own statistics pages directly), but a genuine
 *   balance-sheet-side quantity now feeds this engine instead of leaving
 *   that side empty: China's monthly Official Reserve Assets (Total minus
 *   Gold), IMF-compiled via FRED for deep history and gap-filled forward
 *   each month by SAFE's own fresher release under the identical definition
 *   — see chinaFxReserves.ts. The 3-month interbank rate (the same rate-side
 *   proxy SOFR and the ECB deposit rate play for the US and Eurozone) is
 *   kept alongside it, not replaced by it — one is a quantity signal, the
 *   other a price signal, the same complementary pairing every other G7
 *   central bank already gets in this engine.
 *
 * Money-market-rate-vs-policy-rate spreads (SOFR-IORB, SONIA-Bank Rate,
 * CORRA-Target, €STR-Deposit Facility Rate) were added on top of the
 * balance-sheet levels above — this is the actual "ample vs scarce
 * reserves" framework central banks use themselves (a positive/widening
 * spread means the market rate is printing at or above the policy rate,
 * the same mechanism behind the September 2019 US repo spike), a
 * materially stronger signal than balance-sheet SIZE alone, which only
 * says "bigger or smaller than its own recent trend." See
 * liquidityRegime.ts for the same data turned into a plain per-bank
 * AMPLE/ADEQUATE/TIGHTENING/DEFICIT read on the dashboard page. Japan's
 * uncollateralized overnight call rate (BOJ's own new, free Time-Series
 * API) is added too — previously this engine had no short-term Japan
 * signal at all, only the monthly balance sheet — but has no free daily
 * BOJ target-rate series to pair it with for a spread, so it's tracked on
 * its own level instead.
 */
export async function runGlobalLiquidityEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [
    dxy, sofr, fedBS, rrp, tga, m2, nfci, ecbBS, bojBS, ecbRate,
    ukReserves, canadaAssets, chinaRate, chinaReservesExGold,
    iorb, fedReserves, sonia, bankRate, estr, corra, target, callRate,
  ] = await Promise.all([
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
    buildIndicator(ctx.db, "liquidity.china_reserves_ex_gold", "China Official Reserves ex-Gold (SAFE/FRED, PBOC balance-sheet proxy)", "leading", "monthly", "USD mm"),
    buildIndicator(ctx.db, "rate.us_iorb", "US Interest on Reserve Balances (IORB)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "liquidity.fed_reserve_balances", "Fed Reserve Balances (WRESBAL)", "leading", "weekly", "USD mm"),
    buildIndicator(ctx.db, "rate.uk_sonia", "SONIA (UK)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "rate.uk_bank_rate", "BoE Bank Rate", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "rate.ecb_estr", "€STR (Eurozone)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "rate.canada_corra", "CORRA (Canada)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "rate.canada_target", "BoC Target Overnight Rate", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "rate.japan_call_rate", "Japan Uncollateralized O/N Call Rate", "coincident", "daily", "%"),
  ]);

  const sofrIorbSpread = subtractSeriesByDate(sofr.series, iorb.series).map((p) => ({ t: p.t, v: p.v * 100 }));
  const soniaBankRateSpread = subtractSeriesByDate(sonia.series, bankRate.series).map((p) => ({ t: p.t, v: p.v * 100 }));
  const estrDfrSpread = subtractSeriesByDate(estr.series, ecbRate.series).map((p) => ({ t: p.t, v: p.v * 100 }));
  const corraTargetSpread = subtractSeriesByDate(corra.series, target.series).map((p) => ({ t: p.t, v: p.v * 100 }));

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
      { ref: chinaReservesExGold.ref, series: chinaReservesExGold.series, weight: 0.5, zDirection: -1 },
      { ref: fedReserves.ref, series: fedReserves.series, weight: 0.9, zDirection: -1 },
      { ref: callRate.ref, series: callRate.series, weight: 0.4, zDirection: 1 },
      {
        ref: { key: "liquidity.sofr_iorb_spread", label: "SOFR − IORB Spread (bps, derived)", classification: "leading", value: sofrIorbSpread.at(-1)?.v ?? null, unit: "bps", status: sofr.ref.status, sourceKey: sofr.ref.sourceKey, sourceTier: sofr.ref.sourceTier, asOf: sofrIorbSpread.at(-1)?.t ?? null },
        series: sofrIorbSpread,
        weight: 1.1,
        zDirection: 1,
      },
      {
        ref: { key: "liquidity.sonia_bankrate_spread", label: "SONIA − Bank Rate Spread (bps, derived)", classification: "leading", value: soniaBankRateSpread.at(-1)?.v ?? null, unit: "bps", status: sonia.ref.status, sourceKey: sonia.ref.sourceKey, sourceTier: sonia.ref.sourceTier, asOf: soniaBankRateSpread.at(-1)?.t ?? null },
        series: soniaBankRateSpread,
        weight: 0.6,
        zDirection: 1,
      },
      {
        ref: { key: "liquidity.estr_dfr_spread", label: "€STR − Deposit Facility Rate Spread (bps, derived)", classification: "leading", value: estrDfrSpread.at(-1)?.v ?? null, unit: "bps", status: estr.ref.status, sourceKey: estr.ref.sourceKey, sourceTier: estr.ref.sourceTier, asOf: estrDfrSpread.at(-1)?.t ?? null },
        series: estrDfrSpread,
        weight: 0.6,
        zDirection: 1,
      },
      {
        ref: { key: "liquidity.corra_target_spread", label: "CORRA − Target Rate Spread (bps, derived)", classification: "leading", value: corraTargetSpread.at(-1)?.v ?? null, unit: "bps", status: corra.ref.status, sourceKey: corra.ref.sourceKey, sourceTier: corra.ref.sourceTier, asOf: corraTargetSpread.at(-1)?.t ?? null },
        series: corraTargetSpread,
        weight: 0.5,
        zDirection: 1,
      },
    ],
    triggerDesc:
      "A sustained rise in DXY and SOFR alongside Fed *and* ECB/BOJ/BoE/BoC balance-sheet contraction — not just the Fed alone — has historically preceded the most severe funding-market stress, since dollar funding depends on global, not only US, central-bank liquidity provision. A simultaneous rise in China's interbank rate would signal the stress has spread to the largest non-G7 funding market too.",
    transmissionMechanism:
      "Dollar liquidity tightening raises funding costs for dollar-short borrowers (EM, carry trades, leveraged funds) everywhere, not only in the US; simultaneous tightening by the ECB, BOJ, BoE and BoC removes the offsetting liquidity that has historically cushioned Fed-only tightening episodes.",
    amplifiers: ["Simultaneous Treasury issuance surge", "Foreign official-sector dollar demand shock", "Quarter-end/year-end balance-sheet constraints", "ECB, BOJ, BoE and BoC balance sheets contracting in the same window as the Fed's"],
    invalidationConditions: [
      "Fed balance sheet or reserve balances (WRESBAL) stabilize or expand",
      "SOFR-IORB, SONIA-Bank Rate, €STR-DFR and CORRA-Target spreads all normalize back toward their typical slightly-negative floor-system range",
      "RRP usage rebuilds, indicating ample reserves",
    ],
    confirmationConditions: [
      "FRA-OIS spread widening (not yet tracked — Phase 2)",
      "SOFR, SONIA, €STR or CORRA print at or above their respective policy rate with size (now directly tracked as derived spreads above, not just asserted)",
      "Cross-currency basis (USDJPY, EUR) widening (not yet tracked — Phase 2)",
    ],
    notYetHappened: [
      "No repo-market rate spike has yet been observed in the tracked SOFR series",
      "RRP balances have not shown a disorderly draw",
      "None of the four tracked money-market-rate-vs-policy-rate spreads have moved persistently positive/wide",
    ],
    contradictoryEvidence: [
      "China's balance-sheet-side input (Official Reserves ex-Gold) is a reserves quantity, not PBOC's own total-assets figure — no free source for the latter was found — so a PBOC liquidity operation that doesn't move FX reserves (e.g. a pure RRR cut) could occur without moving this specific China signal.",
      "Japan's uncollateralized overnight call rate is tracked on its own level trend, not a spread — no free daily BOJ policy/target-rate series was found to pair it with, unlike the other four rate pairs.",
    ],
    methodologyVersion: "v0.4-china-reserves-ex-gold",
  });

  return result;
}
