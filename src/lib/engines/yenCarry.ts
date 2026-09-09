import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { subtractSeriesByDate, realizedVolAnnualized } from "../metrics/stats";
import type { Point } from "../metrics/stats";

/**
 * GFMI-weighted carry-trade stress composite (engine key "yen_carry",
 * unchanged since renaming it would break the continuity of its own
 * historical risk_engine_scores series for no real benefit). Originally
 * USDJPY-only; broadened here to also track CHF, EUR and USD as funding
 * currencies, per the "Global Carry Trade Systemic Risk Engine" spec's own
 * instruction not to limit this to yen carry — using data already flowing
 * into the pipeline for the broader Global Carry Trade Risk analytical page
 * (see carryTrade.ts and /dashboard/yen-carry), no new sources needed.
 *
 * Deliberately does NOT adopt carryTrade.ts's own cross-sectional-percentile
 * scoring methodology — that page's Carry Fragility score has no
 * horizon-dependent windowing (it's a single snapshot), whereas every other
 * GFMI engine's score genuinely differs by short/medium/long horizon via
 * composeEngineResult's own per-horizon z-score window. Reusing that same
 * mechanism here (broader indicator *inputs*, same composition method) keeps
 * this engine's horizon-differentiation, confidence and topDrivers behavior
 * consistent with the other 23 engines instead of introducing a second,
 * differently-shaped scoring paradigm into GFMI for this one engine alone.
 *
 * Each funding currency contributes a "stretched-ness" reading — how much it
 * has already weakened against the dollar (or, for USD itself, how much the
 * dollar has already weakened on a broad basis) — using the same sign
 * convention throughout: a funding currency that has already weakened a lot
 * means the carry trade funded in it has been running in the trade's favor,
 * i.e. more built-up, more crowded, more vulnerable to a reversal. This is a
 * genuinely different (and complementary) concept from carryTrade.ts's own
 * "funding currency reversal" flag (is it now appreciating, i.e. the unwind
 * actually starting) — mixing both into the same z-scored input list would
 * mean two entries on the identical series pointed in opposite directions,
 * which cancel rather than combine. The "is a reversal starting" signal
 * stays on the deeper Carry Trade page, not duplicated here.
 *
 * JPY keeps the largest single weight and its own yield-spread/positioning
 * detail (still the largest, most closely-watched global carry trade); CHF
 * and EUR are added at a smaller weight each via their own USD cross and
 * CFTC positioning; USD uses the broad dollar index (DXY) since it has no
 * currency-vs-USD pair of its own, with an inverted sign (DXY strengthening
 * = the USD funding leg strengthening = the trade running against, not for,
 * carry — the opposite of what a weakening JPY/CHF/EUR means for their own
 * carry trades).
 */
export async function runYenCarryEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [usdjpy, usdchf, usdeur, dxy, audjpy, nzdjpy, us10y, jp10y, cotJpy, cotChf, cotEur] = await Promise.all([
    buildIndicator(ctx.db, "fx.usdjpy", "USDJPY", "coincident", "daily", "JPY"),
    buildIndicator(ctx.db, "fx.usdchf", "USDCHF", "coincident", "daily", "CHF"),
    buildIndicator(ctx.db, "fx.usdeur", "USDEUR", "coincident", "daily", "EUR"),
    buildIndicator(ctx.db, "fx.dxy_broad", "Broad Dollar Index (DXY, USD funding leg)", "coincident", "daily", "index"),
    buildIndicator(ctx.db, "fx.audjpy", "AUDJPY", "coincident", "daily", "JPY"),
    buildIndicator(ctx.db, "fx.nzdjpy", "NZDJPY", "coincident", "daily", "JPY"),
    buildIndicator(ctx.db, "yield.us10y", "US 10Y Yield", "leading", "daily", "%"),
    buildIndicator(ctx.db, "yield.japan_10y", "Japan 10Y JGB Yield (Ministry of Finance, daily)", "leading", "daily", "%"),
    buildIndicator(ctx.db, "cot.jpy.noncomm_net_pct_oi", "CFTC JPY Non-Commercial Net Position (% OI)", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "cot.chf.noncomm_net_pct_oi", "CFTC CHF Non-Commercial Net Position (% OI)", "leading", "weekly", "%"),
    buildIndicator(ctx.db, "cot.eur.noncomm_net_pct_oi", "CFTC EUR Non-Commercial Net Position (% OI)", "leading", "weekly", "%"),
  ]);

  // Now that Japan's yield is a genuine daily series (was a monthly OECD
  // proxy — see govBondYields.ts), the US-Japan spread can be aligned by
  // exact date instead of by calendar month, and is a real enough signal to
  // feed into the composite score directly rather than only being surfaced
  // as a topDriver.
  const usJpSpread: Point[] = subtractSeriesByDate(us10y.series, jp10y.series).map((p) => ({ t: p.t, v: p.v * 100 }));

  const realizedVol = realizedVolAnnualized(usdjpy.series);

  const result = composeEngineResult({
    engineKey: "yen_carry",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["DORMANT", "BUILDING", "STRETCHED", "UNSTABLE", "UNWINDING"],
    inputs: [
      { ref: usdjpy.ref, series: usdjpy.series, weight: 0.6, zDirection: 1 },
      { ref: usdchf.ref, series: usdchf.series, weight: 0.4, zDirection: 1 },
      { ref: usdeur.ref, series: usdeur.series, weight: 0.4, zDirection: 1 },
      { ref: dxy.ref, series: dxy.series, weight: 0.4, zDirection: -1 },
      { ref: audjpy.ref, series: audjpy.series, weight: 0.4, zDirection: 1 },
      { ref: nzdjpy.ref, series: nzdjpy.series, weight: 0.3, zDirection: 1 },
      { ref: us10y.ref, series: us10y.series, weight: 0.5, zDirection: 1 },
      {
        ref: { ...cotJpy.ref, label: "CFTC JPY Net Short Positioning (% OI, inverted)" },
        series: cotJpy.series,
        weight: 0.9,
        zDirection: -1,
      },
      {
        ref: { ...cotChf.ref, label: "CFTC CHF Net Short Positioning (% OI, inverted)" },
        series: cotChf.series,
        weight: 0.4,
        zDirection: -1,
      },
      {
        ref: { ...cotEur.ref, label: "CFTC EUR Net Short Positioning (% OI, inverted)" },
        series: cotEur.series,
        weight: 0.4,
        zDirection: -1,
      },
      {
        ref: {
          key: "yield.us_jp_10y_spread",
          label: "US-Japan 10Y Spread (bps, derived)",
          classification: "leading",
          value: usJpSpread.at(-1)?.v ?? null,
          unit: "bps",
          status: jp10y.ref.status,
          sourceKey: jp10y.ref.sourceKey,
          sourceTier: jp10y.ref.sourceTier,
          asOf: usJpSpread.at(-1)?.t ?? null,
        },
        series: usJpSpread,
        weight: 0.7,
        zDirection: -1,
      },
    ],
    triggerDesc:
      "The 2024-08 unwind template, now tracked across all four major low-yield funding currencies (JPY, CHF, EUR, USD): a policy surprise that narrows a key yield spread while speculative short positioning in the funding currency is stretched and its realized volatility is compressed, creating conditions for a fast, forced unwind.",
    transmissionMechanism:
      "A sharp appreciation in any one of the funding currencies forces leveraged positions funded in it (across equities, EM FX, and cross-asset carry) to deleverage simultaneously, since margin calls on the FX leg propagate to the funded asset leg.",
    amplifiers: [
      "CFTC net-short positioning in JPY, CHF or EUR near a 52-week extreme",
      "Compressed realized/implied USDJPY volatility going into a BOJ event",
      "Simultaneous US growth-data disappointment (dual shock to the US-Japan spread)",
    ],
    invalidationConditions: [
      "CFTC net-short positioning in JPY/CHF/EUR normalizes toward its trailing median",
      "USDJPY realized volatility remains contained through a BOJ meeting",
      "US-Japan yield spread stabilizes rather than compressing further",
    ],
    confirmationConditions: [
      "AUDJPY/NZDJPY sell off together with USDJPY (cross-carry confirmation) — see the Global Carry Trade page for the full funding/target matrix",
      "A BOJ, SNB or ECB statement signals imminent policy action on the funding side",
    ],
    notYetHappened: [
      realizedVol !== null
        ? `20-day realized USDJPY volatility is currently ~${realizedVol.toFixed(1)}% annualized — no confirmed vol-regime break yet`
        : "Realized volatility could not be computed (insufficient USDJPY history)",
      "No confirmed simultaneous selloff across the JPY/CHF/EUR funding legs has been detected",
    ],
    contradictoryEvidence:
      jp10y.ref.status === "STALE" ? ["Japan 10Y series is temporarily stale — may lag current BOJ policy moves"] : [],
    methodologyVersion: "v0.3-broadened-jpy-chf-eur-usd-funding",
  });

  return result;
}
