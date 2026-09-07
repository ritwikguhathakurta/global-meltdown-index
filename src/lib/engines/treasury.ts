import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { diffSeriesByMonth } from "../metrics/stats";

/**
 * Treasury & Sovereign Debt — G7 + China (V3 §7). Originally US-only, then
 * split into a second "Global Sovereign Debt" engine for the rest of the G7;
 * merged back into a single engine so "Treasury" means what it says: US plus
 * every other G7 government bond market with a free source (UK, Germany,
 * France, Italy, Japan, Canada), not the US alone.
 *
 * UK, Germany, Canada and Japan 10Y yields come directly from their own
 * central bank/finance-ministry (Bank of England, Bundesbank, Bank of
 * Canada, Japan's Ministry of Finance — see govBondYields.ts), each
 * publishing daily with only a few days' lag.
 * Italy and France still come from the FRED/OECD monthly proxy. France's
 * own daily rate (TEC 10) is Euronext-licensed with an explicit
 * no-redistribution clause, so it isn't used (see govBondYields.ts); no
 * equally clean, unrestricted, free daily source was found for Italy within
 * reasonable effort. Both remain genuinely a few months stale by nature of
 * that specific source, not a pipeline fault (verified directly against
 * FRED's own metadata: we hold the freshest value the source has ever
 * published). The Italy-Germany 10Y spread ("BTP-Bund spread") is the
 * single most-watched eurozone fragmentation-risk gauge, computed here
 * rather than fetched since no free source publishes the spread directly —
 * it is still bottlenecked to Italy's monthly cadence even though Germany's
 * own side of it is now daily.
 *
 * Government debt/GDP ratios for every non-US economy here (plus the US's
 * own quarterly figure) are annual or quarterly official national-accounts
 * statistics with a genuine 1-2+ year real-world publication lag — verified
 * directly against FRED's own latest-observation metadata that each series
 * already holds the newest figure that exists anywhere for free. IMF's own
 * WEO database, the only plausible fresher source, sits behind an Akamai
 * bot-mitigation challenge this project will not solve (the same policy
 * already applied to RBI's Imperva/TSPD block). These cannot be made "live"
 * without fabricating data between real annual prints — STALE here reflects
 * the real world, not a fixable gap.
 *
 * China's 10Y yield comes from ChinaBond (CCDC, the PBOC-designated central
 * bond depository) — its "中债国债收益率曲线" is the standard benchmark cited
 * internationally as China's sovereign yield curve, published daily (see
 * chinaBondYield.ts). No FRED/OECD/BIS source publishes this at all, which
 * is why it took direct investigation of CCDC's own site to find. China is
 * additionally represented by its 3-month interbank rate (the closest free
 * proxy for domestic sovereign-adjacent funding stress) and its government
 * debt/GDP ratio (IMF-compiled, same annual cadence and lag as the other G7
 * countries' debt ratios).
 */

export async function runTreasuryEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [
    us2y,
    us10y,
    us30y,
    usDebt,
    uk10y,
    germany10y,
    italy10y,
    france10y,
    japan10y,
    canada10y,
    germanyDebt,
    italyDebt,
    japanDebt,
    canadaDebt,
    ukDebt,
    chinaInterbank,
    chinaDebt,
    china10y,
  ] = await Promise.all([
    buildIndicator(ctx.db, "yield.us02y", "US 2Y Treasury Yield", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "yield.us10y", "US 10Y Treasury Yield", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "yield.us30y", "US 30Y Treasury Yield", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "sovereign.us_debt_to_gdp", "US Federal Debt / GDP", "lagging", "quarterly", "%"),
    buildIndicator(ctx.db, "yield.uk_10y", "UK 10Y Gilt Yield (Bank of England, daily)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "yield.germany_10y", "Germany 10Y Bund Yield (Bundesbank, daily)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "yield.italy_10y", "Italy 10Y BTP Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.france_10y", "France 10Y OAT Yield", "coincident", "monthly", "%"),
    buildIndicator(ctx.db, "yield.japan_10y", "Japan 10Y JGB Yield (Ministry of Finance, daily)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "yield.canada_10y", "Canada 10Y Yield (Bank of Canada, daily)", "coincident", "daily", "%"),
    buildIndicator(ctx.db, "sovereign.germany_debt_to_gdp", "Germany Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "sovereign.italy_debt_to_gdp", "Italy Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "sovereign.japan_debt_to_gdp", "Japan Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "sovereign.canada_debt_to_gdp", "Canada Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "sovereign.uk_debt_to_gdp", "UK Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "china.interbank_rate_3m", "China 3M Interbank Rate (sovereign-yield proxy)", "leading", "monthly", "%"),
    buildIndicator(ctx.db, "sovereign.china_debt_to_gdp", "China Government Debt / GDP", "lagging", "annual", "%"),
    buildIndicator(ctx.db, "yield.china_10y", "China 10Y Government Bond Yield (ChinaBond/CCDC, daily)", "coincident", "daily", "%"),
  ]);

  const btpBundSpread = diffSeriesByMonth(italy10y.series, germany10y.series);

  return composeEngineResult({
    engineKey: "us_treasury_sovereign",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["WELL_ABSORBED", "NORMAL", "SOFTENING_DEMAND", "FUNDING_STRESS", "DISLOCATED"],
    inputs: [
      { ref: us2y.ref, series: us2y.series, weight: 0.6, zDirection: 1 },
      { ref: us10y.ref, series: us10y.series, weight: 1.0, zDirection: 1 },
      { ref: us30y.ref, series: us30y.series, weight: 0.8, zDirection: 1 },
      { ref: usDebt.ref, series: usDebt.series, weight: 0.6, zDirection: 1 },
      { ref: uk10y.ref, series: uk10y.series, weight: 0.5, zDirection: 1 },
      { ref: germany10y.ref, series: germany10y.series, weight: 0.4, zDirection: 1 },
      { ref: italy10y.ref, series: italy10y.series, weight: 0.6, zDirection: 1 },
      { ref: france10y.ref, series: france10y.series, weight: 0.4, zDirection: 1 },
      { ref: japan10y.ref, series: japan10y.series, weight: 0.5, zDirection: 1 },
      { ref: canada10y.ref, series: canada10y.series, weight: 0.4, zDirection: 1 },
      {
        ref: { key: "yield.btp_bund_spread", label: "Italy-Germany 10Y Spread (bps, derived)", classification: "leading", value: btpBundSpread.at(-1)?.v ?? null, unit: "bps", status: italy10y.ref.status, sourceKey: italy10y.ref.sourceKey, sourceTier: italy10y.ref.sourceTier, asOf: italy10y.ref.asOf },
        series: btpBundSpread,
        weight: 0.9,
        zDirection: 1,
      },
      { ref: germanyDebt.ref, series: germanyDebt.series, weight: 0.3, zDirection: 1 },
      { ref: italyDebt.ref, series: italyDebt.series, weight: 0.4, zDirection: 1 },
      { ref: japanDebt.ref, series: japanDebt.series, weight: 0.4, zDirection: 1 },
      { ref: canadaDebt.ref, series: canadaDebt.series, weight: 0.3, zDirection: 1 },
      { ref: ukDebt.ref, series: ukDebt.series, weight: 0.3, zDirection: 1 },
      { ref: chinaInterbank.ref, series: chinaInterbank.series, weight: 0.4, zDirection: 1 },
      { ref: chinaDebt.ref, series: chinaDebt.series, weight: 0.3, zDirection: 1 },
      { ref: china10y.ref, series: china10y.series, weight: 0.5, zDirection: 1 },
    ],
    triggerDesc:
      "A rapid, disorderly rise in long-end yields across the US and its G7 peers (rising term premium rather than growth optimism) — especially a widening Italy-Germany spread, the classic eurozone fragmentation gauge — alongside rising debt/GDP trajectories and China funding-rate stress would indicate broad-based, not idiosyncratic, developed-market sovereign funding deterioration.",
    transmissionMechanism:
      "Higher long-end yields raise governments' own interest expense (crowding out other spending), repricing risk assets that discount off the risk-free curve, and raising mortgage/corporate borrowing costs economy-wide; widening peripheral-vs-core eurozone spreads additionally pressure domestic banks holding that sovereign's debt (the banking-sovereign 'doom loop').",
    amplifiers: ["Weak auction demand (not yet tracked here — bid-to-cover, indirect bidder share)", "A rating-agency outlook downgrade on any tracked issuer", "Simultaneous foreign official-sector selling", "BTP-Bund spread widening beyond its trailing range"],
    invalidationConditions: ["Long yields fall or stabilize with strong auction demand", "Term premium and the BTP-Bund spread compress back toward trailing medians"],
    confirmationConditions: ["Auction tails widen (not yet tracked)", "Sovereign CDS widens materially (not yet tracked)"],
    notYetHappened: ["No confirmed pattern of disorderly weak demand across the tracked sovereign markets"],
    contradictoryEvidence: ["Italy and France yields still come from a monthly proxy that lags 2-4 months (France's own daily rate is Euronext-licensed and not used, per govBondYields.ts); UK, Germany, Canada, Japan and China are now daily", "Government debt/GDP ratios genuinely lag 1-2+ years by nature of the underlying national-accounts statistics — not fixable without a source IMF WEO update this project can't reach (Akamai-blocked)"],
    methodologyVersion: "v0.5-freedata-mof-japan",
  });
}
