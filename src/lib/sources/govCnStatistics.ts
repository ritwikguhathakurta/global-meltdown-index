import type { MetricPoint } from "../metrics/store";

/**
 * China Property Sales (transaction volume) and China PMI New Orders —
 * both of these are genuine NBS (National Bureau of Statistics of China)
 * releases and both are described in exact prose form, in English, in the
 * State Council's own English-language news portal (english.www.gov.cn),
 * which syndicates NBS's monthly statistical press releases.
 *
 * This exists as a *separate* domain from stats.gov.cn on purpose: NBS's
 * own site (stats.gov.cn, including its data-query API at
 * data.stats.gov.cn) actively blocks non-browser clients — verified as a
 * deliberate block (a WAF 403 with an explicit "UrlACL" reason on the data
 * API, and a deterministic TLS-level ECONNRESET on the press-release pages
 * for any Node HTTP client, reproduced with both `fetch` and the raw
 * `https` module, while `curl` from the same network succeeds). Working
 * around that would mean TLS-fingerprint spoofing or a similar anti-bot
 * evasion technique, which this project does not do. english.www.gov.cn
 * carries the same NBS content but is not behind that block, so it's used
 * instead — this is using an open, reachable government publication, not
 * circumventing a control.
 *
 * Both releases are highly templated (same NBS press office, same phrasing
 * every month), which is what makes prose-regex parsing viable — the same
 * approach already used for SEC EDGAR XBRL tag selection and de-cumulation
 * elsewhere in this codebase, applied here to English prose instead of XBRL
 * facts. A month whose phrasing doesn't match simply yields no point for
 * that month (never a guessed value) — freshness/z-score handle sparse
 * series the same way they handle any other partial history.
 *
 * Property sales ("floor space of newly-built commercial buildings sold")
 * is published as a YEAR-TO-DATE cumulative figure each month (NBS's
 * standard convention, driven by Jan/Feb being combined around Lunar New
 * Year) — de-cumulated into discrete flow values the same way SEC EDGAR's
 * YTD cash-flow figures are de-cumulated in secEdgar.ts: group by calendar
 * year, sort by period-end month, take successive differences. The first
 * period of each year ("the first two months") has no prior point to
 * subtract, so it stands as-is (a genuine two-month combined figure, not an
 * error). If a month's release is ever missed, the next available point is
 * simply a longer-than-one-month flow rather than a fabricated single month
 * — flagged nowhere specially, but visible to anyone reading the raw series.
 *
 * PMI New Orders is a monthly point-in-time index value (not cumulative),
 * so no de-cumulation is needed there.
 */

const LISTING_BASE = "https://english.www.gov.cn/archive/statistics";
const HEADERS = { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" };

export const GOV_CN_BACKFILL_PAGE_LIMIT = 200; // ~3+ years of listings at this archive's observed density
export const GOV_CN_APPEND_PAGE_LIMIT = 4; // a few weeks of listings — enough to catch the latest monthly release
export const MIN_GOV_CN_OBSERVATIONS = 18;
const TARGET_MATCHES_PER_KIND = 40;
const CONCURRENCY = 8;

type Article = { url: string; title: string; year: number };

const PMI_TITLE_RE = /(?<!non-)manufacturing pmi/i;
const PROPERTY_TITLE_RE = /national economy/i;

const PERIOD_WORD_TO_MONTH: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
};

function parsePeriodEndMonth(openingText: string): number | null {
  if (/in the first quarter/i.test(openingText)) return 3;
  if (/in the first half.?year/i.test(openingText)) return 6;
  if (/in the first three quarters/i.test(openingText)) return 9;
  const m = openingText.match(/in the first (two|three|four|five|six|seven|eight|nine|ten|eleven) months/i);
  return m ? PERIOD_WORD_TO_MONTH[m[1].toLowerCase()] : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (e) {
        results[i] = { status: "rejected", reason: e };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchListingPage(pageNum: number): Promise<Article[]> {
  const url = pageNum <= 1 ? `${LISTING_BASE}/` : `${LISTING_BASE}/page_${pageNum}.html`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const re = /href="\/\/english\.www\.gov\.cn(\/archive\/statistics\/(\d{4})\d{2}\/\d{2}\/content_[^"]+\.html)"[^>]*>([^<]{5,200})</g;
  const articles: Article[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    articles.push({ url: `https://english.www.gov.cn${m[1]}`, year: Number(m[2]), title: m[3].trim() });
  }
  return articles;
}

async function discoverArticles(pageLimit: number): Promise<{ pmi: Article[]; property: Article[] }> {
  const pmi: Article[] = [];
  const property: Article[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= pageLimit; page++) {
    let items: Article[];
    try {
      items = await fetchListingPage(page);
    } catch {
      continue;
    }
    if (items.length === 0) break;
    for (const a of items) {
      if (seen.has(a.url)) continue;
      seen.add(a.url);
      if (PMI_TITLE_RE.test(a.title)) pmi.push(a);
      else if (PROPERTY_TITLE_RE.test(a.title)) property.push(a);
    }
    if (pmi.length >= TARGET_MATCHES_PER_KIND && property.length >= TARGET_MATCHES_PER_KIND) break;
  }
  return { pmi, property };
}

function parsePmiNewOrders(text: string): number | null {
  const dual = text.match(/production sub-index and new orders index (?:climbed|rose|fell|dropped|declined|edged up|edged down|increased|decreased) (?:to|at) ([\d.]+) and ([\d.]+)/i);
  if (dual) return parseFloat(dual[2]);
  const single = text.match(/new orders index (?:climbed|rose|fell|dropped|declined|edged up|edged down|increased|decreased|stood|came in) (?:to|at) ([\d.]+)/i);
  if (single) return parseFloat(single[1]);
  const subIndex = text.match(/sub-index for new orders (?:came in at|stood at|was) ([\d.]+)/i);
  if (subIndex) return parseFloat(subIndex[1]);
  return null;
}

function parsePropertyFloorSpaceYtd(text: string): number | null {
  const m = text.match(/floor space of newly-built commercial buildings sold was ([\d,.]+) million square meters/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ""));
  return Number.isNaN(v) ? null : v;
}

async function fetchPmiPoints(articles: Article[]): Promise<MetricPoint[]> {
  const results = await mapWithConcurrency(articles, CONCURRENCY, async (a) => {
    const res = await fetch(a.url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = stripHtml(await res.text());
    const value = parsePmiNewOrders(text);
    if (value === null) throw new Error("no match");
    const dateMatch = text.match(/Updated: (\w+) (\d{1,2}), (\d{4})/);
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    let observedAt: string;
    if (dateMatch) {
      const mi = monthNames.indexOf(dateMatch[1]);
      observedAt = mi >= 0 ? `${dateMatch[3]}-${String(mi + 1).padStart(2, "0")}-${String(Number(dateMatch[2])).padStart(2, "0")}` : `${a.year}-01-01`;
    } else {
      observedAt = `${a.year}-01-01`;
    }
    return { observedAt, value };
  });

  const points: MetricPoint[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    points.push({
      metric_key: "china.pmi_new_orders",
      observed_at: r.value.observedAt,
      value: r.value.value,
      unit: "index",
      source_key: "gov_cn_statistics",
      source_tier: 1,
      frequency: "monthly",
    });
  }
  return points;
}

async function fetchPropertyPoints(articles: Article[]): Promise<MetricPoint[]> {
  const parsed = await mapWithConcurrency(articles, CONCURRENCY, async (a) => {
    const res = await fetch(a.url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = stripHtml(await res.text());
    const cumulative = parsePropertyFloorSpaceYtd(text);
    const periodEndMonth = parsePeriodEndMonth(text.slice(0, 800));
    if (cumulative === null || periodEndMonth === null) throw new Error("no match");
    return { year: a.year, periodEndMonth, cumulative };
  });

  const byYear = new Map<number, { periodEndMonth: number; cumulative: number }[]>();
  for (const r of parsed) {
    if (r.status !== "fulfilled") continue;
    const { year, periodEndMonth, cumulative } = r.value;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push({ periodEndMonth, cumulative });
  }

  const points: MetricPoint[] = [];
  for (const [year, periods] of byYear) {
    periods.sort((a, b) => a.periodEndMonth - b.periodEndMonth);
    // Only start accumulating once the year's genuine first release ("first two
    // months") is seen — treating whatever period happens to be *discovered*
    // first as the baseline (e.g. June, if backfill didn't reach back to March)
    // would misreport a 6-month cumulative total as a single period's flow.
    // Years where that baseline isn't in range simply contribute no points.
    let previousCumulative: number | null = null;
    for (const p of periods) {
      let flow: number | null = null;
      if (p.periodEndMonth === 2) {
        flow = p.cumulative;
      } else if (previousCumulative !== null) {
        flow = p.cumulative - previousCumulative;
      }
      previousCumulative = p.cumulative;
      if (flow === null) continue;
      const lastDay = new Date(Date.UTC(year, p.periodEndMonth, 0)).getUTCDate();
      points.push({
        metric_key: "china.property_sales",
        observed_at: `${year}-${String(p.periodEndMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
        value: flow,
        unit: "million m² (period flow)",
        source_key: "gov_cn_statistics",
        source_tier: 1,
        frequency: "monthly",
      });
    }
  }
  return points;
}

export async function fetchChinaMonthlyReleases(pageLimit: number): Promise<{ pmi: MetricPoint[]; property: MetricPoint[]; discovered: { pmi: number; property: number } }> {
  const { pmi: pmiArticles, property: propertyArticles } = await discoverArticles(pageLimit);
  const [pmi, property] = await Promise.all([fetchPmiPoints(pmiArticles), fetchPropertyPoints(propertyArticles)]);
  return { pmi, property, discovered: { pmi: pmiArticles.length, property: propertyArticles.length } };
}
