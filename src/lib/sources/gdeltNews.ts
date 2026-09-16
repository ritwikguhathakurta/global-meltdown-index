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
 * to get wrong. Also avoids `sourcelang:english` — live-tested and found to
 * zero out results even for broad, heavily-covered terms, so it's dropped
 * rather than shipped as a silent "no coverage" bug.
 *
 * IMPORTANT architecture note: this makes exactly ONE GDELT request per page
 * load (cached), not one per region. An earlier version issued one request
 * per region — first fully sequential (worst case 40s+, tripping Vercel's
 * function timeout), then staggered-but-concurrent (which instead fired six
 * requests within a ~6s window and got every single one throttled/timed out
 * by GDELT, worse than the sequential version). GDELT's throttling turned
 * out to react to REQUEST COUNT in a short window, not just raw concurrency,
 * so the fix is to only ever send one request: fetch a broad set of recent
 * articles matching ANY region's keywords in one combined OR query, then
 * classify each returned article into a region client-side by keyword
 * match against its title. This is also just a better fit for a free public
 * API meant to be called politely.
 *
 * Field names (url, url_mobile, title, seendate, socialimage, domain,
 * language, sourcecountry) and query parameters (query, mode, format, sort,
 * timespan, maxrecords) verified against GDELT's own blog documentation
 * (blog.gdeltproject.org/gdelt-doc-2-0-api-debuts) and an independent
 * open-source client (github.com/alex9smith/gdelt-doc-api), since this
 * sandbox's shared network egress was itself rate-limited by GDELT
 * ("Please limit requests to one every 5 seconds...") throughout
 * development, making live verification from here unreliable.
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
  /** Plain keywords (no quotes/booleans) used to classify articles into this region by title match. */
  keywords: string[];
};

export const WORLD_NEWS_REGIONS: WorldNewsRegion[] = [
  {
    slug: "middle_east",
    label: "Middle East & North Africa",
    keywords: ["Israel", "Gaza", "Iran", "Syria", "Lebanon", "Saudi Arabia", "Egypt", "Yemen"],
  },
  {
    slug: "europe",
    label: "Europe",
    keywords: ["Ukraine", "Russia", "NATO", "European Union", "Germany", "France", "Poland", "United Kingdom"],
  },
  {
    slug: "asia_pacific",
    label: "Asia-Pacific",
    keywords: ["China", "Taiwan", "Japan", "Korea", "India", "Pakistan", "Philippines", "Australia"],
  },
  {
    slug: "americas",
    label: "Americas",
    keywords: ["United States", "Mexico", "Brazil", "Venezuela", "Canada", "Argentina"],
  },
  {
    slug: "africa",
    label: "Africa",
    keywords: ["Nigeria", "Sudan", "Ethiopia", "Congo", "South Africa", "Mali", "Kenya"],
  },
  {
    slug: "global_economy",
    label: "Global Economy & Markets",
    keywords: ["inflation", "central bank", "tariffs", "recession", "trade war", "OPEC"],
  },
];

const GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc";
const TOTAL_ARTICLES = 100;
const ARTICLES_PER_REGION_CAP = 8;
const TIMESPAN = "2d";
const REVALIDATE_SECONDS = 600;
// A single call is far more forgiving than the multi-call versions this
// replaced, but GDELT can still be slow under its own load — generous but
// bounded so a hung request doesn't run out the clock silently.
const REQUEST_TIMEOUT_MS = 15000;

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
};

export type WorldNewsResult = {
  regions: WorldNewsRegionResult[];
  error?: string;
};

function buildCombinedQuery(): string {
  const allKeywords = WORLD_NEWS_REGIONS.flatMap((r) => r.keywords);
  const terms = allKeywords.map((k) => (k.includes(" ") ? `"${k}"` : k));
  return `(${terms.join(" OR ")})`;
}

/**
 * Fetches ONE combined batch of recent articles (any region's keywords),
 * then classifies each into every region whose keyword appears in its
 * title — an article can legitimately appear under more than one region
 * (e.g. a US-China trade story), and any article matching none of the
 * keywords (shouldn't happen given the query itself, but defensively
 * handled) is simply dropped rather than mis-bucketed.
 */
export async function fetchWorldNews(): Promise<WorldNewsResult> {
  const params = new URLSearchParams({
    query: buildCombinedQuery(),
    mode: "ArtList",
    format: "json",
    sort: "DateDesc",
    timespan: TIMESPAN,
    maxrecords: String(TOTAL_ARTICLES),
  });

  const emptyRegions = WORLD_NEWS_REGIONS.map((region) => ({ region, articles: [] as GdeltArticle[] }));

  let text: string;
  try {
    const res = await fetch(`${GDELT_BASE}?${params.toString()}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": "GlobalMeltdownIndex/1.0 (+https://globalmeltdownindex.net)" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    text = await res.text();
    if (!res.ok) {
      return { regions: emptyRegions, error: `HTTP ${res.status}` };
    }
  } catch (e) {
    return { regions: emptyRegions, error: (e as Error).message };
  }

  let parsed: { articles?: RawArticle[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    // GDELT returns a plain-text throttle/error notice (not JSON) when
    // rate-limited or otherwise rejecting the request.
    return { regions: emptyRegions, error: text.trim().slice(0, 160) || "non-JSON response" };
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

  const regions: WorldNewsRegionResult[] = WORLD_NEWS_REGIONS.map((region) => {
    const lowerKeywords = region.keywords.map((k) => k.toLowerCase());
    const matched = articles
      .filter((a) => {
        const title = a.title.toLowerCase();
        return lowerKeywords.some((k) => title.includes(k));
      })
      .slice(0, ARTICLES_PER_REGION_CAP);
    return { region, articles: matched };
  });

  return { regions };
}
