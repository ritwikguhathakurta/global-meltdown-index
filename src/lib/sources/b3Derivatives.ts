import AdmZip from "adm-zip";
import { Readable } from "node:stream";
import readline from "node:readline";
import type { MetricPoint } from "../metrics/store";

/**
 * B3 (Brazil's stock exchange, formerly BM&FBovespa) daily "COTAHIST" file —
 * free, no key, no login, published same evening for every trading day at:
 *
 *   https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D<ddmmyyyy>.ZIP
 *
 * This is B3's own historical-quotes fixed-width text file, unchanged for
 * decades (layout PDF: HistoricalQuotations_B3.pdf) — verified live
 * (2026-09-22) with real current data. Field offsets below were verified
 * against a real downloaded row (TPMERC, QUATOT and VOLTOT cross-checked for
 * internal consistency: QUATOT * price ≈ VOLTOT) before shipping, not
 * assumed from the spec alone:
 *   TPMERC (market type) at columns 25-27 — "010" cash equity, "070" call
 *   options, "080" put options (other codes: forward/exercise markets, not
 *   used here); QUATOT (quantity traded, plain integer) at columns 153-170;
 *   VOLTOT (turnover, 2 implied decimals) at columns 171-188.
 *
 * IMPORTANT SCOPE NOTE: COTAHIST is a trade/quote history file — it has NO
 * open-interest field. B3's real derivatives open-interest data (for the
 * BM&F-side futures like Ibovespa/USD/DI futures) lives in a separate,
 * legacy settlement system this pass did not locate a free public file for.
 * What IS built here is a genuine, free, current EQUITY OPTIONS market
 * put/call ratio — by traded VOLUME, not open interest — plus whole-market
 * cash-equity turnover, both real signals of options-market positioning and
 * activity, just not the OI-based metric the CFTC/NSE/HKEX connectors use.
 */

const B3_BASE = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist";

function cotahistUrl(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${B3_BASE}/COTAHIST_D${dd}${mm}${yyyy}.ZIP`;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function downloadLatestCotahist(maxLookbackDays = 7): Promise<{ txt: Buffer; observedAt: string } | null> {
  const now = new Date();
  for (let i = 0; i < maxLookbackDays; i++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - i);
    const res = await fetch(cotahistUrl(day), { next: { revalidate: 0 } });
    if (!res.ok) continue;
    const zipBuffer = Buffer.from(await res.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(".txt"));
    if (!entry) continue;
    return { txt: entry.getData(), observedAt: isoDate(day) };
  }
  return null;
}

export async function fetchB3Derivatives(): Promise<MetricPoint[]> {
  const downloaded = await downloadLatestCotahist();
  if (!downloaded) return [];
  const { txt, observedAt } = downloaded;

  let callVolume = 0;
  let putVolume = 0;
  let cashTurnover = 0;

  const rl = readline.createInterface({ input: Readable.from(txt), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.length < 188) continue;
    const tpmerc = line.substring(24, 27);
    const quatot = parseFloat(line.substring(152, 170));
    const voltot = parseFloat(line.substring(170, 188)) / 100; // 2 implied decimals

    if (tpmerc === "070" && Number.isFinite(quatot)) callVolume += quatot;
    else if (tpmerc === "080" && Number.isFinite(quatot)) putVolume += quatot;
    else if (tpmerc === "010" && Number.isFinite(voltot)) cashTurnover += voltot;
  }

  const points: MetricPoint[] = [];
  if (callVolume > 0) {
    points.push({
      metric_key: "derivatives.b3.options.pcr_volume",
      observed_at: observedAt,
      value: putVolume / callVolume,
      unit: "ratio",
      source_key: "b3_derivatives",
      source_tier: 1,
      frequency: "daily",
    });
  }
  if (cashTurnover > 0) {
    points.push({
      metric_key: "derivatives.b3.cash_market_turnover_brl",
      observed_at: observedAt,
      value: cashTurnover,
      unit: "BRL",
      source_key: "b3_derivatives",
      source_tier: 1,
      frequency: "daily",
    });
  }
  return points;
}
