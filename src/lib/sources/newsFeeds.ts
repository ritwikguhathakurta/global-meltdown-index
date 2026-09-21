import { XMLParser } from "fast-xml-parser";

/**
 * Curated live news aggregation for the World News tab.
 *
 * The spec this was built from (News_Engine.pdf) names ~150 X (Twitter)
 * handles. X's API has no free read tier (and this app has no X credentials),
 * and scraping X is both unreliable and against its terms — so this does NOT
 * read X. It reads the same organizations' own published news feeds instead:
 * official RSS where one exists and works, and Google News' RSS search index
 * restricted to the publisher's own domain (`site:`) for outlets that have no
 * working official feed (Reuters, AP and Bloomberg discontinued theirs; IMF,
 * OECD and OPEC 403 non-browser clients). Every entry below was fetched live
 * before being listed — feeds that failed (or were stale) were left out
 * rather than listed and silently empty. `handle` is filled only where the
 * PDF itself names that account; never invented for outlets it doesn't list.
 *
 * Nothing here is written by an LLM. Headline and summary are the feed's own
 * text; category comes from the source; priority and tags are the plain
 * keyword rules below — all disclosed on the page.
 *
 * Checked and left out because dead or blocked (verified live): CNN (feed frozen since April 2023), OPEC (not indexed by Google News; opec.org 403s bots), Business Standard (403), plus SNB, Bundesbank, Norges Bank, HKMA, MAS and SARB (no working feed found).
 *
 * Not coverable without X itself: the ~55 politician and economist handles
 * (sections 8-12 of the spec) — those people don't publish RSS.
 */

export type NewsCategory = "Wires" | "Markets" | "Central Banks" | "UN & Agencies" | "Commodities" | "Business" | "Asia & Regional";

export const NEWS_CATEGORIES: NewsCategory[] = ["Wires", "Markets", "Central Banks", "UN & Agencies", "Commodities", "Business", "Asia & Regional"];

type NewsSource = {
  key: string;
  name: string;
  handle: string | null;
  category: NewsCategory;
  url: string;
  /** Google News results must come from this publisher, or they're dropped (its search matches mentions too). */
  sourceMatch?: RegExp;
  /** Items older than this are dropped — low-frequency institutional feeds get a longer window than newsrooms. */
  maxAgeHours: number;
};

const gnews = (site: string) => `https://news.google.com/rss/search?q=site:${site}+when:3d&hl=en-US&gl=US&ceid=US:en`;
const NEWSROOM_H = 48;
const INSTITUTION_H = 24 * 14;

export const NEWS_SOURCES: NewsSource[] = [
  // Wires — no working official RSS; publisher-domain-restricted Google News index
  { key: "reuters", name: "Reuters", handle: "@Reuters", category: "Wires", url: gnews("reuters.com"), sourceMatch: /reuters/i, maxAgeHours: NEWSROOM_H },
  { key: "ap", name: "Associated Press", handle: "@AP", category: "Wires", url: gnews("apnews.com"), sourceMatch: /associated press|ap news/i, maxAgeHours: NEWSROOM_H },
  { key: "bloomberg", name: "Bloomberg", handle: "@Bloomberg", category: "Wires", url: gnews("bloomberg.com"), sourceMatch: /bloomberg/i, maxAgeHours: NEWSROOM_H },
  { key: "bbc_world", name: "BBC News – World", handle: "@BBCWorld", category: "Wires", url: "https://feeds.bbci.co.uk/news/world/rss.xml", maxAgeHours: NEWSROOM_H },
  { key: "nyt_world", name: "New York Times – World", handle: "@nytimes", category: "Wires", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", maxAgeHours: NEWSROOM_H },
  { key: "wsj_world", name: "Wall Street Journal – World", handle: "@WSJ", category: "Wires", url: "https://feeds.content.dowjones.io/public/rss/RSSWorldNews", maxAgeHours: NEWSROOM_H },
  { key: "ft_world", name: "Financial Times – World", handle: "@FT", category: "Wires", url: "https://www.ft.com/world?format=rss", maxAgeHours: NEWSROOM_H },
  { key: "aljazeera", name: "Al Jazeera", handle: null, category: "Wires", url: "https://www.aljazeera.com/xml/rss/all.xml", maxAgeHours: NEWSROOM_H },

  // Markets
  { key: "wsj_markets", name: "Wall Street Journal – Markets", handle: "@WSJ", category: "Markets", url: "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", maxAgeHours: 24 * 4 },
  { key: "ft_markets", name: "Financial Times – Markets", handle: "@FT", category: "Markets", url: "https://www.ft.com/markets?format=rss", maxAgeHours: NEWSROOM_H },
  { key: "cnbc_top", name: "CNBC – Top News", handle: null, category: "Markets", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", maxAgeHours: NEWSROOM_H },
  { key: "marketwatch", name: "MarketWatch", handle: null, category: "Markets", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", maxAgeHours: NEWSROOM_H },
  { key: "yahoo_finance", name: "Yahoo Finance", handle: null, category: "Markets", url: "https://finance.yahoo.com/news/rssindex", maxAgeHours: NEWSROOM_H },
  { key: "investing", name: "Investing.com", handle: null, category: "Markets", url: "https://www.investing.com/rss/news.rss", maxAgeHours: NEWSROOM_H },
  { key: "economist_fin", name: "The Economist – Finance", handle: "@TheEconomist", category: "Markets", url: "https://www.economist.com/finance-and-economics/rss.xml", maxAgeHours: 24 * 7 },

  // Central banks & BIS — official feeds
  { key: "fed", name: "Federal Reserve", handle: "@FederalReserve", category: "Central Banks", url: "https://www.federalreserve.gov/feeds/press_all.xml", maxAgeHours: INSTITUTION_H },
  { key: "ecb", name: "European Central Bank", handle: "@ecb", category: "Central Banks", url: "https://www.ecb.europa.eu/rss/press.html", maxAgeHours: INSTITUTION_H },
  { key: "boe", name: "Bank of England", handle: "@bankofengland", category: "Central Banks", url: "https://www.bankofengland.co.uk/rss/news", maxAgeHours: INSTITUTION_H },
  { key: "boj", name: "Bank of Japan", handle: "@BankofJapan", category: "Central Banks", url: "https://www.boj.or.jp/en/rss/whatsnew.xml", maxAgeHours: INSTITUTION_H },
  { key: "rbi", name: "Reserve Bank of India", handle: "@RBI", category: "Central Banks", url: "https://www.rbi.org.in/pressreleases_rss.xml", maxAgeHours: INSTITUTION_H },
  { key: "boc", name: "Bank of Canada", handle: "@BankofCanada", category: "Central Banks", url: "https://www.bankofcanada.ca/content_type/press-releases/feed/", maxAgeHours: INSTITUTION_H },
  { key: "riksbank", name: "Sveriges Riksbank", handle: "@Riksbank", category: "Central Banks", url: "https://www.riksbank.se/en-gb/rss/press-releases/", maxAgeHours: INSTITUTION_H },
  { key: "rba", name: "Reserve Bank of Australia", handle: "@ReserveBankAU", category: "Central Banks", url: "https://www.rba.gov.au/rss/rss-cb-media-releases.xml", maxAgeHours: INSTITUTION_H },
  { key: "bis", name: "Bank for International Settlements", handle: "@BIS_org", category: "Central Banks", url: "https://www.bis.org/doclist/all_pressrels.rss", maxAgeHours: INSTITUTION_H },

  // UN & specialized agencies
  { key: "un", name: "UN News", handle: "@UN", category: "UN & Agencies", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", maxAgeHours: 24 * 7 },
  { key: "iaea", name: "IAEA", handle: "@iaeaorg", category: "UN & Agencies", url: "https://www.iaea.org/feeds/topnews", maxAgeHours: INSTITUTION_H },
  { key: "imf", name: "IMF", handle: "@IMFNews", category: "UN & Agencies", url: gnews("imf.org"), sourceMatch: /imf|international monetary/i, maxAgeHours: INSTITUTION_H },
  { key: "worldbank", name: "World Bank", handle: "@WorldBank", category: "UN & Agencies", url: gnews("worldbank.org"), sourceMatch: /world bank/i, maxAgeHours: INSTITUTION_H },
  { key: "oecd", name: "OECD", handle: "@OECD", category: "UN & Agencies", url: gnews("oecd.org"), sourceMatch: /oecd/i, maxAgeHours: INSTITUTION_H },
  { key: "fao", name: "FAO", handle: "@FAO", category: "UN & Agencies", url: gnews("fao.org"), sourceMatch: /fao|food and agriculture/i, maxAgeHours: INSTITUTION_H },

  // Commodities, energy, chemicals
  { key: "iea", name: "IEA", handle: "@IEA", category: "Commodities", url: gnews("iea.org"), sourceMatch: /iea|international energy/i, maxAgeHours: INSTITUTION_H },
  { key: "oilprice", name: "OilPrice.com", handle: "@OilPrice", category: "Commodities", url: "https://oilprice.com/rss/main", maxAgeHours: 24 * 4 },
  { key: "rigzone", name: "Rigzone", handle: null, category: "Commodities", url: "https://www.rigzone.com/news/rss/rigzone_latest.aspx", maxAgeHours: 24 * 4 },
  { key: "mining", name: "Mining.com", handle: null, category: "Commodities", url: "https://www.mining.com/feed/", maxAgeHours: 24 * 4 },
  { key: "icis", name: "ICIS", handle: "@ICIS", category: "Commodities", url: gnews("icis.com"), sourceMatch: /icis/i, maxAgeHours: 24 * 7 },
  { key: "argus", name: "Argus Media", handle: "@ArgusMedia", category: "Commodities", url: gnews("argusmedia.com"), sourceMatch: /argus/i, maxAgeHours: 24 * 7 },
  { key: "chemweek", name: "Chemical Week", handle: "@ChemWeek", category: "Commodities", url: gnews("chemweek.com"), sourceMatch: /chemical week|chemweek/i, maxAgeHours: 24 * 7 },

  // General business
  { key: "bbc_business", name: "BBC News – Business", handle: "@BBCWorld", category: "Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", maxAgeHours: NEWSROOM_H },
  { key: "cnbc_business", name: "CNBC – Business", handle: null, category: "Business", url: "https://www.cnbc.com/id/10001147/device/rss/rss.html", maxAgeHours: NEWSROOM_H },
  { key: "nyt_business", name: "New York Times – Business", handle: "@nytimes", category: "Business", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", maxAgeHours: NEWSROOM_H },
  { key: "guardian_business", name: "The Guardian – Business", handle: null, category: "Business", url: "https://www.theguardian.com/business/rss", maxAgeHours: NEWSROOM_H },
  { key: "sky_business", name: "Sky News – Business", handle: null, category: "Business", url: "https://feeds.skynews.com/feeds/rss/business.xml", maxAgeHours: 24 * 3 },
  { key: "dw_business", name: "DW – Business", handle: null, category: "Business", url: "https://rss.dw.com/rdf/rss-en-bus", maxAgeHours: 24 * 3 },
  { key: "france24_eco", name: "France 24 – Economy", handle: null, category: "Business", url: "https://www.france24.com/en/economy/rss", maxAgeHours: 24 * 4 },
  { key: "fortune", name: "Fortune", handle: null, category: "Business", url: "https://fortune.com/feed/", maxAgeHours: NEWSROOM_H },
  { key: "business_insider", name: "Business Insider", handle: null, category: "Business", url: "https://feeds.businessinsider.com/custom/all", maxAgeHours: NEWSROOM_H },
  { key: "forbes", name: "Forbes – Business", handle: null, category: "Business", url: "https://www.forbes.com/business/feed/", maxAgeHours: NEWSROOM_H },
  { key: "economist_biz", name: "The Economist – Business", handle: "@TheEconomist", category: "Business", url: "https://www.economist.com/business/rss.xml", maxAgeHours: 24 * 7 },

  // Asia & regional markets
  { key: "yonhap", name: "Yonhap News", handle: "@YonhapNews", category: "Asia & Regional", url: "https://en.yna.co.kr/RSS/news.xml", maxAgeHours: NEWSROOM_H },
  { key: "nikkei", name: "Nikkei Asia", handle: "@nikkei", category: "Asia & Regional", url: gnews("asia.nikkei.com"), sourceMatch: /nikkei/i, maxAgeHours: NEWSROOM_H },
  { key: "nhk", name: "NHK World-Japan", handle: "@NHKWORLD_News", category: "Asia & Regional", url: gnews("www3.nhk.or.jp"), sourceMatch: /nhk/i, maxAgeHours: NEWSROOM_H },
  { key: "scmp", name: "South China Morning Post – Business", handle: null, category: "Asia & Regional", url: "https://www.scmp.com/rss/92/feed", maxAgeHours: NEWSROOM_H },
  { key: "straits_times", name: "The Straits Times – Business", handle: null, category: "Asia & Regional", url: "https://www.straitstimes.com/news/business/rss.xml", maxAgeHours: NEWSROOM_H },
  { key: "cna", name: "CNA – Business", handle: null, category: "Asia & Regional", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6936", maxAgeHours: NEWSROOM_H },
  { key: "et_markets", name: "Economic Times – Markets", handle: null, category: "Asia & Regional", url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", maxAgeHours: NEWSROOM_H },
  { key: "livemint", name: "Mint – Markets", handle: null, category: "Asia & Regional", url: "https://www.livemint.com/rss/markets", maxAgeHours: NEWSROOM_H },
];

export type NewsPriority = "High" | "Medium" | "Low";

export type NewsItem = {
  id: string;
  category: NewsCategory;
  headline: string;
  /** The feed's own description text, stripped of markup — empty when the feed supplies none (never generated). */
  summary: string;
  sourceKey: string;
  sourceName: string;
  sourceHandle: string | null;
  originalLink: string;
  postedAt: string; // ISO 8601
  priority: NewsPriority;
  tags: string[];
};

export type NewsSourceStatus = {
  key: string;
  name: string;
  category: NewsCategory;
  status: "ok" | "empty" | "error";
  count: number;
  error?: string;
};

export type NewsFeedResult = {
  items: NewsItem[];
  sources: NewsSourceStatus[];
  fetchedAt: string;
};

const PER_SOURCE_CAP = 12;
const SUMMARY_MAX = 300;
const REQUEST_TIMEOUT_MS = 8000;
const REVALIDATE_SECONDS = 300;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => NAMED_ENTITIES[n.toLowerCase()] ?? m);
}

function cleanText(raw: unknown): string {
  const s = textOf(raw);
  return decodeEntities(decodeEntities(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    const t = (v as Record<string, unknown>)["#text"];
    if (typeof t === "string" || typeof t === "number") return String(t);
  }
  return "";
}

function linkOf(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    const alt = v.find((l) => (l as Record<string, unknown>)?.["@_rel"] !== "self") ?? v[0];
    return linkOf(alt);
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o["@_href"] === "string") return o["@_href"].trim();
    return textOf(o).trim();
  }
  return "";
}

function parseDate(raw: unknown): number | null {
  const s = textOf(raw).trim();
  if (!s) return null;
  // IAEA's "26-09-18  06:00" (yy-mm-dd) isn't parseable by Date
  const iaea = s.match(/^(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  const t = iaea ? Date.parse(`20${iaea[1]}-${iaea[2]}-${iaea[3]}T${iaea[4]}:${iaea[5]}:00Z`) : Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trim()}…`;
}

const HIGH_PRIORITY = /\b(rate (decision|hike|cut)|raises? (interest )?rates?|cuts? (interest )?rates?|emergency|war|strike[sd]?|attack|missile|sanction|default|crash|plunge|surge|collapse|ceasefire|tariff|opec\+?|recession|invasion|coup|blockade|hormuz|nuclear)\b/i;

const TAG_RULES: [string, RegExp][] = [
  ["oil", /\b(oil|crude|brent|wti|opec|petroleum|hormuz)\b/i],
  ["gas", /\b(natural gas|lng)\b/i],
  ["central-bank", /\b(central bank|federal reserve|the fed\b|fomc|ecb|bank of (japan|england|canada)|boj|boe|rbi|riksbank|monetary policy)\b/i],
  ["rates", /\b(interest rates?|rate (hike|cut|decision)|yields?|bond)\b/i],
  ["inflation", /\b(inflation|cpi|consumer prices)\b/i],
  ["tariffs", /\b(tariffs?|trade war|trade deal|export controls?)\b/i],
  ["china", /\b(china|chinese|beijing|yuan)\b/i],
  ["iran", /\b(iran|iranian|tehran)\b/i],
  ["russia-ukraine", /\b(ukraine|russia|russian|kyiv|moscow)\b/i],
  ["israel-gaza", /\b(israel|gaza|hamas|hezbollah)\b/i],
  ["japan", /\b(japan|japanese|yen|nikkei|tokyo)\b/i],
  ["india", /\b(india|indian|rupee|sensex|nifty)\b/i],
  ["europe", /\b(europe|european|eurozone|euro area)\b/i],
  ["gold", /\b(gold|silver|bullion)\b/i],
  ["metals", /\b(copper|lithium|nickel|aluminium|aluminum|iron ore|mining)\b/i],
  ["crypto", /\b(bitcoin|crypto|ethereum)\b/i],
  ["ai", /\b(artificial intelligence|a\.i\.|\bai\b|chips?|semiconductors?|nvidia)\b/i],
  ["equities", /\b(stocks?|shares|wall street|s&p 500|nasdaq|dow)\b/i],
  ["chemicals", /\b(chemicals?|polyethylene|polypropylene|olefins?|petrochemicals?)\b/i],
];

// Only policy-substantive central-bank releases rank High — most of a central
// bank's feed is routine (daily money-market operations tables, staff
// notices, statistical releases) and flagging all of it made priority
// meaningless (54 of 54 items High when first tried live).
const CB_POLICY_HEADLINE = /\b(monetary policy|policy rate|interest rates?|rate decision|guideline|fomc|mpc|mpm|projections|press conference|financial stability|stress test)\b/i;

function priorityFor(category: NewsCategory, headline: string, text: string): NewsPriority {
  if (HIGH_PRIORITY.test(text)) return "High";
  if (category === "Central Banks") return CB_POLICY_HEADLINE.test(headline) ? "High" : "Low";
  if (category === "Wires" || category === "Markets" || category === "Commodities") return "Medium";
  return "Low";
}

function tagsFor(text: string): string[] {
  return TAG_RULES.filter(([, re]) => re.test(text)).map(([tag]) => tag).slice(0, 5);
}

function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function fetchSource(src: NewsSource, now: number): Promise<{ items: NewsItem[]; status: NewsSourceStatus }> {
  const base = { key: src.key, name: src.name, category: src.category };
  try {
    const res = await fetch(src.url, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0; +https://globalmeltdownindex.net)" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return { items: [], status: { ...base, status: "error", count: 0, error: `HTTP ${res.status}` } };

    const doc = parser.parse(await res.text());
    const rawList = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.["rdf:RDF"]?.item ?? [];
    const list: Record<string, unknown>[] = Array.isArray(rawList) ? rawList : rawList ? [rawList] : [];
    const cutoff = now - src.maxAgeHours * 3600_000;

    const items: NewsItem[] = [];
    for (const item of list) {
      const publisher = cleanText(item.source);
      if (src.sourceMatch && !src.sourceMatch.test(publisher)) continue;

      let headline = cleanText(item.title);
      if (publisher) headline = headline.replace(new RegExp(`\\s+[-–|]\\s+${publisher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "");
      const link = linkOf(item.link);
      const ts = parseDate(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]);
      if (!headline || !link || ts === null || ts < cutoff || ts > now + 3600_000) continue;

      let summary = cleanText(item.description ?? item.summary ?? item["content:encoded"]);
      // Google News' <description> is just the headline + publisher again, and
      // some feeds repeat the headline — an echo isn't a summary.
      if (summary.toLowerCase().startsWith(headline.toLowerCase().slice(0, 40))) summary = "";
      // RBI's feed, for one, puts a whole HTML table dump in <description>
      // (comment fragments and mostly numbers) — that's not a summary either.
      if (/-->|<!--/.test(summary) || summary.replace(/\D/g, "").length / Math.max(summary.length, 1) > 0.25) summary = "";
      summary = truncate(summary, SUMMARY_MAX);

      const text = `${headline} ${summary}`;
      items.push({
        id: `${src.key}-${hashId(link)}`,
        category: src.category,
        headline,
        summary,
        sourceKey: src.key,
        sourceName: src.name,
        sourceHandle: src.handle,
        originalLink: link,
        postedAt: new Date(ts).toISOString(),
        priority: priorityFor(src.category, headline, text),
        tags: tagsFor(text),
      });
    }

    items.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
    const capped = items.slice(0, PER_SOURCE_CAP);
    return { items: capped, status: { ...base, status: capped.length > 0 ? "ok" : "empty", count: capped.length } };
  } catch (e) {
    return { items: [], status: { ...base, status: "error", count: 0, error: (e as Error).message.slice(0, 80) } };
  }
}

export async function fetchNewsFeed(): Promise<NewsFeedResult> {
  const now = Date.now();
  const results = await Promise.all(NEWS_SOURCES.map((s) => fetchSource(s, now)));

  // The same story routinely appears across outlets/feeds; keep the first
  // (NEWS_SOURCES is ordered by directness of source: wires and official
  // feeds before aggregators) rather than showing it several times.
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const r of results) {
    for (const it of r.items) {
      const norm = it.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
      if (seen.has(norm)) continue;
      seen.add(norm);
      items.push(it);
    }
  }
  items.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));

  return { items, sources: results.map((r) => r.status), fetchedAt: new Date(now).toISOString() };
}
