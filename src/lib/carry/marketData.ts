/**
 * Market-data abstraction. The quantitative engine only ever sees CarryInputs; providers are adapters that fill
 * it. Never single-vendor: ManualQuoteProvider (dealer / OTC quotes, USER_INPUT), LiveSnapshotProvider (this site's
 * own free/official series, indicative), MockProvider (tests only) and a CompositeProvider that keeps source priority
 * and raises DATA_CONFLICT instead of silently choosing.
 */
import type { CarryInputs, Ccy, DataQuality, EdgeQuote, Source } from "./types";
import { isNum } from "./units";
import { reconcile, type Conflict } from "./quality";
import { INR } from "./currencies";

export interface Observation {
  currency: string;
  benchmark?: string;
  tenor?: string;
  fixing_date: string | null;
  publication_timestamp: string | null;
  source: string;
  source_kind: Source;
  value: number;
  bid?: number | null;
  offer?: number | null;
  quality: DataQuality;
}

export interface MarketStatus {
  provider: string;
  available: boolean;
  note: string;
}

export interface MarketDataProvider {
  name: string;
  getFxSpot(base: Ccy, quote: Ccy): Observation | null;
  getFxForward(from: Ccy, to: Ccy, tenorYears: number): Observation | null;
  getFxSwapPoints(from: Ccy, to: Ccy, tenorYears: number): Observation | null;
  getInterestCurve(ccy: Ccy, tenorYears: number): Observation | null;
  getCcsCurve(from: Ccy, to: Ccy, tenorYears: number): Observation | null;
  getBasisCurve(from: Ccy, to: Ccy, tenorYears: number): Observation | null;
  getCreditSpread(ccy: Ccy, tenorYears: number): Observation | null;
  getVolatility(ccy: Ccy): Observation | null;
  getMarketStatus(): MarketStatus;
}

export interface LiveSpot {
  base: Ccy;
  quote: Ccy;
  mid: number;
  asOf: string;
  source: string;
}
export interface LiveRate {
  key: string;
  label: string;
  ccy: Ccy;
  value: number;
  unit: string;
  asOf: string;
  source: string;
  change90d: number | null;
}
export interface LiveSnapshot {
  fetchedAt: string;
  spots: LiveSpot[];
  rates: LiveRate[];
  realizedVol: Record<Ccy, number | null>;
  vix: number | null;
  vixAsOf: string | null;
  usdInr30dChangePct: number | null;
  usdJpy30dChangePct: number | null;
}

const NONE = (): null => null;

export class ManualQuoteProvider implements MarketDataProvider {
  name = "Dealer / OTC quotes (USER_INPUT)";
  constructor(private inp: CarryInputs) {}
  private tq() {
    return this.inp.quotesByTenor[String(this.inp.deal.tenorYears)];
  }
  getFxSpot(base: Ccy, quote: Ccy): Observation | null {
    const s = this.inp.spots.find((x) => x.base === base && x.quote === quote);
    if (!s || (!isNum(s.bid) && !isNum(s.ask))) return null;
    const bid = isNum(s.bid) ? s.bid : (s.ask as number);
    const ask = isNum(s.ask) ? s.ask : bid;
    return { currency: `${base}/${quote}`, fixing_date: null, publication_timestamp: s.meta.asOf, source: "Dealer quote", source_kind: s.meta.source, value: (bid + ask) / 2, bid, offer: ask, quality: s.meta.quality };
  }
  private edge(from: Ccy, to: Ccy, kinds: EdgeQuote["instrument"][]): EdgeQuote | undefined {
    return this.tq()?.edges.find((e) => e.from === from && e.to === to && kinds.includes(e.instrument) && (isNum(e.bid) || isNum(e.offer)));
  }
  private obs(e: EdgeQuote, label: string): Observation {
    const v = [e.bid, e.offer].filter(isNum) as number[];
    return { currency: `${e.from}/${e.to}`, benchmark: label, fixing_date: null, publication_timestamp: e.meta.asOf, source: "Dealer quote", source_kind: e.meta.source, value: v.reduce((a, b) => a + b, 0) / v.length, bid: e.bid, offer: e.offer, quality: e.meta.quality };
  }
  getFxForward(from: Ccy, to: Ccy): Observation | null {
    const e = this.edge(from, to, ["FX_FORWARD", "FX_SWAP", "NDF"]);
    return e ? this.obs(e, "forward premium p.a.") : null;
  }
  getFxSwapPoints = (from: Ccy, to: Ccy) => this.getFxForward(from, to);
  getInterestCurve(ccy: Ccy): Observation | null {
    const l = this.tq()?.lenders[ccy];
    if (!l || !isNum(l.benchmarkRate)) return null;
    return { currency: ccy, benchmark: `${ccy} term swap rate`, tenor: `${this.inp.deal.tenorYears}Y`, fixing_date: null, publication_timestamp: l.meta.asOf, source: "Dealer quote", source_kind: l.meta.source, value: l.benchmarkRate, quality: l.meta.quality };
  }
  getCcsCurve(from: Ccy, to: Ccy): Observation | null {
    const e = this.edge(from, to, ["CCS"]);
    return e ? this.obs(e, "CCS fixed rate vs floating flat") : null;
  }
  getBasisCurve(from: Ccy, to: Ccy): Observation | null {
    const e = this.edge(from, to, ["CCS"]);
    const l = this.tq()?.lenders[from];
    const swapTo = to === INR ? this.inp.inrAlt.benchmarkRate : this.tq()?.lenders[to]?.benchmarkRate;
    if (!e || !isNum(l?.benchmarkRate) || !isNum(swapTo)) return null;
    const flat = [e.bid, e.offer].filter(isNum) as number[];
    const mid = flat.reduce((a, b) => a + b, 0) / flat.length;
    return { currency: `${from}/${to}`, benchmark: "implied basis+margin (CCS flat − destination swap rate)", fixing_date: null, publication_timestamp: e.meta.asOf, source: "Derived from dealer quote", source_kind: e.meta.source, value: mid - (swapTo as number), quality: "E" };
  }
  getCreditSpread(ccy: Ccy): Observation | null {
    const l = this.tq()?.lenders[ccy];
    if (!l || !isNum(l.spread)) return null;
    return { currency: ccy, benchmark: "lender spread", tenor: `${this.inp.deal.tenorYears}Y`, fixing_date: null, publication_timestamp: l.meta.asOf, source: "Dealer quote", source_kind: l.meta.source, value: l.spread, quality: l.meta.quality };
  }
  getVolatility(ccy: Ccy): Observation | null {
    const v = this.inp.risk.fxVol[ccy];
    return isNum(v) ? { currency: `${ccy}/INR`, benchmark: "annualised FX vol (user / default)", fixing_date: null, publication_timestamp: this.inp.nowIso, source: "User input", source_kind: "USER_INPUT", value: v, quality: "E" } : null;
  }
  getMarketStatus(): MarketStatus {
    return { provider: this.name, available: true, note: "Manual quotes — you are the source; keep quote times honest." };
  }
}

/** Free / official series already ingested by this site: reference-grade, NOT executable. */
export class LiveSnapshotProvider implements MarketDataProvider {
  name = "Live reference (ECB reference rates & official series)";
  constructor(private snap: LiveSnapshot | null) {}
  getFxSpot(base: Ccy, quote: Ccy): Observation | null {
    const s = this.snap?.spots.find((x) => x.base === base && x.quote === quote);
    if (s) return { currency: `${base}/${quote}`, fixing_date: s.asOf.slice(0, 10), publication_timestamp: s.asOf, source: s.source, source_kind: "LIVE", value: s.mid, quality: "C" };
    const inv = this.snap?.spots.find((x) => x.base === quote && x.quote === base);
    if (inv) return { currency: `${base}/${quote}`, fixing_date: inv.asOf.slice(0, 10), publication_timestamp: inv.asOf, source: inv.source, source_kind: "LIVE", value: 1 / inv.mid, quality: "C" };
    return null;
  }
  getFxForward = NONE;
  getFxSwapPoints = NONE;
  getInterestCurve(ccy: Ccy): Observation | null {
    const r = this.snap?.rates.find((x) => x.ccy === ccy);
    return r ? { currency: ccy, benchmark: r.label, tenor: "O/N–3M (not a term swap rate)", fixing_date: r.asOf.slice(0, 10), publication_timestamp: r.asOf, source: r.source, source_kind: "LIVE", value: r.value / 100, quality: "C" } : null;
  }
  getCcsCurve = NONE;
  getBasisCurve = NONE;
  getCreditSpread = NONE;
  getVolatility(ccy: Ccy): Observation | null {
    const v = this.snap?.realizedVol[ccy];
    return isNum(v) ? { currency: `${ccy}/INR`, benchmark: "1y realised vol (daily log returns)", fixing_date: null, publication_timestamp: this.snap?.fetchedAt ?? null, source: "Computed from stored ECB reference series", source_kind: "MODEL", value: v, quality: "E" } : null;
  }
  getMarketStatus(): MarketStatus {
    return this.snap ? { provider: this.name, available: true, note: `Reference data fetched ${this.snap.fetchedAt}. CCS, forwards and credit spreads are NOT available from free sources — enter dealer quotes.` } : { provider: this.name, available: false, note: "Live reference data unavailable." };
  }
}

/** Test/development only — every value is tagged MODEL, never used for a signal. */
export class MockProvider implements MarketDataProvider {
  name = "Mock (tests only)";
  constructor(private spots: Record<string, number> = {}) {}
  getFxSpot(base: Ccy, quote: Ccy): Observation | null {
    const v = this.spots[`${base}/${quote}`];
    return isNum(v) ? { currency: `${base}/${quote}`, fixing_date: null, publication_timestamp: null, source: "MOCK", source_kind: "MODEL", value: v, quality: "E" } : null;
  }
  getFxForward = NONE;
  getFxSwapPoints = NONE;
  getInterestCurve = NONE;
  getCcsCurve = NONE;
  getBasisCurve = NONE;
  getCreditSpread = NONE;
  getVolatility = NONE;
  getMarketStatus(): MarketStatus {
    return { provider: this.name, available: true, note: "Synthetic values for tests" };
  }
}

export class CompositeProvider {
  constructor(public providers: MarketDataProvider[]) {}
  spot(base: Ccy, quote: Ccy): { primary: Observation | null; conflicts: Conflict[] } {
    const all = this.providers.map((p) => ({ p, o: p.getFxSpot(base, quote) })).filter((x) => x.o);
    const conflicts: Conflict[] = [];
    if (all.length >= 2) {
      const a = all[0];
      for (const b of all.slice(1)) {
        const c = reconcile(`${base}/${quote}`, { label: a.p.name, mid: (a.o as Observation).value }, { label: b.p.name, mid: (b.o as Observation).value });
        if (c) conflicts.push(c);
      }
    }
    return { primary: all[0]?.o ?? null, conflicts };
  }
}

/** Spot conflicts between the user's dealer quotes and the live reference. Never overwrites either. */
export function spotConflicts(inp: CarryInputs, snap: LiveSnapshot | null): Conflict[] {
  if (!snap) return [];
  const manual = new ManualQuoteProvider(inp);
  const live = new LiveSnapshotProvider(snap);
  const out: Conflict[] = [];
  for (const s of inp.spots) {
    if (s.meta.source === "LIVE") continue;
    const a = manual.getFxSpot(s.base, s.quote);
    const b = live.getFxSpot(s.base, s.quote);
    if (a && b && a.source_kind !== "EXAMPLE") {
      const c = reconcile(`${s.base}/${s.quote}`, { label: "Your dealer quote", mid: a.value }, { label: "Live reference (ECB daily fixing)", mid: b.value });
      if (c) out.push(c);
    }
  }
  return out;
}

/* ------------------------------- regime engine ------------------------------- */

export interface Regime {
  labels: string[];
  evidence: string[];
  /** multiplier applied to FX-vol RISK assumptions only — it never changes funding economics */
  volMultiplier: number;
}

export function detectRegime(snap: LiveSnapshot | null): Regime {
  const labels: string[] = [];
  const evidence: string[] = [];
  let mult = 1;
  if (!snap) return { labels: ["Regime unavailable (no live data)"], evidence, volMultiplier: 1 };
  const pol = (key: string, name: string, label: string) => {
    const r = snap.rates.find((x) => x.key === key);
    if (r && r.change90d !== null) {
      const d = r.change90d;
      if (d >= 0.25) {
        labels.push(`${label} tightening`);
        evidence.push(`${name} ${r.value.toFixed(2)}%, +${d.toFixed(2)} pp over 90d`);
      } else if (d <= -0.25) {
        labels.push(`${label} easing`);
        evidence.push(`${name} ${r.value.toFixed(2)}%, ${d.toFixed(2)} pp over 90d`);
      }
    }
  };
  pol("rate.fed_funds_effective", "Fed funds", "Fed");
  pol("rate.ecb_deposit_facility", "ECB deposit rate", "ECB");
  pol("rate.japan_interbank", "Japan interbank", "JPY");
  pol("rate.india_interbank", "India interbank", "INR");
  if (snap.vix !== null) {
    if (snap.vix >= 25) {
      labels.push("Global risk-off");
      evidence.push(`VIX ${snap.vix.toFixed(1)}`);
      mult += 0.3;
    } else if (snap.vix <= 16) {
      labels.push("Global risk-on");
      evidence.push(`VIX ${snap.vix.toFixed(1)}`);
    }
  }
  if (snap.usdInr30dChangePct !== null) {
    if (snap.usdInr30dChangePct >= 2) {
      labels.push("INR stress");
      evidence.push(`USD/INR +${snap.usdInr30dChangePct.toFixed(1)}% in 30d`);
      mult += 0.3;
    } else if (snap.usdInr30dChangePct <= -1.5) {
      labels.push("INR appreciation");
      evidence.push(`USD/INR ${snap.usdInr30dChangePct.toFixed(1)}% in 30d`);
    }
  }
  if (snap.usdJpy30dChangePct !== null && snap.usdJpy30dChangePct <= -4) {
    labels.push("JPY tightening / yen strength");
    evidence.push(`USD/JPY ${snap.usdJpy30dChangePct.toFixed(1)}% in 30d`);
    mult += 0.15;
  }
  if (!labels.length) labels.push("No stress regime detected");
  return { labels, evidence, volMultiplier: mult };
}
