import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { subtractSeriesByDate, previousOf } from "../metrics/stats";

/**
 * Credit Markets — G7 + China. US (HY/IG OAS) and the Eurozone G7 members
 * (Germany/France/Italy, priced as one EUR corporate market — corporate
 * bonds aren't issued or spread-quoted per Eurozone nation the way
 * sovereign debt is, so there is no separate "German corporate spread"
 * distinct from the Euro-area one) were already covered. China now has its
 * own dedicated signal too: ChinaBond's AAA corporate curve minus its
 * government curve (same source, same tenor, same day — see
 * chinaBondYield.ts), replacing reliance on the regional Asia-Pacific EM
 * proxy alone for China specifically.
 *
 * UK, Canada and Japan do NOT get a country-specific corporate SPREAD here
 * — checked exhaustively (FRED's entire 192-series ICE BofA Indices release
 * has zero GBP/CAD/JPY-denominated corporate series; the Bank of England's
 * own database was checked directly and publishes corporate bond issuance
 * flow data but no queryable yield/spread series) and no free equivalent
 * was found. Their sovereign yield spread vs US Treasuries (or vs Bunds for
 * eurozone peers) is already tracked on the Treasury tab (see treasury.ts),
 * not duplicated here, since that is a sovereign, not corporate, signal.
 * Instead, each gets the BIS credit-to-GDP gap (see bisCreditGap.ts) — a
 * genuinely different, complementary kind of credit signal: a structural
 * quantity-side "is credit growing faster than its long-run trend relative
 * to GDP" early-warning (the Basel III countercyclical-buffer indicator),
 * not a market-priced spread. Disclosed as such wherever it's shown, not
 * blended in as if it were spread data. See creditRegime.ts for the full
 * per-country table shown on this dashboard page.
 */
export async function runCreditEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [hy, ig, em, euroHy, asiaEm, chinaCorpAaa, chinaGov, ukGap, canadaGap, japanGap] = await Promise.all([
    buildIndicator(ctx.db, "credit.hy_oas", "US High-Yield OAS", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "credit.ig_oas", "US Investment-Grade OAS", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "credit.em_oas", "EM Corporate Bond OAS", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "credit.euro_hy_oas", "Euro-Area High-Yield OAS", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "credit.asia_em_oas", "Asia-Pacific EM Corporate OAS (incl. China exposure)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "credit.china_corp_aaa_10y", "China AAA Corporate Bond Yield (10Y, ChinaBond)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "yield.china_10y", "China 10Y Government Bond Yield (ChinaBond)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "credit.uk_credit_gap", "UK Credit-to-GDP Gap (BIS)", "leading", "quarterly", "pp of GDP (gap)"),
    buildIndicator(ctx.db, "credit.canada_credit_gap", "Canada Credit-to-GDP Gap (BIS)", "leading", "quarterly", "pp of GDP (gap)"),
    buildIndicator(ctx.db, "credit.japan_credit_gap", "Japan Credit-to-GDP Gap (BIS)", "leading", "quarterly", "pp of GDP (gap)"),
  ]);

  const chinaCorpGovtSpread = subtractSeriesByDate(chinaCorpAaa.series, chinaGov.series).map((p) => ({ t: p.t, v: p.v * 100 }));

  return composeEngineResult({
    engineKey: "credit",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["COMPRESSED", "NORMAL", "WIDENING", "STRESSED", "DISLOCATED"],
    inputs: [
      { ref: hy.ref, series: hy.series, weight: 1.2, zDirection: 1 },
      { ref: ig.ref, series: ig.series, weight: 0.8, zDirection: 1 },
      { ref: em.ref, series: em.series, weight: 1.0, zDirection: 1 },
      { ref: euroHy.ref, series: euroHy.series, weight: 0.9, zDirection: 1 },
      { ref: asiaEm.ref, series: asiaEm.series, weight: 0.6, zDirection: 1 },
      {
        ref: {
          key: "credit.china_corp_govt_spread",
          label: "China AAA Corporate-Government Spread (bps, derived)",
          classification: "coincident",
          value: chinaCorpGovtSpread.at(-1)?.v ?? null,
          unit: "bps",
          status: chinaCorpAaa.ref.status,
          sourceKey: chinaCorpAaa.ref.sourceKey,
          sourceTier: chinaCorpAaa.ref.sourceTier,
          asOf: chinaCorpGovtSpread.at(-1)?.t ?? null,
          previousValue: previousOf(chinaCorpGovtSpread)?.v ?? null,
        },
        series: chinaCorpGovtSpread,
        weight: 0.7,
        zDirection: 1,
      },
      { ref: ukGap.ref, series: ukGap.series, weight: 0.5, zDirection: 1 },
      { ref: canadaGap.ref, series: canadaGap.series, weight: 0.5, zDirection: 1 },
      { ref: japanGap.ref, series: japanGap.series, weight: 0.5, zDirection: 1 },
    ],
    triggerDesc: "A rapid widening in HY/IG OAS spreads, especially outpacing equity-market moves, historically signals credit-market repricing of default risk ahead of broader risk-asset stress. US and Euro-area high-yield widening together with China's AAA corporate-government spread (rather than one region only) indicates broad-based, not regional, credit stress. A rising UK, Canada or Japan credit-to-GDP gap adds a structural, quantity-side early-warning on top of the spread-based signals.",
    transmissionMechanism: "Wider spreads raise refinancing costs for leveraged issuers, which can trigger downgrades, forced selling by mandate-constrained funds, and tightening bank lending standards. A widening credit-to-GDP gap works differently: it signals credit growth has outpaced its long-run trend relative to GDP, the standard leading indicator for a future correction even before spreads move.",
    amplifiers: ["Simultaneous private-credit or leveraged-loan stress", "Large maturity wall concentrated in near-dated years", "Rating-agency downgrade cycle"],
    invalidationConditions: ["Spreads retrace toward trailing-year median", "New issuance market reopens at reasonable concessions", "Credit-to-GDP gaps normalize back toward zero"],
    confirmationConditions: ["Leveraged-loan default rate rises (not yet tracked — Phase 2)", "CDX HY/IG index confirms cash-bond move (not yet tracked — Phase 2)"],
    notYetHappened: ["No confirmed acceleration in reported corporate default rates yet"],
    contradictoryEvidence: [
      "No free GBP, CAD or JPY-denominated corporate OAS index was found (checked FRED's full ICE BofA Indices release and the Bank of England's own database directly) — UK, Canada and Japan have no market-priced corporate spread here; instead they use the BIS credit-to-GDP gap, a genuinely different (structural, quantity-side, quarterly) signal, not a substitute spread reading.",
      "Germany, France and Italy share one input (Euro-Area HY OAS) since eurozone corporate bonds are priced as a single EUR market, not per-nation — a country-specific eurozone corporate divergence would not show up separately here.",
    ],
    methodologyVersion: "v0.3-freedata-bis-credit-gap",
  });
}
