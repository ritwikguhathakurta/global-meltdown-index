import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchSeries } from "@/lib/metrics/store";
import type { LiveRate, LiveSnapshot, LiveSpot } from "@/lib/carry/marketData";

type Pt = { t: string; v: number };

/** ECB daily reference fixing (via Frankfurter, already ingested by the daily pipeline): official, NOT a dealer quote. */
const FX_SRC = "ECB reference rate (Frankfurter)";

const RATE_KEYS: { key: string; label: string; ccy: string }[] = [
  { key: "rate.sofr", label: "SOFR (overnight)", ccy: "USD" },
  { key: "rate.ecb_deposit_facility", label: "ECB deposit facility rate", ccy: "EUR" },
  { key: "rate.japan_interbank", label: "Japan interbank (short)", ccy: "JPY" },
  { key: "rate.chf_interbank_3m", label: "CHF interbank 3M", ccy: "CHF" },
  { key: "rate.uk_short_term", label: "UK short-term rate", ccy: "GBP" },
  { key: "rate.australia_interbank", label: "Australia interbank", ccy: "AUD" },
  { key: "rate.canada_interbank", label: "Canada interbank", ccy: "CAD" },
  { key: "rate.india_interbank", label: "India interbank (short)", ccy: "INR" },
  { key: "rate.fed_funds_effective", label: "Fed funds effective", ccy: "USD" },
];

const FX_KEYS = ["fx.usdinr", "fx.usdjpy", "fx.usdeur", "fx.usdgbp", "fx.usdchf", "fx.usdaud", "fx.usdcad"] as const;

function realizedVol(series: Pt[]): number | null {
  if (series.length < 60) return null;
  const r: number[] = [];
  for (let i = 1; i < series.length; i++) if (series[i].v > 0 && series[i - 1].v > 0) r.push(Math.log(series[i].v / series[i - 1].v));
  if (r.length < 40) return null;
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const v = r.reduce((a, b) => a + (b - m) * (b - m), 0) / (r.length - 1);
  return Math.sqrt(v * 252);
}

function ratioSeries(num: Pt[], den: Pt[]): Pt[] {
  const d = new Map(den.map((p) => [p.t, p.v]));
  const out: Pt[] = [];
  for (const p of num) {
    const x = d.get(p.t);
    if (x && x > 0) out.push({ t: p.t, v: p.v / x });
  }
  return out;
}

function pctChange(series: Pt[], days: number): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const cutoff = Date.parse(last.t) - days * 86_400_000;
  let ref: Pt | null = null;
  for (const p of series) if (Date.parse(p.t) <= cutoff) ref = p;
  return ref && ref.v > 0 ? ((last.v - ref.v) / ref.v) * 100 : null;
}

/** Indicative reference data for the Funding Carry page. Never used as an executable price. */
export async function getCarryLiveSnapshot(): Promise<LiveSnapshot | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const since120 = new Date(Date.now() - 130 * 86_400_000).toISOString();
    const [fxSeries, rateSeries, vixSeries] = await Promise.all([
      Promise.all(FX_KEYS.map((k) => fetchSeries(db, k, since).catch(() => [] as Pt[]))),
      Promise.all(RATE_KEYS.map((r) => fetchSeries(db, r.key, since120).catch(() => [] as Pt[]))),
      fetchSeries(db, "vol.vix", since120).catch(() => [] as Pt[]),
    ]);
    const fx = Object.fromEntries(FX_KEYS.map((k, i) => [k, fxSeries[i]])) as Record<(typeof FX_KEYS)[number], Pt[]>;
    const latest = (s: Pt[]) => (s.length ? s[s.length - 1] : null);
    const inr = latest(fx["fx.usdinr"]);
    const spots: LiveSpot[] = [];
    const add = (base: string, quote: string, mid: number | null, asOf: string | null) => {
      if (mid !== null && Number.isFinite(mid) && mid > 0 && asOf) spots.push({ base, quote, mid, asOf, source: FX_SRC });
    };
    if (inr) add("USD", "INR", inr.v, inr.t);
    const usdX: [string, (typeof FX_KEYS)[number], boolean][] = [
      ["EUR", "fx.usdeur", true],
      ["GBP", "fx.usdgbp", true],
      ["AUD", "fx.usdaud", true],
      ["JPY", "fx.usdjpy", false],
      ["CHF", "fx.usdchf", false],
      ["CAD", "fx.usdcad", false],
    ];
    for (const [c, key, xPerUsdIsBase] of usdX) {
      const l = latest(fx[key]);
      if (!l) continue;
      if (xPerUsdIsBase) add(c, "USD", 1 / l.v, l.t);
      else add("USD", c, l.v, l.t);
      if (inr) add(c, "INR", inr.v / l.v, l.t);
    }
    const rates: LiveRate[] = [];
    RATE_KEYS.forEach((r, i) => {
      const s = rateSeries[i];
      const l = latest(s);
      if (!l) return;
      const cutoff = Date.parse(l.t) - 90 * 86_400_000;
      let ref: Pt | null = null;
      for (const p of s) if (Date.parse(p.t) <= cutoff) ref = p;
      rates.push({ key: r.key, label: r.label, ccy: r.ccy, value: l.v, unit: "%", asOf: l.t, source: "Official series stored by the daily pipeline", change90d: ref ? l.v - ref.v : null });
    });
    const vol: Record<string, number | null> = {};
    vol.USD = inr ? realizedVol(fx["fx.usdinr"]) : null;
    for (const [c, key] of [["EUR", "fx.usdeur"], ["GBP", "fx.usdgbp"], ["AUD", "fx.usdaud"], ["JPY", "fx.usdjpy"], ["CHF", "fx.usdchf"], ["CAD", "fx.usdcad"]] as const) {
      vol[c] = inr ? realizedVol(ratioSeries(fx["fx.usdinr"], fx[key])) : null;
    }
    const vix = latest(vixSeries);
    return {
      fetchedAt: new Date().toISOString(),
      spots,
      rates,
      realizedVol: vol,
      vix: vix ? vix.v : null,
      vixAsOf: vix ? vix.t : null,
      usdInr30dChangePct: pctChange(fx["fx.usdinr"], 30),
      usdJpy30dChangePct: pctChange(fx["fx.usdjpy"], 30),
    };
  } catch (e) {
    console.error(`getCarryLiveSnapshot: ${(e as Error).message}`);
    return null;
  }
}
