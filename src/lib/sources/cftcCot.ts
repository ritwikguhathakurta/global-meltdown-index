import type { MetricPoint } from "../metrics/store";

/**
 * CFTC Commitments of Traders (Legacy Futures-Only) via the public Socrata API.
 * Free, official, Tier 1. Weekly, released Fridays for the Tuesday as-of date.
 * https://publicreporting.cftc.gov/resource/6dca-aqww.json
 */

type CotDef = { metricKeyPrefix: string; marketName: string };

export const COT_MARKETS: CotDef[] = [
  { metricKeyPrefix: "cot.jpy", marketName: "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot.sp500_emini", marketName: "E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot.vix_futures", marketName: "VIX FUTURES - CBOE FUTURES EXCHANGE" },

  // Global Carry Trade engine — positioning for the other three funding
  // currencies and six of the target currencies. Each market name below is
  // the currently-reporting CME contract, verified live against the most
  // recent report date (CFTC's dataset carries several historical/renamed
  // variants per currency — e.g. plain "BRITISH POUND", not "BRITISH POUND
  // STERLING", which stopped updating in 2022; "NZ DOLLAR", not "NEW ZEALAND
  // DOLLAR"). No CFTC-reportable futures contract was found for INR, IDR,
  // TRY, HUF, PLN, CZK or KRW — positioning is genuinely unavailable for
  // those currencies, not estimated.
  { metricKeyPrefix: "cot.eur", marketName: "EURO FX - CHICAGO MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot.chf", marketName: "SWISS FRANC - CHICAGO MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot.gbp", marketName: "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot.cad", marketName: "CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot.aud", marketName: "AUSTRALIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot.nzd", marketName: "NZ DOLLAR - CHICAGO MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot.mxn", marketName: "MEXICAN PESO - CHICAGO MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot.brl", marketName: "BRAZILIAN REAL - CHICAGO MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot.zar", marketName: "SO AFRICAN RAND - CHICAGO MERCANTILE EXCHANGE" },

  // Oilseeds engine — positioning for the core soybean complex plus canola
  // (rapeseed). No CFTC-reportable contract exists for sunflower seed/oil
  // (traded mainly on Euronext/MATIF, not a US-reportable exchange) —
  // genuinely unavailable, not estimated. Market names verified live
  // against the most recent report date before use.
  { metricKeyPrefix: "cot.soybeans", marketName: "SOYBEANS - CHICAGO BOARD OF TRADE" },
  { metricKeyPrefix: "cot.soybean_oil", marketName: "SOYBEAN OIL - CHICAGO BOARD OF TRADE" },
  { metricKeyPrefix: "cot.soybean_meal", marketName: "SOYBEAN MEAL - CHICAGO BOARD OF TRADE" },
  { metricKeyPrefix: "cot.canola", marketName: "CANOLA - ICE FUTURES U.S." },
];

type CotRow = {
  report_date_as_yyyy_mm_dd: string;
  open_interest_all: string;
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
  comm_positions_long_all: string;
  comm_positions_short_all: string;
};

export async function fetchCotSeries(def: CotDef, sinceIso: string): Promise<MetricPoint[]> {
  const url = new URL("https://publicreporting.cftc.gov/resource/6dca-aqww.json");
  url.searchParams.set("market_and_exchange_names", def.marketName);
  url.searchParams.set("$where", `report_date_as_yyyy_mm_dd >= '${sinceIso.slice(0, 10)}'`);
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd ASC");
  url.searchParams.set("$limit", "500");

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`CFTC COT ${def.marketName}: HTTP ${res.status}`);
  const rows = (await res.json()) as CotRow[];

  const points: MetricPoint[] = [];
  for (const r of rows) {
    const date = r.report_date_as_yyyy_mm_dd.slice(0, 10);
    const long = Number(r.noncomm_positions_long_all);
    const short = Number(r.noncomm_positions_short_all);
    const oi = Number(r.open_interest_all);
    if (Number.isNaN(long) || Number.isNaN(short)) continue;
    const net = long - short;
    points.push(
      {
        metric_key: `${def.metricKeyPrefix}.noncomm_net`,
        observed_at: date,
        value: net,
        unit: "contracts",
        source_key: "cftc_cot",
        source_tier: 1,
        frequency: "weekly",
        raw: { long, short, open_interest: oi },
      },
      {
        metric_key: `${def.metricKeyPrefix}.noncomm_net_pct_oi`,
        observed_at: date,
        value: oi > 0 ? (net / oi) * 100 : 0,
        unit: "%",
        source_key: "cftc_cot",
        source_tier: 1,
        frequency: "weekly",
      }
    );
  }
  return points;
}

/**
 * Disaggregated COT (Socrata resource 72hh-3qpy) — same Legacy-report weekly cadence, but splits
 * non-commercial into real participant categories: Producer/Merchant (commercial hedgers), Swap
 * Dealers, Managed Money (the closest CFTC category to "leveraged funds"), and Other Reportables.
 * Added for the Derivatives & Leverage engine's Positioning tab (spec §52) — the Legacy report's
 * plain non-commercial/commercial split above doesn't distinguish swap dealers from real
 * money/leveraged managers, which matters for telling "who is carrying the leverage" apart from
 * "who is hedging." Market names verified live against the most recent report date (2026-09-15)
 * before use — this dataset renames contracts independently of the Legacy report (e.g. the main
 * NYMEX WTI contract is now "WTI FINANCIAL CRUDE OIL", not "CRUDE OIL, LIGHT SWEET", which stopped
 * updating in Nov 2021; confirmed by open-interest size, not assumed from the name alone).
 */
export const COT_DISAGGREGATED_MARKETS: CotDef[] = [
  { metricKeyPrefix: "cot_disagg.crude_oil", marketName: "WTI FINANCIAL CRUDE OIL - NEW YORK MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot_disagg.natural_gas", marketName: "NAT GAS NYME - NEW YORK MERCANTILE EXCHANGE" },
  { metricKeyPrefix: "cot_disagg.gold", marketName: "GOLD - COMMODITY EXCHANGE INC." },
];

type DisaggregatedCotRow = {
  report_date_as_yyyy_mm_dd: string;
  open_interest_all: string;
  m_money_positions_long_all: string;
  m_money_positions_short_all: string;
  swap_positions_long_all: string;
  swap__positions_short_all: string; // Socrata's own field name has the double underscore
  prod_merc_positions_long: string;
  prod_merc_positions_short: string;
};

export async function fetchDisaggregatedCotSeries(def: CotDef, sinceIso: string): Promise<MetricPoint[]> {
  const url = new URL("https://publicreporting.cftc.gov/resource/72hh-3qpy.json");
  url.searchParams.set("market_and_exchange_names", def.marketName);
  url.searchParams.set("$where", `report_date_as_yyyy_mm_dd >= '${sinceIso.slice(0, 10)}'`);
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd ASC");
  url.searchParams.set("$limit", "500");

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`CFTC disaggregated COT ${def.marketName}: HTTP ${res.status}`);
  const rows = (await res.json()) as DisaggregatedCotRow[];

  const points: MetricPoint[] = [];
  for (const r of rows) {
    const date = r.report_date_as_yyyy_mm_dd.slice(0, 10);
    const oi = Number(r.open_interest_all);
    const mmLong = Number(r.m_money_positions_long_all);
    const mmShort = Number(r.m_money_positions_short_all);
    const swapLong = Number(r.swap_positions_long_all);
    const swapShort = Number(r.swap__positions_short_all);
    const pmLong = Number(r.prod_merc_positions_long);
    const pmShort = Number(r.prod_merc_positions_short);
    if (Number.isNaN(oi) || oi === 0) continue;
    const categories: [string, number, number][] = [
      ["managed_money", mmLong, mmShort],
      ["swap_dealer", swapLong, swapShort],
      ["producer_merchant", pmLong, pmShort],
    ];
    for (const [name, long, short] of categories) {
      if (Number.isNaN(long) || Number.isNaN(short)) continue;
      points.push({
        metric_key: `${def.metricKeyPrefix}.${name}_net_pct_oi`,
        observed_at: date,
        value: ((long - short) / oi) * 100,
        unit: "%",
        source_key: "cftc_cot",
        source_tier: 1,
        frequency: "weekly",
        raw: { long, short, open_interest: oi },
      });
    }
  }
  return points;
}

/**
 * Traders in Financial Futures (Socrata resource gpe5-46if) — the financial-futures analog of the
 * Disaggregated report, with categories Dealer/Intermediary, Asset Manager, Leveraged Funds and
 * Other Reportables. Leveraged Funds is CFTC's own real reported category for the hedge-fund/CTA
 * positioning spec §44/52 asks about — used here rather than estimated. Market names verified live
 * against the most recent report date (2026-09-15): the main Treasury futures contracts are named
 * "UST <tenor> NOTE"/"UST BOND" in this report, not "<N>-YEAR U.S. TREASURY NOTES" (a different,
 * now-stale naming CFTC used in the past).
 */
export const COT_TFF_MARKETS: CotDef[] = [
  { metricKeyPrefix: "cot_tff.treasury_2y", marketName: "UST 2Y NOTE - CHICAGO BOARD OF TRADE" },
  { metricKeyPrefix: "cot_tff.treasury_5y", marketName: "UST 5Y NOTE - CHICAGO BOARD OF TRADE" },
  { metricKeyPrefix: "cot_tff.treasury_10y", marketName: "UST 10Y NOTE - CHICAGO BOARD OF TRADE" },
  { metricKeyPrefix: "cot_tff.treasury_30y", marketName: "UST BOND - CHICAGO BOARD OF TRADE" },
];

type TffCotRow = {
  report_date_as_yyyy_mm_dd: string;
  open_interest_all: string;
  lev_money_positions_long: string;
  lev_money_positions_short: string;
  asset_mgr_positions_long: string;
  asset_mgr_positions_short: string;
  dealer_positions_long_all: string;
  dealer_positions_short_all: string;
};

export async function fetchTffCotSeries(def: CotDef, sinceIso: string): Promise<MetricPoint[]> {
  const url = new URL("https://publicreporting.cftc.gov/resource/gpe5-46if.json");
  url.searchParams.set("market_and_exchange_names", def.marketName);
  url.searchParams.set("$where", `report_date_as_yyyy_mm_dd >= '${sinceIso.slice(0, 10)}'`);
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd ASC");
  url.searchParams.set("$limit", "500");

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`CFTC TFF ${def.marketName}: HTTP ${res.status}`);
  const rows = (await res.json()) as TffCotRow[];

  const points: MetricPoint[] = [];
  for (const r of rows) {
    const date = r.report_date_as_yyyy_mm_dd.slice(0, 10);
    const oi = Number(r.open_interest_all);
    const levLong = Number(r.lev_money_positions_long);
    const levShort = Number(r.lev_money_positions_short);
    const amLong = Number(r.asset_mgr_positions_long);
    const amShort = Number(r.asset_mgr_positions_short);
    const dealerLong = Number(r.dealer_positions_long_all);
    const dealerShort = Number(r.dealer_positions_short_all);
    if (Number.isNaN(oi) || oi === 0) continue;
    const categories: [string, number, number][] = [
      ["leveraged_funds", levLong, levShort],
      ["asset_manager", amLong, amShort],
      ["dealer", dealerLong, dealerShort],
    ];
    for (const [name, long, short] of categories) {
      if (Number.isNaN(long) || Number.isNaN(short)) continue;
      points.push({
        metric_key: `${def.metricKeyPrefix}.${name}_net_pct_oi`,
        observed_at: date,
        value: ((long - short) / oi) * 100,
        unit: "%",
        source_key: "cftc_cot",
        source_tier: 1,
        frequency: "weekly",
        raw: { long, short, open_interest: oi },
      });
    }
  }
  return points;
}
