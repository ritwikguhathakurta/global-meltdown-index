import type { MetricPoint } from "../metrics/store";

/**
 * Delayed-but-real daily futures settlement prices from Massive
 * (massive.com), a paid financial market-data API covering CME/CBOT/NYMEX/
 * COMEX only (no ICE — live-verified Cotton/Coffee/Sugar/Cocoa don't exist
 * anywhere in this platform's product list, so Soft Commodities can't be
 * filled from here). The real-time snapshot endpoint returns 403 "not
 * entitled" for every ticker on this account's plan (confirmed with a
 * deliberately bogus ticker too, ruling out a per-symbol restriction) — but
 * the historical/delayed aggregates endpoint (`/futures/v1/aggs/{ticker}`)
 * IS accessible and returns real, coherent, dated settlement prices. This
 * connector uses that endpoint exclusively.
 *
 * Only products with a genuine gap or exact match elsewhere in this app are
 * covered here — Gold/Silver/Copper/Aluminum/Zinc were deliberately left
 * out even though they're real and available, since Base/Precious Metals
 * already have a live daily price from Yahoo Finance
 * (yahooIndex.ts, commodity.<slug>.daily_futures_price) and duplicating that
 * with a second paid source would add complexity with no new capability.
 * Live Cattle/Lean Hogs/Feeder Cattle/Lumber were checked and are real
 * tradable Massive products too, but this app's commodity taxonomy
 * (taxonomy.ts) has no Livestock/Dairy or Forestry row that means the same
 * thing as those futures contracts (its rows are Beef/Chicken/Lamb — retail
 * meat prices — and Logs — a different physical product than sawn Lumber),
 * so wiring them in would silently attach one commodity's price to a
 * different commodity's row. Left out rather than force a wrong match.
 *
 * What IS covered: Corn and Wheat (US SRW) close a gap the Grains page's own
 * disclosure explicitly names ("no free daily futures feed... verified and
 * wired in yet"); Soybeans/Soybean Oil/Soybean Meal extend the Oilseeds
 * Short-Term heatmap (today only Palm Oil has one) using taxonomy.ts's
 * EXACT existing slugs; Crude Oil (WTI) and Natural Gas (Henry Hub) fill the
 * Chemicals overview page's own disclosed gap ("There is no free global
 * chemical spot-price source") as upstream feedstock reference prices, not
 * finished-chemical prices.
 *
 * Front-month resolution: CME-family futures don't share one ticker format
 * — confirmed live that Crude Oil/RBOB/Gold/CBOT grains use a single
 * trailing year digit (CLX6 = Nov 2026) while Natural Gas uses two (NGV26 =
 * Oct 2026); guessing wrong silently returns an empty result, not an error,
 * so this can't be hardcoded per product. Instead, for each product this
 * probes the current month + next 3 months, in both digit formats until one
 * format is confirmed (then reuses it for the rest), and picks whichever
 * candidate month has the HIGHEST trading volume as the reference contract
 * — not always the nearest calendar month (verified live: Gold's Oct-2026
 * contract technically already trades but Dec-2026 had ~28x its volume),
 * since the highest-volume contract is the standard definition of a
 * quarterly-cycle market's "active"/reference price.
 *
 * "Delayed" here does not mean end-of-day only — verified live that the
 * still-open current session's bar updates with real intraday O/H/L/C before
 * settlement, with `settlement_price: 0` until the session actually closes.
 * This connector always prefers the most recent CLOSED session (nonzero
 * settlement_price) so it never reports a still-forming price as final.
 */

const BASE_URL = "https://api.massive.com/futures/v1";
const MONTH_CODES = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"]; // Jan..Dec

/** Exact mass conversion (1 metric tonne = 2204.62262 lb) — not an assumed
 * density like the propane USD/GAL case (eiaChemicalFeedstockSpot.ts): mass
 * is mass regardless of what the pound is a pound of, so this is a genuine
 * unit conversion, not an invented number. Used only for Soybean Oil, which
 * (unlike this file's other products) also feeds an absolute-value display
 * (Oleochemicals' feedstock price-context cards, already in USD/mt) rather
 * than only a percentage-change calculation, where the native unit would
 * have been fine as-is. */
const LB_PER_METRIC_TON = 2204.62262;
function centsPerLbToUsdPerMt(centsPerLb: number): number {
  return (centsPerLb / 100) * LB_PER_METRIC_TON;
}

export type MassiveFuturesProduct = {
  slug: string;
  productCode: string;
  name: string;
  unit: string;
  /** Converts the raw settlement price (in the exchange's native quoting
   * unit) into `unit` above. Omitted when the native unit is used as-is. */
  convert?: (nativeValue: number) => number;
};

export const MASSIVE_FUTURES_PRODUCTS: MassiveFuturesProduct[] = [
  { slug: "crude_oil", productCode: "CL", name: "Crude Oil (WTI, NYMEX)", unit: "USD/bbl" },
  { slug: "natural_gas", productCode: "NG", name: "Natural Gas (Henry Hub, NYMEX)", unit: "USD/MMBtu" },
  { slug: "maize", productCode: "ZC", name: "Corn (CBOT)", unit: "cents/bu" },
  { slug: "wheat_us_srw", productCode: "ZW", name: "Wheat, US SRW (CBOT)", unit: "cents/bu" },
  { slug: "soybeans", productCode: "ZS", name: "Soybeans (CBOT)", unit: "cents/bu" },
  { slug: "soybean_oil", productCode: "ZL", name: "Soybean Oil (CBOT)", unit: "USD/mt", convert: centsPerLbToUsdPerMt },
  { slug: "soybean_meal", productCode: "ZM", name: "Soybean Meal (CBOT)", unit: "USD/short ton" },
];

export function massiveFuturesMetricKey(slug: string): string {
  return `commodity.${slug}.daily_futures_price`;
}

type AggBar = {
  ticker: string;
  window_start: number;
  session_end_date: string;
  volume: number;
  settlement_price: number;
};
type AggResponse = { status: string; results?: AggBar[]; error?: string };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The account-wide per-minute rate limit is real (confirmed live — hit
 * after roughly half a dozen rapid calls) but undocumented and NOT reflected
 * by the x-ratelimit-* response headers (which claimed a 100,000,000/minute
 * limit and were then immediately contradicted by a 429-equivalent error) —
 * so this paces itself on a fixed, conservative delay rather than trusting
 * those headers. */
export const MASSIVE_REQUEST_DELAY_MS = 1500;

export class MassiveRateLimitError extends Error {}

async function fetchAggBars(apiKey: string, ticker: string, sinceIso: string): Promise<AggBar[]> {
  const url = new URL(`${BASE_URL}/aggs/${ticker}`);
  url.searchParams.set("resolution", "1day");
  url.searchParams.set("window_start.gte", sinceIso);
  url.searchParams.set("sort", "window_start.desc");
  url.searchParams.set("limit", "5");
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}` }, next: { revalidate: 0 } });
  const json = (await res.json()) as AggResponse;
  if (json.status === "ERROR") {
    if (/exceeded the maximum requests per minute/i.test(json.error ?? "")) {
      throw new MassiveRateLimitError(json.error ?? "rate limited");
    }
    throw new Error(`Massive aggs ${ticker}: ${json.error ?? `HTTP ${res.status}`}`);
  }
  return json.results ?? [];
}

/** 10 days back is enough to find the most recent CLOSED session regardless
 * of weekends/holidays, without pulling in a whole month of unused bars. */
function recentWindowStartIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 10);
  return d.toISOString().slice(0, 10);
}

/** The current session's bar has settlement_price 0 until it actually
 * closes — reporting that as if final would misrepresent an in-progress
 * price as settled, so this always skips forward to the last real one. */
function latestClosedBar(bars: AggBar[]): AggBar | null {
  return bars.find((b) => b.settlement_price !== 0 && b.settlement_price != null) ?? null;
}

/** Probes the current month + next 3 months for a product's reference
 * contract, discovering whichever year-digit format (1 or 2 digits) this
 * product actually uses on its first hit and reusing it thereafter (halving
 * the call count in the common case) — see this file's doc comment for why
 * this can't be hardcoded. Sequential with a delay between every call. */
async function resolveFrontMonthBar(apiKey: string, productCode: string): Promise<{ ticker: string; bar: AggBar } | null> {
  const since = recentWindowStartIso();
  const now = new Date();
  let yearDigits: 1 | 2 | null = null;
  const candidates: { ticker: string; bar: AggBar }[] = [];

  for (let i = 0; i < 4; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const letter = MONTH_CODES[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const oneDigitTicker = `${productCode}${letter}${String(year).slice(-1)}`;
    const twoDigitTicker = `${productCode}${letter}${String(year).slice(-2)}`;
    const toTry: string[] = yearDigits === 1 ? [oneDigitTicker] : yearDigits === 2 ? [twoDigitTicker] : [oneDigitTicker, twoDigitTicker];

    for (const ticker of toTry) {
      await delay(MASSIVE_REQUEST_DELAY_MS);
      const bars = await fetchAggBars(apiKey, ticker, since);
      const closed = latestClosedBar(bars);
      if (closed) {
        if (yearDigits === null) yearDigits = ticker === oneDigitTicker ? 1 : 2;
        candidates.push({ ticker, bar: closed });
      }
    }
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.bar.volume > best.bar.volume ? c : best));
}

export async function fetchMassiveFuturesProduct(apiKey: string, product: MassiveFuturesProduct): Promise<MetricPoint[]> {
  const resolved = await resolveFrontMonthBar(apiKey, product.productCode);
  if (!resolved) return [];
  const value = product.convert ? product.convert(resolved.bar.settlement_price) : resolved.bar.settlement_price;
  return [
    {
      metric_key: massiveFuturesMetricKey(product.slug),
      observed_at: resolved.bar.session_end_date,
      value,
      unit: product.unit,
      source_key: "massive_futures",
      source_tier: 3,
      frequency: "daily",
      raw: { ticker: resolved.ticker, volume: resolved.bar.volume },
    },
  ];
}
