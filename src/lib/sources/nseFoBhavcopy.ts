import AdmZip from "adm-zip";
import { Readable } from "node:stream";
import readline from "node:readline";
import type { MetricPoint } from "../metrics/store";

/**
 * NSE India Futures & Options daily bhavcopy ("UDiFF" format) — free, no
 * key, no login, published same evening for every trading day at:
 *
 *   https://archives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_<YYYYMMDD>_F_0000.csv.zip
 *
 * This supersedes the legacy `archives.nseindia.com/content/historical/DERIVATIVES/...`
 * bhavcopy path, which NSE stopped publishing after ~2024 (verified live:
 * 404s for any 2026 date). The live nseindia.com site itself is heavily
 * bot-protected, but this `archives.` subdomain bulk-download path is not —
 * confirmed live with real, current data (2026-09-22 session), correctly
 * 404ing on non-trading days (weekends/holidays).
 *
 * A prior pass on this project concluded "no verified feasible free
 * connector" exists for India exchange data — that was wrong; this is a
 * genuine correction, not a new gap being filled with an estimate.
 *
 * Every row is one instrument (index/stock future or option, by strike and
 * expiry) for one trading day. We aggregate to: NIFTY/BANKNIFTY futures
 * open interest (a systemic leverage-in-the-system proxy), NIFTY/BANKNIFTY
 * index-options put/call open-interest ratio (a standard positioning
 * sentiment indicator), and whole-market F&O turnover and open interest
 * (a proxy for aggregate derivatives activity/leverage). Values are used
 * exactly as NSE reports them — no currency conversion, no unit
 * reinterpretation beyond documented rupee-crore scaling.
 */

const INDEX_TICKERS = ["NIFTY", "BANKNIFTY"] as const;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

function bhavcopyUrl(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `https://archives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_${yyyy}${mm}${dd}_F_0000.csv.zip`;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function downloadLatestBhavcopy(maxLookbackDays = 7): Promise<{ csv: Buffer; observedAt: string } | null> {
  const now = new Date();
  for (let i = 0; i < maxLookbackDays; i++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - i);
    const url = bhavcopyUrl(day);
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } });
    if (!res.ok) continue;
    const zipBuffer = Buffer.from(await res.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(".csv"));
    if (!entry) continue;
    return { csv: entry.getData(), observedAt: isoDate(day) };
  }
  return null;
}

type Row = {
  fininstrmTp: string;
  tckrSymb: string;
  optnTp: string;
  opnIntrst: number;
  chngInOpnIntrst: number;
  ttlTrfVal: number;
};

function parseRow(fields: string[]): Row | null {
  const opnIntrst = parseFloat(fields[22]);
  const chngInOpnIntrst = parseFloat(fields[23]);
  const ttlTrfVal = parseFloat(fields[25]);
  if (Number.isNaN(opnIntrst) || Number.isNaN(ttlTrfVal)) return null;
  return {
    fininstrmTp: fields[4],
    tckrSymb: fields[7],
    optnTp: fields[12],
    opnIntrst,
    chngInOpnIntrst: Number.isNaN(chngInOpnIntrst) ? 0 : chngInOpnIntrst,
    ttlTrfVal,
  };
}

export async function fetchNseFoBhavcopy(): Promise<MetricPoint[]> {
  const downloaded = await downloadLatestBhavcopy();
  if (!downloaded) return [];
  const { csv, observedAt } = downloaded;

  const perIndex = new Map(
    INDEX_TICKERS.map((t) => [t, { futuresOi: 0, futuresOiChg: 0, callOi: 0, putOi: 0 }])
  );
  let marketTurnover = 0;
  let marketFuturesOi = 0;
  let marketOptionsOi = 0;

  const rl = readline.createInterface({ input: Readable.from(csv), crlfDelay: Infinity });
  let isFirstLine = true;
  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }
    if (!line) continue;
    const fields = line.split(",");
    const row = parseRow(fields);
    if (!row) continue;

    marketTurnover += row.ttlTrfVal;
    if (row.fininstrmTp === "IDF" || row.fininstrmTp === "STF") marketFuturesOi += row.opnIntrst;
    if (row.fininstrmTp === "IDO" || row.fininstrmTp === "STO") marketOptionsOi += row.opnIntrst;

    const bucket = perIndex.get(row.tckrSymb as (typeof INDEX_TICKERS)[number]);
    if (!bucket) continue;
    if (row.fininstrmTp === "IDF") {
      bucket.futuresOi += row.opnIntrst;
      bucket.futuresOiChg += row.chngInOpnIntrst;
    } else if (row.fininstrmTp === "IDO") {
      if (row.optnTp === "CE") bucket.callOi += row.opnIntrst;
      else if (row.optnTp === "PE") bucket.putOi += row.opnIntrst;
    }
  }

  const points: MetricPoint[] = [];
  for (const ticker of INDEX_TICKERS) {
    const b = perIndex.get(ticker)!;
    const slug = ticker.toLowerCase();
    if (b.futuresOi > 0) {
      points.push({
        metric_key: `derivatives.india_fo.${slug}.futures_oi`,
        observed_at: observedAt,
        value: b.futuresOi,
        unit: "contracts",
        source_key: "nse_fo_bhavcopy",
        source_tier: 1,
        frequency: "daily",
      });
      points.push({
        metric_key: `derivatives.india_fo.${slug}.futures_oi_chg`,
        observed_at: observedAt,
        value: b.futuresOiChg,
        unit: "contracts",
        source_key: "nse_fo_bhavcopy",
        source_tier: 1,
        frequency: "daily",
      });
    }
    if (b.callOi > 0) {
      points.push({
        metric_key: `derivatives.india_fo.${slug}.pcr_oi`,
        observed_at: observedAt,
        value: b.putOi / b.callOi,
        unit: "ratio",
        source_key: "nse_fo_bhavcopy",
        source_tier: 1,
        frequency: "daily",
      });
    }
  }

  points.push({
    metric_key: "derivatives.india_fo.market_turnover_cr",
    observed_at: observedAt,
    value: marketTurnover / 1e7, // NSE reports TtlTrfVal in INR; expressed here in INR crore
    unit: "INR crore",
    source_key: "nse_fo_bhavcopy",
    source_tier: 1,
    frequency: "daily",
  });
  points.push({
    metric_key: "derivatives.india_fo.market_futures_oi",
    observed_at: observedAt,
    value: marketFuturesOi,
    unit: "contracts",
    source_key: "nse_fo_bhavcopy",
    source_tier: 1,
    frequency: "daily",
  });
  points.push({
    metric_key: "derivatives.india_fo.market_options_oi",
    observed_at: observedAt,
    value: marketOptionsOi,
    unit: "contracts",
    source_key: "nse_fo_bhavcopy",
    source_tier: 1,
    frequency: "daily",
  });

  return points;
}
