import type { MetricPoint } from "../metrics/store";

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
 *
 * No deep pagination/backfill is needed here (unlike govCnStatistics.ts):
 * RBI's default press-release listing already shows several weeks of daily
 * releases mixed in with everything else, which is refetched and
 * re-upserted (idempotent) on every ingest run — history simply accumulates
 * day by day in the database.
 */
const LISTING_URL = "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx";
const HEADERS = { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" };

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function parseReleaseDate(s: string): string | null {
  const m = s.trim().match(/^(\w+) (\d{1,2}), (\d{4})$/);
  if (!m) return null;
  const mi = MONTH_NAMES.indexOf(m[1]);
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

async function discoverReleases(): Promise<{ prid: string; date: string }[]> {
  const res = await fetch(LISTING_URL, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`RBI press release listing: HTTP ${res.status}`);
  const html = await res.text();
  const re = /href=BS_PressReleaseDisplay\.aspx\?prid=(\d+)>Money Market Operations as on ([^<]+)</g;
  const seen = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const date = parseReleaseDate(m[2]);
    if (date) seen.set(m[1], date);
  }
  return [...seen.entries()].map(([prid, date]) => ({ prid, date }));
}

export async function fetchIndiaLiquiditySeries(): Promise<MetricPoint[]> {
  const releases = await discoverReleases();
  if (releases.length === 0) throw new Error("RBI Money Market Operations: no releases discovered");

  const points: MetricPoint[] = [];
  for (const { prid, date } of releases) {
    let text: string;
    try {
      const res = await fetch(`${LISTING_URL}?prid=${prid}`, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      text = stripHtml(await res.text());
    } catch {
      continue;
    }

    const netLiquidity = parseNetLiquidity(text);
    if (netLiquidity !== null) {
      points.push({
        metric_key: "india.rbi_net_liquidity",
        observed_at: date,
        value: netLiquidity,
        unit: "INR crore",
        source_key: "rbi_liquidity",
        source_tier: 1,
        frequency: "daily",
      });
    }

    const wacr = parseWacr(text);
    if (wacr !== null) {
      points.push({
        metric_key: "india.wacr",
        observed_at: date,
        value: wacr,
        unit: "%",
        source_key: "rbi_liquidity",
        source_tier: 1,
        frequency: "daily",
      });
    }
  }
  if (points.length === 0) throw new Error("RBI Money Market Operations: no data parsed from any release");
  return points;
}
