import { XMLParser } from "fast-xml-parser";

/**
 * Top-10 "what's trending today" lists from every platform that exposes trend
 * data for free, without credentials — each endpoint verified live before
 * being wired in:
 *
 * - Reddit: r/all "top of the day" via its RSS feed. Reddit's JSON API returns
 *   403 to non-browser clients; the RSS feed is served normally. Ranked by
 *   Reddit's own top-of-day order (RSS carries no score).
 * - Bluesky: the public app.bsky.unspecced.getTrends endpoint, Bluesky's own
 *   trending-topics ranking (with post counts).
 * - Mastodon: mastodon.social's public trends/tags endpoint — ONE instance,
 *   not the whole federated network, and disclosed as such on the page.
 * - Hacker News: official Firebase API top stories, ranked by HN's front page.
 * - Google Trends: the daily trending-searches RSS. This is search interest,
 *   not a social app — labeled as such on the page — included because it's the
 *   closest free proxy for what is trending on the platforms below.
 *
 * NOT available, and deliberately not faked or scraped: X/Twitter, TikTok,
 * Instagram, Facebook, Threads, Snapchat, Telegram (no public trends API at
 * all) and YouTube (its trending chart needs a YouTube Data API key this app
 * doesn't have — the feed that used to work without one now returns HTTP 400).
 * Third-party sites that republish X/TikTok trends do so by scraping and
 * against those platforms' terms, so they aren't used.
 *
 * Every list is the platform's own ranking, taken as-is; nothing is scored,
 * re-ranked, summarized or written by this app.
 */

export type TrendItem = {
  rank: number;
  title: string;
  /** Platform-supplied figures, e.g. "1,246 posts · business". */
  meta: string;
  /** Platform-supplied context line (e.g. Bluesky's own topic description), if any. */
  note?: string;
  url: string;
};

export type PlatformTrends = {
  key: string;
  name: string;
  kind: "social" | "search";
  /** How this platform's list is ranked/what it measures — shown on the page. */
  basis: string;
  items: TrendItem[];
  error?: string;
};

const UA = "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0; +https://globalmeltdownindex.net)";
const TIMEOUT_MS = 8000;
const REVALIDATE_SECONDS = 600;
const TOP_N = 10;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

async function get(url: string): Promise<Response> {
  const res = await fetch(url, {
    next: { revalidate: REVALIDATE_SECONDS },
    headers: { "User-Agent": UA, Accept: "application/json, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    const t = (v as Record<string, unknown>)["#text"];
    if (typeof t === "string" || typeof t === "number") return String(t);
  }
  return "";
}

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
}

async function reddit(): Promise<TrendItem[]> {
  const doc = parser.parse(await (await get("https://www.reddit.com/r/all/top/.rss?t=day&limit=25")).text());
  return asArray<Record<string, unknown>>(doc?.feed?.entry)
    .map((e) => {
      const link = asArray<Record<string, unknown>>(e.link as Record<string, unknown>)[0];
      const sub = (e.category as Record<string, unknown> | undefined)?.["@_label"];
      return { title: decode(str(e.title)), url: typeof link?.["@_href"] === "string" ? link["@_href"] : "", sub: typeof sub === "string" ? sub : "" };
    })
    .filter((e) => e.title && e.url)
    .slice(0, TOP_N)
    .map((e, i) => ({ rank: i + 1, title: e.title, meta: e.sub || "r/all", url: e.url }));
}

async function bluesky(): Promise<TrendItem[]> {
  const json = (await (await get("https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends?limit=10")).json()) as {
    trends?: { displayName?: string; description?: string; link?: string; postCount?: number; category?: string; status?: string }[];
  };
  return (json.trends ?? [])
    .filter((t) => t.displayName && t.link)
    .slice(0, TOP_N)
    .map((t, i) => ({
      rank: i + 1,
      title: t.displayName as string,
      meta: [typeof t.postCount === "number" ? `${t.postCount.toLocaleString("en-US")} posts` : null, t.category, t.status].filter(Boolean).join(" · "),
      note: t.description || undefined,
      url: `https://bsky.app${t.link}`,
    }));
}

async function mastodon(): Promise<TrendItem[]> {
  const tags = (await (await get("https://mastodon.social/api/v1/trends/tags?limit=10")).json()) as {
    name?: string;
    url?: string;
    history?: { uses?: string; accounts?: string }[];
  }[];
  return tags
    .filter((t) => t.name && t.url)
    .slice(0, TOP_N)
    .map((t, i) => {
      // History[0] is today so far, [1] yesterday: summing gives a stable ~48h figure rather than a half-day one.
      const uses = (t.history ?? []).slice(0, 2).reduce((sum, h) => sum + (Number(h.uses) || 0), 0);
      return { rank: i + 1, title: `#${t.name}`, meta: `${uses.toLocaleString("en-US")} posts, last 2 days`, url: t.url as string };
    });
}

async function hackerNews(): Promise<TrendItem[]> {
  const ids = ((await (await get("https://hacker-news.firebaseio.com/v0/topstories.json")).json()) as number[]).slice(0, TOP_N);
  const stories = await Promise.all(
    ids.map(async (id) => (await (await get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json()) as { title?: string; url?: string; score?: number; descendants?: number } | null)
  );
  return stories
    .map((s, i) => ({ s, id: ids[i] }))
    .filter((x) => x.s?.title)
    .map((x, i) => ({
      rank: i + 1,
      title: decode(x.s!.title as string),
      meta: `${x.s!.score ?? 0} points · ${x.s!.descendants ?? 0} comments`,
      url: `https://news.ycombinator.com/item?id=${x.id}`,
    }));
}

async function googleTrends(): Promise<TrendItem[]> {
  const doc = parser.parse(await (await get("https://trends.google.com/trending/rss?geo=US")).text());
  return asArray<Record<string, unknown>>(doc?.rss?.channel?.item)
    .slice(0, TOP_N)
    .map((it, i) => {
      const news = asArray<Record<string, unknown>>(it["ht:news_item"] as Record<string, unknown>)[0];
      const traffic = str(it["ht:approx_traffic"]);
      return {
        rank: i + 1,
        title: decode(str(it.title)),
        meta: traffic ? `${traffic} searches` : "",
        note: news ? decode(str(news["ht:news_item_title"])) : undefined,
        url: (news && str(news["ht:news_item_url"])) || `https://www.google.com/search?q=${encodeURIComponent(decode(str(it.title)))}`,
      };
    })
    .filter((t) => t.title);
}

const PLATFORMS: { key: string; name: string; kind: PlatformTrends["kind"]; basis: string; load: () => Promise<TrendItem[]> }[] = [
  { key: "reddit", name: "Reddit", kind: "social", basis: "Top posts on r/all over the past day, in Reddit's own order", load: reddit },
  { key: "bluesky", name: "Bluesky", kind: "social", basis: "Bluesky's own trending-topics ranking", load: bluesky },
  { key: "mastodon", name: "Mastodon", kind: "social", basis: "Trending hashtags on mastodon.social only (one instance, not the whole network)", load: mastodon },
  { key: "hackernews", name: "Hacker News", kind: "social", basis: "Current front page, in HN's own ranking", load: hackerNews },
  { key: "google_trends", name: "Google Trends (US)", kind: "search", basis: "Trending Google searches — search interest, not a social app", load: googleTrends },
];

export async function fetchSocialTrends(): Promise<PlatformTrends[]> {
  return Promise.all(
    PLATFORMS.map(async ({ key, name, kind, basis, load }): Promise<PlatformTrends> => {
      try {
        const items = await load();
        return { key, name, kind, basis, items, ...(items.length === 0 ? { error: "no items returned" } : {}) };
      } catch (e) {
        return { key, name, kind, basis, items: [], error: (e as Error).message.slice(0, 80) };
      }
    })
  );
}
