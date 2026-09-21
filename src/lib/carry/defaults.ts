import type { Ccy, CarryInputs, EdgeQuote, LenderQuote, Meta, SpotQuote, TenorQuotes } from "./types";
import { CURRENCIES, FUNDING_CCYS, INR, USD, benchmarkName, currencyDef, spotPairsFor } from "./currencies";
import { BP, crToInr } from "./units";

export const MODEL_VERSION = "carry-engine-1.0.0";
export const TENORS = [1, 2, 3, 5, 7, 10];

export function meta(source: Meta["source"], quality: Meta["quality"], asOf: string | null): Meta {
  return { source, quality, asOf };
}

export function edgeId(from: Ccy, to: Ccy, instrument: string): string {
  return `${from}>${to}:${instrument}`;
}

export function emptyLender(ccy: Ccy, nowIso: string): LenderQuote {
  return { ccy, benchmarkRate: null, spread: null, upfrontFeePct: null, ongoingFeeBp: null, structure: "floating", meta: meta("USER_INPUT", "A", nowIso) };
}

export function emptyEdge(from: Ccy, to: Ccy, instrument: EdgeQuote["instrument"], nowIso: string): EdgeQuote {
  return { id: edgeId(from, to, instrument), from, to, instrument, bid: null, offer: null, upfrontBp: null, ongoingBp: null, meta: meta("USER_INPUT", "A", nowIso) };
}

export function emptyTenorQuotes(nowIso: string): TenorQuotes {
  const lenders: Record<Ccy, LenderQuote> = {};
  for (const c of FUNDING_CCYS) lenders[c] = emptyLender(c, nowIso);
  const edges: EdgeQuote[] = [];
  for (const c of FUNDING_CCYS) {
    edges.push(emptyEdge(c, INR, "CCS", nowIso));
    if (c !== USD) edges.push(emptyEdge(c, USD, "CCS", nowIso));
  }
  return { lenders, edges };
}

export function emptySpots(nowIso: string): SpotQuote[] {
  return spotPairsFor(FUNDING_CCYS).map((p) => ({ ...p, bid: null, ask: null, meta: meta("USER_INPUT", "A", nowIso) }));
}

export function defaultInputs(nowIso: string): CarryInputs {
  const liq: Record<Ccy, number> = {};
  const vol: Record<Ccy, number | null> = {};
  for (const c of CURRENCIES) {
    liq[c.code] = c.liquidity;
    vol[c.code] = null;
  }
  return {
    deal: {
      requirementInr: crToInr(500),
      tenorYears: 5,
      startDate: nowIso.slice(0, 10),
      paymentFreq: 1,
      dayCount: "30/360",
      amortisation: "bullet",
      graceYears: 0,
      hedgeRatio: 1,
      minSaving: 50 * BP,
      unhedgedDriftPa: 0,
    },
    inrAlt: { label: "User-defined hurdle", rate: null, freq: 1, upfrontFeePct: 0, ongoingFeeBp: 0, benchmarkRate: null },
    spots: emptySpots(nowIso),
    quotesByTenor: { "5": emptyTenorQuotes(nowIso) },
    otherCosts: { legalDocsInr: 0, isdaCsaInr: 0, registrationInr: 0, agencyAnnualInr: 0, custodyAnnualInr: 0, otherUpfrontInr: 0, otherAnnualInr: 0 },
    tax: { mode: "excluded", whtRate: 0, whtSource: "", gstOnFeesRate: 0, stampDutyPct: 0, guaranteeFeeBpPa: 0, interestShieldRate: 0 },
    rbi: {
      apply: false,
      swapRate: 0.015,
      compoundingPerYear: 2,
      maxTenorYears: 5,
      fbilRef: null,
      windowOpenUntil: "2027-01-15",
      drawdownFrom: "2026-06-08",
      drawdownTo: "2026-12-31",
    },
    reg: {
      borrowerType: "PRIVATE_CORPORATE",
      endUse: "General corporate / capex (permitted)",
      lenderNonResident: true,
      manufacturing: false,
      relatedParty: false,
      netWorthInr: null,
      drawdownDate: nowIso.slice(0, 10),
      userConfirmedRules: [],
    },
    risk: {
      fxVol: vol,
      confidence: 0.95,
      horizonDays: 63,
      rateVolBp: 100,
      basisVolBp: 15,
      spreadVolBp: 40,
      liquidity: liq,
      riskAversion: 1,
      maxSingleCurrencyShare: 0.7,
      maxUnhedgedShare: 0.25,
      minLiquidityScore: 0.4,
      maxFxEsPctOfNotional: 0.1,
    },
    bands: { veryStrong: 100 * BP, strong: 50 * BP, marginal: 25 * BP },
    stale: { fxSpotMin: 5, hedgeMin: 30, creditMin: 120 },
    nowIso,
  };
}

function setSpot(s: SpotQuote[], base: Ccy, quote: Ccy, bid: number, ask: number, m: Meta) {
  const x = s.find((p) => p.base === base && p.quote === quote);
  if (x) {
    x.bid = bid;
    x.ask = ask;
    x.meta = m;
  }
}

/**
 * ILLUSTRATIVE worked example (the shape of the master prompt's ₹500 Cr / 5Y / 7.10% / 50 bp case).
 * Every value is tagged source=EXAMPLE, quality=E: it can never produce an executable signal, and it is
 * NOT market data — replace each number with the quote your bank gives you.
 */
export function exampleInputs(nowIso: string): CarryInputs {
  const inp = defaultInputs(nowIso);
  const m = meta("EXAMPLE", "E", nowIso);
  inp.inrAlt.rate = 0.071;
  const sp = inp.spots;
  setSpot(sp, "USD", "INR", 95.91, 95.95, m);
  setSpot(sp, "EUR", "INR", 110.22, 110.28, m);
  setSpot(sp, "JPY", "INR", 0.61196, 0.61216, m);
  setSpot(sp, "CHF", "INR", 118.24, 118.32, m);
  setSpot(sp, "SGD", "INR", 74.58, 74.63, m);
  setSpot(sp, "EUR", "USD", 1.1491, 1.1493, m);
  setSpot(sp, "USD", "JPY", 156.7, 156.74, m);
  setSpot(sp, "USD", "CHF", 0.8111, 0.8113, m);
  setSpot(sp, "USD", "SGD", 1.2859, 1.2862, m);
  const q = inp.quotesByTenor["5"];
  const lend = (c: Ccy, bench: number, spread: number, fee: number) => {
    q.lenders[c] = { ...q.lenders[c], benchmarkRate: bench, spread, upfrontFeePct: fee, ongoingFeeBp: 0, meta: m };
  };
  lend("USD", 0.039, 0.0085, 0.002);
  lend("EUR", 0.023, 0.0095, 0.002);
  lend("JPY", 0.014, 0.009, 0.002);
  lend("CHF", 0.0075, 0.01, 0.002);
  lend("SGD", 0.033, 0.0095, 0.002);
  const edge = (from: Ccy, to: Ccy, bid: number, offer: number) => {
    const e = q.edges.find((x) => x.from === from && x.to === to && x.instrument === "CCS");
    if (e) {
      e.bid = bid;
      e.offer = offer;
      e.meta = m;
    }
  };
  edge("USD", INR, 0.052, 0.0528);
  edge("EUR", INR, 0.0525, 0.0535);
  edge("JPY", INR, 0.0543, 0.0552);
  edge("CHF", INR, 0.0568, 0.0578);
  edge("SGD", INR, 0.0556, 0.0566);
  edge("EUR", USD, 0.0352, 0.0358);
  edge("JPY", USD, 0.0342, 0.0347);
  edge("CHF", USD, 0.0334, 0.034);
  edge("SGD", USD, 0.0357, 0.0363);
  inp.risk.fxVol = { ...inp.risk.fxVol, USD: 0.04, EUR: 0.07, JPY: 0.09, CHF: 0.07, SGD: 0.05, GBP: 0.07, AUD: 0.09, CAD: 0.06, HKD: 0.04 };
  return inp;
}

export { benchmarkName, currencyDef };
