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
 * - X: no free API, so this scrapes getdaytrends.com's public page (a third
 *   party that republishes X's trending list). Fragile by nature, and
 *   attributed on the page as third-party.
 * - YouTube: charts.youtube.com's undocumented backend — a weekly music chart
 *   only (see youtubeCharts). YouTube's general trending page has no video
 *   list in its HTML any more and its Data API needs a key.
 *
 * Probed live and NOT shippable (each returns no trend data, and nothing is
 * faked in its place): Instagram, Threads, Snapchat, Facebook, Discord (public
 * pages are login shells with no trend list), Telegram (no trends feature;
 * TGStat lists channels by size, not trends), TikTok (its Creative Center
 * host doesn't resolve from here, and its trend API is request-signed —
 * forging those signatures would be circumventing its access controls, not
 * scraping a public page).
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
  /** Set when the list is read from a third party rather than the platform itself. */
  via?: { label: string; url: string };
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

// X has no free trends API. getdaytrends.com is a third-party tracker that
// republishes X's own trending list (scraped from its public HTML: rank +
// name, no volumes); if it changes its markup this returns nothing and the
// card shows "unavailable" rather than stale or invented data.
async function xTrends(path: string): Promise<TrendItem[]> {
  const html = await (await get(`https://getdaytrends.com/${path}`)).text();
  const rows = [...html.matchAll(/<th scope="row" class="pos">(\d+)<\/th><td class="main"><a [^>]*>([^<]+)<\/a>/g)];
  return rows.slice(0, TOP_N).map((r) => {
    const title = decode(r[2]);
    return { rank: Number(r[1]), title, meta: "trending on X", url: `https://x.com/search?q=${encodeURIComponent(title)}` };
  });
}

// YouTube's own Charts site (charts.youtube.com) backend, using the public
// key embedded in that site — undocumented, so it can change. It serves ONE
// weekly chart of the most-viewed music videos: requesting the "trending" and
// "top" chart types returned the identical list when tested, so this is
// labeled as exactly that, not as YouTube's general trending page (which no
// longer carries a server-rendered video list, and whose API needs a key).
async function youtubeCharts(): Promise<TrendItem[]> {
  const res = await fetch("https://charts.youtube.com/youtubei/v1/browse?alt=json&key=AIzaSyCzEW7JUJdGbtTRvfUkOoMt5Uh9JnKzrXA", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/json", Origin: "https://charts.youtube.com", Referer: "https://charts.youtube.com/charts/TrendingVideos/us" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_MUSIC_ANALYTICS", clientVersion: "2.0", hl: "en", gl: "US" } },
      browseId: "FEmusic_analytics_charts_home",
      query: "perspective=CHART&chart_params_country_code=us&chart_params_chart_type=TRENDING_VIDEOS&chart_params_period_type=WEEKLY",
    }),
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    contents?: { sectionListRenderer?: { contents?: { musicAnalyticsSectionRenderer?: { content?: { videos?: { videoViews?: {
      id?: string;
      title?: string;
      viewCount?: string;
      channelName?: string;
      artists?: { name?: string }[];
      chartEntryMetadata?: { currentPosition?: number };
    }[] }[] } } }[] } };
  };
  const list = json.contents?.sectionListRenderer?.contents?.[0]?.musicAnalyticsSectionRenderer?.content?.videos?.[0]?.videoViews ?? [];
  return list
    .filter((v) => v.id && v.title)
    .slice(0, TOP_N)
    .map((v, i) => {
      const who = v.artists?.map((a) => a.name).filter(Boolean).join(", ") || v.channelName || "";
      const views = Number(v.viewCount);
      return {
        rank: v.chartEntryMetadata?.currentPosition ?? i + 1,
        title: decode(v.title as string),
        meta: [who, Number.isFinite(views) ? `${views.toLocaleString("en-US")} views this week` : null].filter(Boolean).join(" · "),
        url: `https://www.youtube.com/watch?v=${v.id}`,
      };
    });
}

const PLATFORMS: { key: string; name: string; kind: PlatformTrends["kind"]; basis: string; via?: PlatformTrends["via"]; load: () => Promise<TrendItem[]> }[] = [
  {
    key: "x_us",
    name: "X (Twitter) — United States",
    kind: "social",
    basis: "X's current trending topics, in X's own order (no volumes published)",
    via: { label: "getdaytrends.com", url: "https://getdaytrends.com/united-states/" },
    load: () => xTrends("united-states/"),
  },
  {
    key: "x_world",
    name: "X (Twitter) — Worldwide",
    kind: "social",
    basis: "X's current worldwide trending topics, in X's own order (no volumes published)",
    via: { label: "getdaytrends.com", url: "https://getdaytrends.com/" },
    load: () => xTrends(""),
  },
  {
    key: "youtube_charts",
    name: "YouTube — Top Music Videos (US)",
    kind: "social",
    basis: "YouTube Charts' weekly most-viewed music videos. Music only and weekly — not YouTube's general trending page, which has no free data source",
    via: { label: "charts.youtube.com", url: "https://charts.youtube.com/charts/TrendingVideos/us" },
    load: youtubeCharts,
  },
  { key: "reddit", name: "Reddit", kind: "social", basis: "Top posts on r/all over the past day, in Reddit's own order", load: reddit },
  { key: "bluesky", name: "Bluesky", kind: "social", basis: "Bluesky's own trending-topics ranking", load: bluesky },
  { key: "mastodon", name: "Mastodon", kind: "social", basis: "Trending hashtags on mastodon.social only (one instance, not the whole network)", load: mastodon },
  { key: "hackernews", name: "Hacker News", kind: "social", basis: "Current front page, in HN's own ranking", load: hackerNews },
  { key: "google_trends", name: "Google Trends (US)", kind: "search", basis: "Trending Google searches — search interest, not a social app", load: googleTrends },
];

export async function fetchSocialTrends(): Promise<PlatformTrends[]> {
  return Promise.all(
    PLATFORMS.map(async ({ key, name, kind, basis, via, load }): Promise<PlatformTrends> => {
      try {
        // Platform-supplied links go straight into href — only ever http(s).
        const items = (await load()).filter((i) => /^https?:\/\//i.test(i.url));
        return { key, name, kind, basis, via, items, ...(items.length === 0 ? { error: "no items returned" } : {}) };
      } catch (e) {
        return { key, name, kind, basis, via, items: [], error: (e as Error).message.slice(0, 80) };
      }
    })
  );
}
