import type { MetricPoint } from "../metrics/store";
import { fetchRbiCurrentListingHtml, fetchRbiArchiveYearHtml, fetchReleaseText, mapWithConcurrency } from "./rbiArchive";

/**
 * India Liquidity engine's core data: RBI's own daily "Money Market
 * Operations as on <date>" press release — a genuine official release,
 * published on every business day, with the actual numbers inline in the
 * HTML (not just a PDF attachment) at rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx.
 *
 * Two series come out of each release:
 * - "Net liquidity injected (outstanding including today's operations)
 *   [injection (+)/absorption (-)]" — RBI's own headline systemic-liquidity
 *   figure (Repo+MSF+SLF-Reverse Repo-SDF, per the release's own footnote).
 *   This is India's direct analog to the Fed's own H.4.1/RRP-style net
 *   liquidity provision already tracked for the US in globalLiquidity.ts —
 *   a negative value means the banking system has a net surplus RBI is
 *   absorbing (ample liquidity); a positive value means RBI is net
 *   injecting (a liquidity deficit).
 * - The Call Money segment's Weighted Average Rate — India's overnight
 *   interbank rate (WACR), the direct analog to the Fed's EFFR/SOFR.
 *
 * Note what this project deliberately did NOT use: the PDF-attached
 * "Weekly Statistical Supplement – Extract" release, whose actual PDF is
 * served from rbidocs.rbi.org.in behind an Imperva/TSPD bot-mitigation JS
 * challenge (verified: the "PDF" response is an HTML challenge page, not a
 * PDF) — this project does not solve bot challenges to reach blocked
 * content. www.rbi.org.in itself (where these press-release pages live) is
 * not behind that block, which is why this connector targets that instead.
 * Nor does it use CCIL (the Clearing Corporation of India), which would
 * otherwise be the natural source for a full secondary-market India debt
 * market picture: CCIL's own Terms of Use explicitly bar "systematic or
 * automated data collection" (§4.8) and any commercial use of its Content
 * without express written consent (§4.1) — this project does not scrape
 * sources whose own terms forbid it, the same principle applied to the bot
 * challenge above.
 *
 * Day-to-day ingestion re-reads the default listing (a rolling few weeks)
 * and re-upserts (idempotent). A one-time deeper backfill (see
 * fetchIndiaLiquidityBackfill) additionally pulls full prior calendar years
 * via RBI's own year/month archive (rbiArchive.ts) so this series has real,
 * multi-year daily history — enough to see more than one Diwali/fiscal
 * year-end liquidity cycle for the seasonal analysis in indiaSeasonality.ts,
 * rather than only the few weeks the default listing shows.
 */
const MMO_TITLE_RE = /href=BS_PressReleaseDisplay\.aspx\?prid=(\d+)>Money Market Operations as on ([^<]+)</g;

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function parseReleaseDate(s: string): string | null {
  const m = s.trim().match(/^(\w+) (\d{1,2}), (\d{4})$/);
  if (!m) return null;
  const mi = MONTH_NAMES.indexOf(m[1]);
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

function parseNetLiquidity(text: string): number | null {
  const m = text.match(/Net liquidity injected \(outstanding including today's operations\)\s*\[injection \(\+\)\/absorption \(-\)\]\*?\s*(-?[\d,]+\.?\d*)/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ""));
  return Number.isNaN(v) ? null : v;
}

function parseWacr(text: string): number | null {
  const m = text.match(/Call Money\s+[\d,]+\.\d+\s+([\d.]+)\s+[\d.]+-[\d.]+/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isNaN(v) ? null : v;
}

function discoverReleasesFromHtml(html: string): { prid: string; date: string }[] {
  const seen = new Map<string, string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MMO_TITLE_RE);
  while ((m = re.exec(html))) {
    const date = parseReleaseDate(m[2]);
    if (date) seen.set(m[1], date);
  }
  return [...seen.entries()].map(([prid, date]) => ({ prid, date }));
}

async function pointsFromReleases(releases: { prid: string; date: string }[]): Promise<MetricPoint[]> {
  const rows = await mapWithConcurrency(releases, 8, async ({ prid, date }) => {
    const text = await fetchReleaseText(prid);
    const netLiquidity = parseNetLiquidity(text);
    const wacr = parseWacr(text);
    if (netLiquidity === null && wacr === null) return null;
    return { date, netLiquidity, wacr };
  });

  const points: MetricPoint[] = [];
  for (const r of rows) {
    if (r.netLiquidity !== null) {
      points.push({
        metric_key: "india.rbi_net_liquidity",
        observed_at: r.date,
        value: r.netLiquidity,
        unit: "INR crore",
        source_key: "rbi_liquidity",
        source_tier: 1,
        frequency: "daily",
      });
    }
    if (r.wacr !== null) {
      points.push({
        metric_key: "india.wacr",
        observed_at: r.date,
        value: r.wacr,
        unit: "%",
        source_key: "rbi_liquidity",
        source_tier: 1,
        frequency: "daily",
      });
    }
  }
  return points;
}

export async function fetchIndiaLiquiditySeries(): Promise<MetricPoint[]> {
  const html = await fetchRbiCurrentListingHtml();
  const releases = discoverReleasesFromHtml(html);
  if (releases.length === 0) throw new Error("RBI Money Market Operations: no releases discovered");
  const points = await pointsFromReleases(releases);
  if (points.length === 0) throw new Error("RBI Money Market Operations: no data parsed from any release");
  return points;
}

/** One-time-per-need deep backfill across full prior calendar years, via RBI's own year/month archive. */
export async function fetchIndiaLiquidityBackfill(years: number[]): Promise<MetricPoint[]> {
  const yearHtmls = await mapWithConcurrency(years, 2, (y) => fetchRbiArchiveYearHtml(y));
  const releases = new Map<string, string>();
  for (const html of yearHtmls) {
    for (const { prid, date } of discoverReleasesFromHtml(html)) releases.set(prid, date);
  }
  if (releases.size === 0) return [];
  return pointsFromReleases([...releases.entries()].map(([prid, date]) => ({ prid, date })));
}
