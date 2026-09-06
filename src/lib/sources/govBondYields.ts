import type { MetricPoint } from "../metrics/store";

/**
 * Direct-from-central-bank daily government bond yields for Germany, the UK
 * and Canada — replacing the OECD Main Economic Indicators monthly proxy
 * these three used to share with the rest of the G7 on FRED
 * (IRLTLT01xxM156N), which structurally lags 2-4 months in publication.
 * Each of these three national statistical warehouses publishes its own
 * 10-year benchmark yield daily with only a few days' lag, free, no key —
 * a real freshness upgrade, not just a relabeling. Italy, France and Japan
 * have no equally clean free daily source that was found (Italy's own
 * central bank and finance-ministry statistical APIs were checked and
 * didn't resolve to a working public endpoint within reasonable effort),
 * so those three stay on the FRED/OECD monthly proxy in fred.ts.
 *
 * Each fetcher re-downloads the full available history and upserts it —
 * these are official permanent archives (not a status feed that trims old
 * items), so unlike cloudStatus.ts there's no risk of a later refetch
 * silently overwriting a correct historical value with a truncated one.
 */

const commonHeaders = { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" };

const MONTH_ABBR: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/**
 * Parses the BoE CSV's "DD Mon YYYY" date into an ISO date string via pure string
 * manipulation — deliberately NOT `new Date("03 Aug 2026")`, which V8 parses as local
 * midnight (not UTC), silently shifting the date by a day once re-serialized via
 * toISOString() in any timezone east of UTC.
 */
function parseBoeDate(s: string): string | null {
  const m = s.match(/^(\d{1,2}) (\w{3}) (\d{4})$/);
  if (!m) return null;
  const mm = MONTH_ABBR[m[2]];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

/**
 * Deutsche Bundesbank BBSIS series D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A —
 * the standard daily yield on listed federal securities, 10-year residual
 * maturity bucket (the series commonly aliased "BBK01.WT1010"). History to 1997.
 */
export async function fetchGermanyYield10y(): Promise<MetricPoint[]> {
  const url =
    "https://api.statistiken.bundesbank.de/rest/data/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A?format=json";
  const res = await fetch(url, { headers: commonHeaders, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Bundesbank Germany 10Y: HTTP ${res.status}`);
  const json = (await res.json()) as {
    data: { structure: { dimensions: { observation: [{ values: { id: string }[] }] } }; dataSets: [{ series: Record<string, { observations: Record<string, [number | string | null]> }> }] };
  };
  const dates = json.data.structure.dimensions.observation[0].values;
  const seriesKey = Object.keys(json.data.dataSets[0].series)[0];
  const obs = json.data.dataSets[0].series[seriesKey].observations;

  const points: MetricPoint[] = [];
  for (const [idx, [val]] of Object.entries(obs)) {
    if (val === null || val === undefined) continue;
    const date = dates[Number(idx)]?.id;
    if (!date) continue;
    const v = typeof val === "string" ? parseFloat(val) : val;
    if (Number.isNaN(v)) continue;
    points.push({
      metric_key: "yield.germany_10y",
      observed_at: date,
      value: v,
      unit: "%",
      source_key: "bundesbank",
      source_tier: 1,
      frequency: "daily",
    });
  }
  return points;
}

/**
 * Bank of England Interactive Statistical Database, series IUDMNZC — "Yield
 * from British Government Securities, 10 year Nominal Zero Coupon". History
 * available back well past what z-scoring needs; a 12-year window keeps the
 * request small while still giving deep history.
 */
export async function fetchUkYield10y(): Promise<MetricPoint[]> {
  const today = new Date();
  const from = new Date(today);
  from.setUTCFullYear(from.getUTCFullYear() - 12);
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}/${d.getUTCFullYear()}`;
  const url = `https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?csv.x=yes&SeriesCodes=IUDMNZC&UsingCodes=Y&Datefrom=${fmt(from)}&Dateto=${fmt(today)}&CSVF=TT`;
  const res = await fetch(url, { headers: commonHeaders, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Bank of England UK 10Y: HTTP ${res.status}`);
  const csv = await res.text();

  const points: MetricPoint[] = [];
  for (const line of csv.split("\n")) {
    const [dateRaw, valRaw] = line.split(",").map((s) => s.trim());
    if (!dateRaw || !valRaw) continue;
    const isoDate = parseBoeDate(dateRaw);
    if (!isoDate) continue;
    const v = parseFloat(valRaw);
    if (Number.isNaN(v)) continue;
    points.push({
      metric_key: "yield.uk_10y",
      observed_at: isoDate,
      value: v,
      unit: "%",
      source_key: "boe",
      source_tier: 1,
      frequency: "daily",
    });
  }
  return points;
}

/** Bank of Canada Valet API, series BD.CDN.10YR.DQ.YLD — "Benchmark bond yield: 10 year". */
export async function fetchCanadaYield10y(): Promise<MetricPoint[]> {
  const url = "https://www.bankofcanada.ca/valet/observations/BD.CDN.10YR.DQ.YLD/json?start_date=2000-01-01";
  const res = await fetch(url, { headers: commonHeaders, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Bank of Canada 10Y: HTTP ${res.status}`);
  const json = (await res.json()) as { observations: { d: string; "BD.CDN.10YR.DQ.YLD"?: { v: string } }[] };

  const points: MetricPoint[] = [];
  for (const row of json.observations) {
    const d = row.d;
    const cell = row["BD.CDN.10YR.DQ.YLD"];
    if (!d || !cell?.v) continue;
    const v = parseFloat(cell.v);
    if (Number.isNaN(v)) continue;
    points.push({
      metric_key: "yield.canada_10y",
      observed_at: d,
      value: v,
      unit: "%",
      source_key: "boc",
      source_tier: 1,
      frequency: "daily",
    });
  }
  return points;
}
