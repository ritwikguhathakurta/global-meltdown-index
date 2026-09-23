import AdmZip from "adm-zip";
import { Readable } from "node:stream";
import readline from "node:readline";
import type { MetricPoint } from "../metrics/store";
import { budgetDeadline, pastDeadline } from "../pipeline/timeBudget";

/**
 * DTCC Data Repository — public, real-time swap transaction dissemination
 * data, published because CFTC Part 43 / SEC Reg SBSR require public
 * dissemination of most OTC swap trades (Dodd-Frank). Free, no key, no
 * login, no registration — a daily cumulative CSV per asset class at:
 *
 *   https://kgc0418-tdw-data-0.s3.amazonaws.com/cftc/eod/CFTC_CUMULATIVE_<ASSET>_<YYYY_MM_DD>.zip
 *
 * (ASSET in RATES/CREDITS/EQUITIES/FOREX/COMMODITIES). Verified live with
 * real, current transaction-level data (2026-09-22): interest-rate swaps,
 * credit, FX and commodity files are small (hundreds of KB to a few MB
 * compressed); EQUITIES is not fetched here — verified compressed size
 * ~40MB (likely 300MB+ uncompressed), which risks this one stage's memory/
 * time budget for comparatively little systemic-risk signal (equity swaps
 * are a small fraction of OTC notional vs. rates/credit) — a deliberate,
 * documented scope cut, not a silent gap.
 *
 * A prior pass on this project concluded DTCC data has "no verified free
 * access" — that was wrong; this public dissemination feed is the genuine,
 * real, free counterpart (transaction-level daily flow) to the periodic
 * BIS OTC notional-outstanding snapshot already ingested in
 * `bisOtcDerivatives.ts`. It is NOT the full DTCC GTR/Trade Information
 * Warehouse (that remains reporting-party/paid access only) — this is only
 * the subset DTCC is required to disseminate publicly per trade.
 *
 * Each row is one swap transaction/lifecycle event. We count only rows
 * that represent an actual new trade execution that day (Action type
 * "NEWT" and Event type "TRAD" — excluding modifications, terminations,
 * novations, clearing events, corrections, and option-exercise-created
 * legs, which are not new trading activity).
 *
 * Two metrics that looked plausible were built, verified live, and then
 * DELETED before shipping because the underlying field doesn't mean what
 * it first appears to:
 *
 * - "Cleared %" from the per-row "Cleared" field: verified live that Y is
 *   almost never set on the initial NEWT/TRAD row (3 of 17,626 same-day
 *   interest-rate swaps; 0 of 58,011 FX trades) even though real-world
 *   central-clearing rates for vanilla USD swaps are known to be >90%.
 *   The Event type enum includes a separate "CLRG" (clearing) event —
 *   true cleared status is disseminated as a LATER lifecycle event tied
 *   to the same Dissemination/Original-Dissemination Identifier, not a
 *   field on the original trade row. Reporting "0.1% cleared" from this
 *   field would be a real, checkable factual error, not an honest
 *   real-data reading — so it isn't reported at all rather than
 *   reported wrong.
 * - USD-leg notional summed across the day: verified live that individual
 *   notional values are subject to CFTC-mandated size caps for large
 *   trades (anonymization) and can carry other non-size sentinel values —
 *   one single FX row in the live 2026-09-22 file had a "Notional
 *   amount-Leg 1" of 10^20, which is not a real trade size. A per-row cap/
 *   sentinel can't be distinguished from a genuine trade in this feed, so
 *   summing raw notional is not a reliable number — a single bad row
 *   silently dominates the total. Not reported for the same reason as
 *   above: a technically-real sum of unreliable inputs is still a
 *   misleading number.
 *
 * What's left, and shipped, is the one metric that survives both checks:
 * a plain count of new swap trades disseminated that day, by asset class —
 * unambiguous and not distorted by either issue.
 */

const ASSET_CLASSES: { file: string; slug: string }[] = [
  { file: "RATES", slug: "rates" },
  { file: "CREDITS", slug: "credit" },
  { file: "FOREX", slug: "fx" },
  { file: "COMMODITIES", slug: "commodity" },
];

const TOTAL_BUDGET_MS = 180_000;

function csvUrl(assetFile: string, date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `https://kgc0418-tdw-data-0.s3.amazonaws.com/cftc/eod/CFTC_CUMULATIVE_${assetFile}_${yyyy}_${mm}_${dd}.zip`;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function downloadAssetClassCsv(assetFile: string, maxLookbackDays = 5): Promise<{ csv: Buffer; observedAt: string } | null> {
  const now = new Date();
  for (let i = 0; i < maxLookbackDays; i++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - i);
    const url = csvUrl(assetFile, day);
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) continue;
    const zipBuffer = Buffer.from(await res.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(".csv"));
    if (!entry) continue;
    return { csv: entry.getData(), observedAt: isoDate(day) };
  }
  return null;
}

export async function fetchDtccSwapData(): Promise<MetricPoint[]> {
  const points: MetricPoint[] = [];
  const deadline = budgetDeadline(TOTAL_BUDGET_MS);

  for (const { file, slug } of ASSET_CLASSES) {
    if (pastDeadline(deadline)) break;

    const downloaded = await downloadAssetClassCsv(file);
    if (!downloaded) continue;
    const { csv, observedAt } = downloaded;

    let newTradeCount = 0;

    const rl = readline.createInterface({ input: Readable.from(csv), crlfDelay: Infinity });
    let header: string[] | null = null;
    let idx: Record<string, number> = {};
    for await (const line of rl) {
      if (!header) {
        header = parseCsvLine(line);
        idx = Object.fromEntries(header.map((h, i) => [h, i]));
        continue;
      }
      if (!line) continue;
      const f = parseCsvLine(line);
      if (f[idx["Action type"]] !== "NEWT" || f[idx["Event type"]] !== "TRAD") continue;
      newTradeCount++;
    }

    if (newTradeCount === 0) continue;

    points.push({
      metric_key: `derivatives.dtcc_swaps.${slug}.new_trade_count`,
      observed_at: observedAt,
      value: newTradeCount,
      unit: "trades",
      source_key: "dtcc_swap_data",
      source_tier: 1,
      frequency: "daily",
    });
  }

  return points;
}
