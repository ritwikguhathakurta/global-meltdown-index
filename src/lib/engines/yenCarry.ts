import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";
import { stdev } from "../metrics/stats";
import type { Point } from "../metrics/stats";

function realizedVolAnnualized(series: Point[], window = 20): number | null {
  const sorted = [...series].sort((a, b) => (a.t < b.t ? -1 : 1));
  if (sorted.length < window + 1) return null;
  const tail = sorted.slice(-window - 1);
  const rets: number[] = [];
  for (let i = 1; i < tail.length; i++) {
    if (tail[i - 1].v === 0) continue;
    rets.push(Math.log(tail[i].v / tail[i - 1].v));
  }
  const sd = stdev(rets);
  return Number.isNaN(sd) ? null : sd * Math.sqrt(252) * 100;
}

export async function runYenCarryEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [usdjpy, audjpy, nzdjpy, us10y, jp10yProxy, cotNet] = await Promise.all([
    buildIndicator(ctx.db, "fx.usdjpy", "USDJPY", "coincident", "daily", "JPY"),
    buildIndicator(ctx.db, "fx.audjpy", "AUDJPY", "coincident", "daily", "JPY"),
    buildIndicator(ctx.db, "fx.nzdjpy", "NZDJPY", "coincident", "daily", "JPY"),
    buildIndicator(ctx.db, "yield.us10y", "US 10Y Yield", "leading", "daily", "%"),
    buildIndicator(ctx.db, "yield.japan_10y_proxy", "Japan 10Y Yield (OECD monthly proxy)", "leading", "monthly", "%"),
    buildIndicator(ctx.db, "cot.jpy.noncomm_net_pct_oi", "CFTC JPY Non-Commercial Net Position (% OI)", "leading", "weekly", "%"),
  ]);

  const usJpSpread: Point[] =
    us10y.series.length && jp10yProxy.series.length
      ? diffAligned(us10y.series, jp10yProxy.series)
      : [];

  const realizedVol = realizedVolAnnualized(usdjpy.series);

  const result = composeEngineResult({
    engineKey: "yen_carry",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["DORMANT", "BUILDING", "STRETCHED", "UNSTABLE", "UNWINDING"],
    inputs: [
      { ref: usdjpy.ref, series: usdjpy.series, weight: 0.8, zDirection: 1 },
      { ref: audjpy.ref, series: audjpy.series, weight: 0.5, zDirection: 1 },
      { ref: nzdjpy.ref, series: nzdjpy.series, weight: 0.4, zDirection: 1 },
      { ref: us10y.ref, series: us10y.series, weight: 0.5, zDirection: 1 },
      {
        ref: { ...cotNet.ref, label: "CFTC JPY Net Short Positioning (% OI, inverted)" },
        series: cotNet.series,
        weight: 0.9,
        zDirection: -1,
      },
    ],
    triggerDesc:
      "The 2024-08 unwind template: a BOJ policy surprise that narrows US-Japan yield spreads while speculative JPY short positioning is stretched and USDJPY realized volatility is compressed, creating conditions for a fast, forced unwind.",
    transmissionMechanism:
      "A sharp JPY appreciation forces yen-funded leveraged positions (across equities, EM FX, and cross-asset carry) to deleverage simultaneously, since margin calls on the FX leg propagate to the funded asset leg.",
    amplifiers: [
      "CFTC net-short positioning near a 52-week extreme",
      "Compressed realized/implied USDJPY volatility going into a BOJ event",
      "Simultaneous US growth-data disappointment (dual shock to the spread)",
    ],
    invalidationConditions: [
      "CFTC net-short positioning normalizes toward its trailing median",
      "USDJPY realized volatility remains contained through a BOJ meeting",
      "US-Japan yield spread stabilizes rather than compressing further",
    ],
    confirmationConditions: [
      "AUDJPY/NZDJPY/MXNJPY/ZARJPY sell off together with USDJPY (cross-carry confirmation)",
      "A BOJ statement or intervention signals imminent policy action",
    ],
    notYetHappened: [
      realizedVol !== null
        ? `20-day realized USDJPY volatility is currently ~${realizedVol.toFixed(1)}% annualized — no confirmed vol-regime break yet`
        : "Realized volatility could not be computed (insufficient USDJPY history)",
      "No confirmed simultaneous cross-carry-pair selloff (AUD/NZD/JPY) has been detected",
    ],
    contradictoryEvidence:
      jp10yProxy.ref.status === "STALE"
        ? ["Japan 10Y proxy series is a monthly OECD-sourced rate and may lag current BOJ policy moves by weeks"]
        : [],
    methodologyVersion: "v0.1-freedata",
  });

  return {
    ...result,
    topDrivers: [
      ...result.topDrivers,
      ...(usJpSpread.length > 0
        ? [{ key: "yield.us_jp_10y_spread", label: "US-Japan 10Y Spread (bps, derived)", contribution: 0 }]
        : []),
    ],
  };
}

function diffAligned(a: Point[], b: Point[]): Point[] {
  const bMap = new Map(b.map((p) => [p.t.slice(0, 7), p.v]));
  return a
    .map((p) => {
      const bv = bMap.get(p.t.slice(0, 7));
      return bv === undefined ? null : { t: p.t, v: (p.v - bv) * 100 };
    })
    .filter((p): p is Point => p !== null);
}
