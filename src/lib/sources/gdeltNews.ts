/**
 * Real, live world headlines via GDELT's DOC 2.0 API — free, public, no API
 * key, no self-hosting. GDELT (gdeltproject.org) has indexed worldwide
 * broadcast/print/web news since 2015; this is the same underlying source
 * koala73/worldmonitor itself wraps for its "positive events" feature (see
 * its OpenAPI spec, ListPositiveGeoEvents), but worldmonitor's own API is a
 * paid ($39.99/mo) wrapper around sources like this one — calling GDELT
 * directly gets the real data for free instead.
 *
 * Regions below are a plain keyword grouping for readability, NOT GDELT's
 * own classification or an authoritative geopolitical taxonomy — disclosed
 * as such on the page. Deliberately avoids GDELT's `sourcecountry:` field
 * filter (which uses a FIPS-style code list this app hasn't verified live)
 * in favor of plain-English place names, so there's no coded-taxonomy risk
 * to get wrong.
 *
 * Field names (url, url_mobile, title, seendate, socialimage, domain,
 * language, sourcecountry) and query parameters (query, mode, format, sort,
 * timespan, maxrecords) verified against GDELT's own blog documentation
 * (blog.gdeltproject.org/gdelt-doc-2-0-api-debuts) and an independent
 * open-source client (github.com/alex9smith/gdelt-doc-api), since this
 * sandbox's shared network egress was itself rate-limited by GDELT
 * ("Please limit requests to one every 5 seconds...") during development,
 * making live verification from here unreliable — production traffic runs
 * from Vercel's own IPs instead.
 */

export type GdeltArticle = {
  title: string;
  url: string;
  seenAt: string; // ISO 8601, parsed from GDELT's YYYYMMDDHHMMSS
  domain: string;
  sourceCountry: string;
  language: string;
  imageUrl: string | null;
};

export type WorldNewsRegion = {
  slug: string;
  label: string;
  /** GDELT boolean query — plain keywords only, no coded field filters. */
  query: string;
};

export const WORLD_NEWS_REGIONS: WorldNewsRegion[] = [
  {
    slug: "middle_east",
    label: "Middle East & North Africa",
    query: '(Israel OR Gaza OR Iran OR Syria OR Lebanon OR "Saudi Arabia" OR Egypt OR Yemen)',
  },
  {
    slug: "europe",
    label: "Europe",
    query: '(Ukraine OR Russia OR NATO OR "European Union" OR Germany OR France OR Poland OR "United Kingdom")',
  },
  {
    slug: "asia_pacific",
    label: "Asia-Pacific",
    query: '(China OR Taiwan OR Japan OR Korea OR India OR Pakistan OR Philippines OR Australia)',
  },
  {
    slug: "americas",
    label: "Americas",
    query: '("United States" OR Mexico OR Brazil OR Venezuela OR Canada OR Argentina)',
  },
  {
    slug: "africa",
    label: "Africa",
    query: '(Nigeria OR Sudan OR Ethiopia OR Congo OR "South Africa" OR Mali OR Kenya)',
  },
  {
    slug: "global_economy",
    label: "Global Economy & Markets",
    query: '(inflation OR "central bank" OR tariffs OR recession OR "trade war" OR OPEC)',
  },
];

const GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc";
const ARTICLES_PER_REGION = 8;
const TIMESPAN = "2d";
// GDELT's own throttle message asks for at least 5s between requests from a
// given client; this app fetches regions sequentially (never in parallel)
// with margin above that, and Next.js's fetch cache (revalidate below) means
// most page views hit the cache rather than GDELT at all.
const INTER_REQUEST_DELAY_MS = 1500;
const REVALIDATE_SECONDS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSeenDate(raw: string): string {
  if (!/^\d{14}$/.test(raw)) return "";
  const y = raw.slice(0, 4);
  const mo = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const h = raw.slice(8, 10);
  const mi = raw.slice(10, 12);
  const s = raw.slice(12, 14);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

type RawArticle = {
  title?: string;
  url?: string;
  seendate?: string;
  domain?: string;
  sourcecountry?: string;
  language?: string;
  socialimage?: string;
};

export type WorldNewsRegionResult = {
  region: WorldNewsRegion;
  articles: GdeltArticle[];
  error?: string;
};

async function fetchRegionArticles(region: WorldNewsRegion): Promise<WorldNewsRegionResult> {
  const params = new URLSearchParams({
    query: `${region.query} sourcelang:english`,
    mode: "ArtList",
    format: "json",
    sort: "DateDesc",
    timespan: TIMESPAN,
    maxrecords: String(ARTICLES_PER_REGION),
  });

  try {
    const res = await fetch(`${GDELT_BASE}?${params.toString()}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": "GlobalMeltdownIndex/1.0 (+https://globalmeltdownindex.net)" },
    });
    const text = await res.text();

    if (!res.ok) {
      return { region, articles: [], error: `HTTP ${res.status}` };
    }

    let parsed: { articles?: RawArticle[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      // GDELT returns a plain-text throttle/error notice (not JSON) when
      // rate-limited or otherwise rejecting the request.
      return { region, articles: [], error: text.trim().slice(0, 160) || "non-JSON response" };
    }

    const articles: GdeltArticle[] = (parsed.articles ?? [])
      .map((a) => ({
        title: a.title ?? "",
        url: a.url ?? "",
        seenAt: a.seendate ? parseSeenDate(a.seendate) : "",
        domain: a.domain ?? "",
        sourceCountry: a.sourcecountry ?? "",
        language: a.language ?? "",
        imageUrl: a.socialimage || null,
      }))
      .filter((a) => a.title && a.url);

    return { region, articles };
  } catch (e) {
    return { region, articles: [], error: (e as Error).message };
  }
}

/**
 * Fetches all regions SEQUENTIALLY with a delay between calls — GDELT's own
 * throttle message asks for this, and doing it in parallel from a shared
 * hosting IP is exactly what triggers it.
 */
export async function fetchWorldNews(): Promise<WorldNewsRegionResult[]> {
  const results: WorldNewsRegionResult[] = [];
  for (let i = 0; i < WORLD_NEWS_REGIONS.length; i++) {
    results.push(await fetchRegionArticles(WORLD_NEWS_REGIONS[i]));
    if (i < WORLD_NEWS_REGIONS.length - 1) await delay(INTER_REQUEST_DELAY_MS);
  }
  return results;
}
