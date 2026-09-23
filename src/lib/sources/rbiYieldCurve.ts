import type { MetricPoint } from "../metrics/store";
import { fetchRbiCurrentListingHtml, fetchRbiArchiveYearHtml, fetchReleaseText, discoverPrids, mapWithConcurrency } from "./rbiArchive";

/**
 * India's sovereign yield curve, short/medium/long, built entirely from
 * RBI's own PRIMARY-MARKET auction results (rbi.org.in press releases) —
 * genuine cut-off yields the government actually borrowed at that week, not
 * a modeled secondary-market curve. CCIL (the Clearing Corporation of
 * India) publishes the standard secondary-market Zero Coupon Yield Curve
 * used industry-wide, but its own Terms of Use explicitly forbid
 * "systematic or automated data collection" (§4.8) and any commercial use
 * of its Content without express written consent (§4.1) — this project
 * does not scrape sources whose own terms forbid it, so CCIL is not used
 * here; see indiaLiquidity.ts for the same call made about the same site.
 *
 * Short end — "91-Day, 182-Day and 364-Day T-Bill Auction Result: Cut-off"
 * (weekly): the three T-Bill cut-off yields are the genuine sub-1-year
 * segment of India's sovereign curve.
 *
 * Medium/long end — "Government Stock - Auction Results: Cut-off": each
 * release auctions one or more dated securities (e.g. "New GS 2031",
 * "7.71% GS 2066"); the security's maturity year minus the release's own
 * year gives its residual tenor at issuance, bucketed here as MEDIUM
 * (residual <= 8y, e.g. 5Y/7Y reissues) or LONG (residual > 8y, e.g.
 * 10Y/14Y/30Y/40Y). When more than one security lands in the same bucket on
 * the same release date, the bucket's yields are averaged rather than both
 * stored under the same (metric_key, date) key, which would otherwise
 * silently let the second overwrite the first.
 *
 * These auctions are irregular by nature — RBI's own borrowing calendar
 * decides which tenor buckets get auctioned each week, not a fixed
 * schedule — so medium/long readings only update on weeks a security in
 * that bucket is actually auctioned. india.gsec_10y (fred.ts,
 * INDIRLTLT01STM, the OECD/FRED-mirrored India 10Y benchmark) is tracked
 * alongside as a continuously-updating (monthly) cross-check for the long
 * end specifically, since it doesn't depend on RBI's auction calendar
 * lining up with a 10Y-ish tenor in any given week.
 */
const TBILL_TITLE = "91-Day, 182-Day and 364-Day T-Bill Auction Result: Cut-off";
const GSEC_TITLE = "Government Stock - Auction Results: Cut-off";
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseAbbrevDate(text: string): string | null {
  const m = text.match(/Date\s*:\s*(\w{3})\w* (\d{1,2}), (\d{4})/);
  if (!m) return null;
  const mi = MONTH_ABBR.indexOf(m[1]);
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

function parseTBillYields(text: string): { d91: number; d182: number; d364: number } | null {
  const m = text.match(
    /Implicit Yield at Cut-Off Price ([\d.]+) \(YTM: ([\d.]+)%\) ([\d.]+) \(YTM: ([\d.]+)%\) ([\d.]+) \(YTM: ([\d.]+)%\)/
  );
  if (!m) return null;
  return { d91: parseFloat(m[2]), d182: parseFloat(m[4]), d364: parseFloat(m[6]) };
}

/**
 * RBI auctions plain dated G-Secs alongside other instrument types on the
 * same release — Sovereign Green Bonds ("X% GOI SGrB YYYY"), floating-rate
 * bonds, and occasionally a devolved-on-PDs security whose yield cell reads
 * "-" instead of a price/yield. An early version of this parser required
 * the ENTIRE security list to consist of plain "GS" tokens to match at all,
 * which meant a single Green Bond mixed in with two ordinary G-Secs on the
 * same day silently discarded all three real yields, not just the one it
 * couldn't classify. Verified directly against a live release (Nov 28,
 * 2025, "5.91% GS 2028 / 6.28% GS 2032 / 7.24% GS 2055 / 6.98% GOI SGrB
 * 2054") that this was losing real data. Fixed by tokenizing the security
 * list and yield list independently (splitting on "ends with a 4-digit
 * year" / "ends with a %"), then classifying each token pair on its own —
 * a security that isn't a plain "GS" token is skipped (not guessed), and if
 * the two token counts don't line up at all (e.g. a devolved security's "-"
 * placeholder collapses two yield cells into one during tokenization) the
 * whole release is skipped rather than risk misaligning a security with
 * the wrong yield.
 */
function parseGsecAuction(text: string, releaseYear: number): { medium: number[]; long: number[] } {
  const medium: number[] = [];
  const long: number[] = [];
  const secMatch = text.match(/Government Stock - Auction Results: Cut-off\s*([\s\S]*?)\s*I\.\s*Notified Amount/);
  const yieldMatch = text.match(/Implicit Yield at cut-off\s*([\s\S]*?)\s*III\.\s*Amount accepted/i);
  if (!secMatch || !yieldMatch) return { medium, long };

  const secTokens = secMatch[1].trim().split(/(?<=\d{4})\s+(?=\S)/).filter(Boolean);
  const yieldTokens = yieldMatch[1].trim().split(/(?<=%)\s+(?=\S)/).filter(Boolean);
  if (secTokens.length === 0 || secTokens.length !== yieldTokens.length) return { medium, long };

  for (let i = 0; i < secTokens.length; i++) {
    const secM = secTokens[i].match(/(?:New GS (\d{4})|([\d.]+)% GS (\d{4}))$/);
    if (!secM) continue; // not a plain dated G-Sec (e.g. a Sovereign Green Bond) — skip, don't guess
    const maturityYear = Number(secM[1] ?? secM[3]);
    const yieldM = yieldTokens[i].match(/(?:[\d.]+\/)?([\d.]+)%$/);
    if (!yieldM) continue;
    const yieldVal = parseFloat(yieldM[1]);
    const tenor = maturityYear - releaseYear;
    if (!Number.isFinite(tenor) || tenor <= 0 || Number.isNaN(yieldVal)) continue;
    (tenor <= 8 ? medium : long).push(yieldVal);
  }
  return { medium, long };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * `onBatch`, if given, is called with the T-Bill points and then (a
 * separate call) the G-Sec points as soon as each finishes, rather than
 * only after both complete — added after a live pipeline run showed this
 * stage's own isolated pre-phase budget (ingest.ts) is sometimes too tight
 * for a full T-Bill-then-G-Sec pass in one go, especially when a multi-year
 * backfill is still needed. Without this, a stage-timeout abandonment
 * (which doesn't cancel this function, just stops waiting for it) meant
 * even genuinely-finished T-Bill data never reached Supabase because the
 * caller's single upsert was gated behind G-Sec finishing too. The caller
 * (ingest.ts) upserts each batch immediately; this function still also
 * returns the full combined array at the end for its own return contract.
 */
export async function fetchIndiaYieldCurveSeries(backfillYears: number[] = [], onBatch?: (points: MetricPoint[]) => Promise<void>): Promise<MetricPoint[]> {
  const currentHtml = await fetchRbiCurrentListingHtml();
  const archiveHtmls = backfillYears.length > 0 ? await mapWithConcurrency(backfillYears, 2, (y) => fetchRbiArchiveYearHtml(y)) : [];
  const allHtml = [currentHtml, ...archiveHtmls];

  const tbillPrids = new Set<string>();
  const gsecPrids = new Set<string>();
  for (const html of allHtml) {
    discoverPrids(html, TBILL_TITLE).forEach((p) => tbillPrids.add(p));
    discoverPrids(html, GSEC_TITLE).forEach((p) => gsecPrids.add(p));
  }
  if (tbillPrids.size === 0 && gsecPrids.size === 0) throw new Error("RBI T-Bill/G-Sec auctions: no releases discovered");

  const tbillRows = await mapWithConcurrency([...tbillPrids], 8, async (prid) => {
    const text = await fetchReleaseText(prid);
    const date = parseAbbrevDate(text);
    const yields = parseTBillYields(text);
    if (!date || !yields) return null;
    return { date, yields };
  });
  const tbillPoints: MetricPoint[] = [];
  for (const r of tbillRows) {
    tbillPoints.push({ metric_key: "india.tbill_91d", observed_at: r.date, value: r.yields.d91, unit: "%", source_key: "rbi_gsec_auctions", source_tier: 1, frequency: "weekly" });
    tbillPoints.push({ metric_key: "india.tbill_364d", observed_at: r.date, value: r.yields.d364, unit: "%", source_key: "rbi_gsec_auctions", source_tier: 1, frequency: "weekly" });
  }
  if (onBatch) await onBatch(tbillPoints);

  const gsecRows = await mapWithConcurrency([...gsecPrids], 8, async (prid) => {
    const text = await fetchReleaseText(prid);
    const date = parseAbbrevDate(text);
    if (!date) return null;
    const { medium, long } = parseGsecAuction(text, Number(date.slice(0, 4)));
    return { date, medium, long };
  });
  const gsecPoints: MetricPoint[] = [];
  for (const r of gsecRows) {
    if (r.medium.length > 0) {
      gsecPoints.push({ metric_key: "india.gsec_medium_yield", observed_at: r.date, value: mean(r.medium), unit: "%", source_key: "rbi_gsec_auctions", source_tier: 1, frequency: "monthly" });
    }
    if (r.long.length > 0) {
      gsecPoints.push({ metric_key: "india.gsec_long_yield", observed_at: r.date, value: mean(r.long), unit: "%", source_key: "rbi_gsec_auctions", source_tier: 1, frequency: "monthly" });
    }
  }
  if (onBatch) await onBatch(gsecPoints);

  const points = [...tbillPoints, ...gsecPoints];
  if (points.length === 0) throw new Error("RBI T-Bill/G-Sec auctions: no data parsed from any release");
  return points;
}
