import type { MetricPoint } from "../metrics/store";

/**
 * Direct-from-central-bank/finance-ministry daily government bond yields
 * for Germany, the UK, Canada and (as of this file's latest addition) Japan
 * — replacing the OECD Main Economic Indicators monthly proxy these four
 * used to share with the rest of the G7 on FRED (IRLTLT01xxM156N), which
 * structurally lags 2-4 months in publication. Each of these four national
 * statistical warehouses publishes its own 10-year benchmark yield daily
 * with only a few days' lag, free, no key — a real freshness upgrade, not
 * just a relabeling.
 *
 * Italy and France do NOT get the same upgrade, for two different reasons
 * checked directly rather than assumed:
 * - France: Agence France Trésor's own daily 10-year rate (the TEC 10 /
 *   CNO-TEC® index) is real and free to view, but its own publisher page
 *   states outright that the underlying index is "calculated and
 *   administered by Euronext Paris" and that "these values may not be
 *   redistributed, sub-licensed or used for commercial purposes... without
 *   the prior written authorisation of Euronext Paris" — the same category
 *   of explicit-redistribution-restriction this project already declines to
 *   route around for CCIL's India debt-market data (see the methodology
 *   page). Not used, for the same reason.
 * - Italy: no equally clean, unrestricted, free daily source was found
 *   within reasonable effort (Banca d'Italia's own statistical database
 *   didn't resolve to a working public query endpoint, and its BTP
 *   secondary-market yields are, like France's, calculated by a licensed
 *   market operator (MTS) rather than published as the central bank's own
 *   unrestricted series).
 *
 * Both stay on the FRED/OECD monthly proxy in fred.ts, disclosed as such.
 *
 * Each fetcher re-downloads the full available history and upserts it —
 * these are official permanent archives (not a status feed that trims old
 * items), so unlike cloudStatus.ts there's no risk of a later refetch
 * silently overwriting a correct historical value with a truncated one.
 *
 * Also holds the UK and Canada inputs for the Global Liquidity engine
 * (reserve balances and central-bank total assets respectively), plus each
 * central bank's money-market-rate-vs-policy-rate pair (SONIA/Bank Rate for
 * the UK, CORRA/Target for Canada) and the ECB's/BOJ's equivalents (€STR,
 * the uncollateralized overnight call rate) — grouped here rather than in a
 * separate file since they reuse the same connections and date-parsing
 * helpers as the yield fetchers above. See liquidityRegime.ts for how these
 * rate pairs turn into an AMPLE/ADEQUATE/TIGHTENING/DEFICIT read per
 * central bank on the Liquidity dashboard.
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

/**
 * Bank of England IADB series RPWB56A — weekly amounts outstanding of
 * central bank sterling reserve balance liabilities (£mm). Used as the UK's
 * Global Liquidity input in place of a single "total assets" figure: BoE's
 * own Weekly Report has no one clean total-assets series in this database
 * (checked directly — it's broken into many specific instrument lines with
 * no aggregate "Total" row), but reserve balances — the liabilities side,
 * i.e. how much banks hold on deposit at the BoE — is itself the standard
 * measure of the size of BoE's liquidity provision to the banking system
 * (the same concept the Fed's own "reserve balances" series tracks, and
 * arguably more directly relevant to gauging ample-vs-scarce reserves than
 * a raw total-assets number would be).
 */
export async function fetchUkReserveBalances(): Promise<MetricPoint[]> {
  const url =
    "https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?csv.x=yes&SeriesCodes=RPWB56A&UsingCodes=Y&Datefrom=01/Jan/2000&Dateto=31/Dec/2030&CSVF=TT";
  const res = await fetch(url, { headers: commonHeaders, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Bank of England reserve balances: HTTP ${res.status}`);
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
      metric_key: "liquidity.uk_boe_reserves",
      observed_at: isoDate,
      value: v,
      unit: "GBP mm",
      source_key: "boe",
      source_tier: 1,
      frequency: "weekly",
    });
  }
  return points;
}

/** Bank of Canada Valet API, series V36610 — "Total assets" from the weekly balance sheet table. */
export async function fetchCanadaCentralBankAssets(): Promise<MetricPoint[]> {
  const url = "https://www.bankofcanada.ca/valet/observations/V36610/json?start_date=2000-01-01";
  const res = await fetch(url, { headers: commonHeaders, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Bank of Canada total assets: HTTP ${res.status}`);
  const json = (await res.json()) as { observations: { d: string; V36610?: { v: string } }[] };

  const points: MetricPoint[] = [];
  for (const row of json.observations) {
    const d = row.d;
    const cell = row.V36610;
    if (!d || !cell?.v) continue;
    const v = parseFloat(cell.v);
    if (Number.isNaN(v)) continue;
    points.push({
      metric_key: "liquidity.canada_boc_assets",
      observed_at: d,
      value: v,
      unit: "CAD mm",
      source_key: "boc",
      source_tier: 1,
      frequency: "weekly",
    });
  }
  return points;
}

/**
 * SONIA (IUDSOIA) and the Official Bank Rate (IUDBEDR), both from BoE's IADB
 * in one request. SONIA-vs-Bank-Rate is the standard UK gauge of whether
 * banking-system reserves are ample (SONIA trades a few bps under Bank
 * Rate, as designed under the BoE's floor system) or scarce (SONIA prints
 * meaningfully above Bank Rate) — the same "money-market rate vs policy
 * rate" framework used across all G7 central banks here (see
 * liquidityRegime.ts), not just a balance-sheet-size read.
 */
export async function fetchUkShortRates(): Promise<MetricPoint[]> {
  const url =
    "https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?csv.x=yes&SeriesCodes=IUDSOIA,IUDBEDR&UsingCodes=Y&Datefrom=01/Jan/2000&Dateto=31/Dec/2030&CSVF=TT";
  const res = await fetch(url, { headers: commonHeaders, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Bank of England SONIA/Bank Rate: HTTP ${res.status}`);
  const csv = await res.text();

  const points: MetricPoint[] = [];
  for (const line of csv.split("\n")) {
    const [dateRaw, soniaRaw, bankRateRaw] = line.split(",").map((s) => s.trim());
    const isoDate = dateRaw ? parseBoeDate(dateRaw) : null;
    if (!isoDate) continue;
    const sonia = parseFloat(soniaRaw);
    if (!Number.isNaN(sonia)) {
      points.push({ metric_key: "rate.uk_sonia", observed_at: isoDate, value: sonia, unit: "%", source_key: "boe", source_tier: 1, frequency: "daily" });
    }
    const bankRate = parseFloat(bankRateRaw);
    if (!Number.isNaN(bankRate)) {
      points.push({ metric_key: "rate.uk_bank_rate", observed_at: isoDate, value: bankRate, unit: "%", source_key: "boe", source_tier: 1, frequency: "daily" });
    }
  }
  return points;
}

/**
 * CORRA (AVG.INTWO) and the Target for the Overnight Rate (V39079), both
 * from the Bank of Canada's Valet API — Canada's equivalent of the
 * SOFR-vs-IORB / SONIA-vs-Bank-Rate ample-reserves gauge.
 */
export async function fetchCanadaShortRates(): Promise<MetricPoint[]> {
  const [corraRes, targetRes] = await Promise.all([
    fetch("https://www.bankofcanada.ca/valet/observations/AVG.INTWO/json?start_date=2000-01-01", { headers: commonHeaders, next: { revalidate: 0 } }),
    fetch("https://www.bankofcanada.ca/valet/observations/V39079/json?start_date=2000-01-01", { headers: commonHeaders, next: { revalidate: 0 } }),
  ]);
  if (!corraRes.ok) throw new Error(`Bank of Canada CORRA: HTTP ${corraRes.status}`);
  if (!targetRes.ok) throw new Error(`Bank of Canada target rate: HTTP ${targetRes.status}`);
  const corraJson = (await corraRes.json()) as { observations: { d: string; "AVG.INTWO"?: { v: string } }[] };
  const targetJson = (await targetRes.json()) as { observations: { d: string; V39079?: { v: string } }[] };

  const points: MetricPoint[] = [];
  for (const row of corraJson.observations) {
    const v = parseFloat(row["AVG.INTWO"]?.v ?? "");
    if (row.d && !Number.isNaN(v)) points.push({ metric_key: "rate.canada_corra", observed_at: row.d, value: v, unit: "%", source_key: "boc", source_tier: 1, frequency: "daily" });
  }
  for (const row of targetJson.observations) {
    const v = parseFloat(row.V39079?.v ?? "");
    if (row.d && !Number.isNaN(v)) points.push({ metric_key: "rate.canada_target", observed_at: row.d, value: v, unit: "%", source_key: "boc", source_tier: 1, frequency: "daily" });
  }
  return points;
}

/**
 * Euro short-term rate (€STR), ECB Data Portal API — data-api.ecb.europa.eu,
 * free and public with no API key, the successor endpoint to the old SDW
 * web service (same request syntax, per the ECB's own migration notice).
 * €STR vs the ECB Deposit Facility Rate (already tracked as
 * rate.ecb_deposit_facility) is the eurozone's equivalent ample-reserves
 * gauge — under the ECB's floor system €STR normally trades a few bps below
 * the deposit rate.
 */
export async function fetchEcbShortRate(): Promise<MetricPoint[]> {
  const url = "https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.WT?format=csvdata";
  const res = await fetch(url, { headers: commonHeaders, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`ECB €STR: HTTP ${res.status}`);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const dateIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  if (dateIdx < 0 || valueIdx < 0) throw new Error("ECB €STR: unexpected CSV header");

  const points: MetricPoint[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const date = cols[dateIdx];
    const v = parseFloat(cols[valueIdx]);
    if (!date || Number.isNaN(v)) continue;
    points.push({ metric_key: "rate.ecb_estr", observed_at: date, value: v, unit: "%", source_key: "ecb_sdw", source_tier: 1, frequency: "daily" });
  }
  return points;
}

/**
 * Japan's uncollateralized overnight call rate (average), series STRDCLUCON
 * from BOJ's new (Feb 2026) public Time-Series Data Search API — free, no
 * key, official. Japan has no equally clean free daily policy-rate series
 * to pair it with for a spread (BOJ's own "Reserves"/MD07 database doesn't
 * publish a single target-rate time series the way IORB/Bank Rate/Target
 * do), so this is tracked and classified on its own level trend rather than
 * a spread — disclosed as a real difference in kind from the other five
 * central banks, not silently treated the same way.
 */
export async function fetchBojCallRate(): Promise<MetricPoint[]> {
  const url = "https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=FM01&code=STRDCLUCON";
  const res = await fetch(url, { headers: commonHeaders, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`BOJ call rate: HTTP ${res.status}`);
  const json = (await res.json()) as {
    STATUS: number;
    RESULTSET?: { VALUES: { SURVEY_DATES: number[]; VALUES: (number | null)[] } }[];
  };
  if (json.STATUS !== 200 || !json.RESULTSET?.[0]) throw new Error(`BOJ call rate: API status ${json.STATUS}`);

  const { SURVEY_DATES, VALUES } = json.RESULTSET[0].VALUES;
  const points: MetricPoint[] = [];
  for (let i = 0; i < SURVEY_DATES.length; i++) {
    const v = VALUES[i];
    if (v === null || v === undefined) continue;
    const s = String(SURVEY_DATES[i]);
    const isoDate = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    points.push({ metric_key: "rate.japan_call_rate", observed_at: isoDate, value: v, unit: "%", source_key: "boj_stats", source_tier: 1, frequency: "daily" });
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

/**
 * Japan's Ministry of Finance publishes its own daily JGB interest-rate
 * curve (1Y through 40Y, calculated from JSDA reference OTC bond-transaction
 * prices) as two plain CSV files, free, no key, no auth: a full historical
 * archive back to 1974 and a rolling "current month" file that stays a few
 * business days behind live. Replaces the FRED/OECD monthly proxy
 * (IRLTLT01JPM156N, which structurally lagged 2-4 months) that
 * `yield.japan_10y_proxy` used to be — this is now `yield.japan_10y`,
 * matching the direct-source naming already used for Germany/UK/Canada/
 * China, since it's no longer a proxy. A non-browser User-Agent works fine
 * here (verified directly — no bot-mitigation challenge, just a plain
 * static file server); the request was blocked only when using an empty
 * default User-Agent, resolved by sending the same identifying header used
 * for every other source in this file.
 */
const JGB_CURRENT_URL = "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv";
const JGB_HISTORICAL_URL = "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/historical/jgbcme_all.csv";

function parseJgbCsv(csv: string): Map<string, number> {
  const out = new Map<string, number>();
  const lines = csv.trim().split("\n");
  const header = lines[1]?.split(",").map((s) => s.trim());
  const tenIdx = header?.indexOf("10Y") ?? -1;
  if (tenIdx === -1) throw new Error("MOF JGB yields: unexpected CSV header (no 10Y column)");
  for (const line of lines.slice(2)) {
    const cols = line.split(",");
    const dateRaw = cols[0]?.trim();
    const m = dateRaw?.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) continue;
    const v = parseFloat(cols[tenIdx]);
    if (Number.isNaN(v)) continue;
    const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    out.set(iso, v);
  }
  return out;
}

export async function fetchJapanYield10y(): Promise<MetricPoint[]> {
  const [histRes, currentRes] = await Promise.all([
    fetch(JGB_HISTORICAL_URL, { headers: commonHeaders, next: { revalidate: 0 } }),
    fetch(JGB_CURRENT_URL, { headers: commonHeaders, next: { revalidate: 0 } }),
  ]);
  if (!histRes.ok) throw new Error(`MOF JGB yields (historical): HTTP ${histRes.status}`);
  if (!currentRes.ok) throw new Error(`MOF JGB yields (current): HTTP ${currentRes.status}`);

  const merged = new Map<string, number>();
  for (const [date, v] of parseJgbCsv(await histRes.text())) merged.set(date, v);
  for (const [date, v] of parseJgbCsv(await currentRes.text())) merged.set(date, v);

  const points: MetricPoint[] = [];
  for (const [date, value] of merged) {
    points.push({
      metric_key: "yield.japan_10y",
      observed_at: date,
      value,
      unit: "%",
      source_key: "mof_japan",
      source_tier: 1,
      frequency: "daily",
    });
  }
  if (points.length === 0) throw new Error("MOF JGB yields: no data parsed from either file");
  return points;
}
