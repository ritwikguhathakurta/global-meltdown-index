import type { MetricPoint } from "../metrics/store";

/**
 * ICE Futures Europe "Commitments of Traders" — free, public CSV, one file per year, published
 * weekly (positions as of Tuesday), in the same disaggregated layout as the CFTC's own report:
 *
 *   https://www.ice.com/publicdocs/futures/COTHist<YYYY>.csv
 *
 * Verified live (2026-09-25): real Managed Money long/short and total open interest for ICE
 * Brent, Gasoil, Robusta coffee, cocoa, white sugar and London wheat — the non-US half of the
 * positioning picture that cftcCot.ts (US contracts only) can't see. The "Futures and Options"
 * combined rows are used (matching how this project's CFTC connector reads combined COT).
 *
 * Metrics per market: managed-money net position (contracts) and that as a percentage of open
 * interest — the same two quantities cftcCot.ts writes for its own markets.
 */
const BASE = "https://www.ice.com/publicdocs/futures";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0)" };

const MARKETS: { match: string; slug: string }[] = [
  { match: "ICE Brent Crude Futures and Options", slug: "ice_brent" },
  { match: "ICE Gasoil Futures and Options", slug: "ice_gasoil" },
  { match: "ICE Robusta Coffee Futures and Options", slug: "ice_robusta" },
  { match: "ICE Cocoa Futures and Options", slug: "ice_cocoa" },
  { match: "ICE White Sugar Futures and Options", slug: "ice_white_sugar" },
  { match: "ICE Wheat Futures and Options", slug: "ice_london_wheat" },
];

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

async function fetchYear(year: number): Promise<string[]> {
  const res = await fetch(`${BASE}/COTHist${year}.csv`, { headers: HEADERS, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`ICE COT ${year}: HTTP ${res.status}`);
  return (await res.text()).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
}

export async function fetchIceFuturesEuropeCot(): Promise<MetricPoint[]> {
  const thisYear = new Date().getUTCFullYear();
  const points: MetricPoint[] = [];
  for (const year of [thisYear - 1, thisYear]) {
    let lines: string[];
    try {
      lines = await fetchYear(year);
    } catch (e) {
      if (year === thisYear) throw e;
      continue;
    }
    const header = splitCsvLine(lines[0]).map((h) => h.trim());
    const col = (n: string) => header.indexOf(n);
    const iName = col("Market_and_Exchange_Names");
    const iDate = col("As_of_Date_Form_MM/DD/YYYY");
    const iOi = col("Open_Interest_All");
    const iLong = col("M_Money_Positions_Long_All");
    const iShort = col("M_Money_Positions_Short_All");
    if ([iName, iDate, iOi, iLong, iShort].some((i) => i < 0)) throw new Error("ICE COT: unexpected CSV header");

    for (const line of lines.slice(1)) {
      const f = splitCsvLine(line);
      const market = MARKETS.find((m) => f[iName]?.trim().startsWith(m.match));
      if (!market) continue;
      const dm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(f[iDate]?.trim() ?? "");
      const oi = parseFloat(f[iOi]);
      const net = parseFloat(f[iLong]) - parseFloat(f[iShort]);
      if (!dm || !Number.isFinite(oi) || oi <= 0 || !Number.isFinite(net)) continue;
      const observed_at = `${dm[3]}-${dm[1]}-${dm[2]}`;
      const base = { observed_at, source_key: "ice_futures_europe_cot", source_tier: 1 as const, frequency: "weekly" as const };
      points.push({ ...base, metric_key: `cot.${market.slug}.managed_money_net`, value: net, unit: "contracts" });
      points.push({ ...base, metric_key: `cot.${market.slug}.managed_money_net_pct_oi`, value: (net / oi) * 100, unit: "% of OI" });
    }
  }
  if (points.length === 0) throw new Error("ICE Futures Europe COT: no usable rows");
  return points;
}
