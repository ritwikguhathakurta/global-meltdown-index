import type { MetricPoint } from "../metrics/store";

/**
 * CFTC Commitments of Traders (Legacy Futures-Only) via the public Socrata API.
 * Free, official, Tier 1. Weekly, released Fridays for the Tuesday as-of date.
 * https://publicreporting.cftc.gov/resource/6dca-aqww.json
 */

type CotDef = { metricKeyPrefix: string; marketName: string };

export const COT_MARKETS: CotDef[] = [
  { metricKeyPrefix: "cot.jpy", marketName: "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE" },
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
