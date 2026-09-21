import Link from "next/link";
import { fetchWorldNews } from "@/lib/sources/gdeltNews";
import { fetchNewsFeed, NEWS_CATEGORIES, type NewsCategory, type NewsPriority } from "@/lib/sources/newsFeeds";

// Both sources are live network round trips this app doesn't control the
// latency of (the curated feed fans out to ~55 publisher feeds, each bounded
// to 8s, in parallel; GDELT is one call bounded to 15s) — only ever render
// per-request on the deployed server, never during `next build`.
export const dynamic = "force-dynamic";
// Generous margin above the slowest single request's own timeout.
export const maxDuration = 30;

const ALL_LIMIT = 60;
const CATEGORY_LIMIT = 80;

const PRIORITY_COLOR: Record<NewsPriority, string> = { High: "#e05a4d", Medium: "#e0b93d", Low: "#8b96a8" };

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function WorldNewsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const activeCategory = NEWS_CATEGORIES.find((c) => c === cat) as NewsCategory | undefined;

  const [feed, { regions, error }] = await Promise.all([fetchNewsFeed(), fetchWorldNews()]);

  const countByCategory = new Map<NewsCategory, number>();
  for (const it of feed.items) countByCategory.set(it.category, (countByCategory.get(it.category) ?? 0) + 1);

  const shown = (activeCategory ? feed.items.filter((i) => i.category === activeCategory) : feed.items).slice(
    0,
    activeCategory ? CATEGORY_LIMIT : ALL_LIMIT
  );

  const failedSources = feed.sources.filter((s) => s.status === "error");
  const okSources = feed.sources.filter((s) => s.status === "ok").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-text">World News</h1>
      <p className="mb-2 mt-2 max-w-3xl text-sm text-text-dim">
        Live headlines from a curated set of {feed.sources.length} news wires, financial and business outlets, central
        banks, UN/multilateral agencies, and energy and commodity publications — newest first, each attributed to its
        publisher and linked to the original article.
      </p>
      <p className="mb-6 max-w-3xl text-xs text-text-dim/80">
        Sourced from each publisher&apos;s own RSS feed where one exists. Reuters, AP, Bloomberg, IMF, World Bank, OECD,
        FAO, IEA, ICIS, Argus, Chemical Week, Nikkei and NHK have no working public feed, so those come from
        Google News&apos; index restricted to the publisher&apos;s own domain. This does <strong>not</strong> read X
        (Twitter) — its API has no free read access — and the @handle shown is the outlet&apos;s account for
        reference, not where the item was read. Summaries are the feed&apos;s own text (blank where a feed supplies
        none), never AI-written; priority is a keyword rule (central-bank releases and terms like rate decision,
        sanctions, ceasefire, tariffs, default, or strike rank High) and tags are keyword matches — neither is an
        editorial judgment. Politicians&apos; and individual economists&apos; accounts can&apos;t be covered without X
        access.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/dashboard/world-news"
          className={`rounded border px-2.5 py-1 text-xs ${!activeCategory ? "border-accent text-accent" : "border-border text-text-dim hover:text-text"}`}
        >
          All ({feed.items.length})
        </Link>
        {NEWS_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/dashboard/world-news?cat=${encodeURIComponent(c)}`}
            className={`rounded border px-2.5 py-1 text-xs ${activeCategory === c ? "border-accent text-accent" : "border-border text-text-dim hover:text-text"}`}
          >
            {c} ({countByCategory.get(c) ?? 0})
          </Link>
        ))}
      </div>

      <section className="gfew-panel mb-4 p-4">
        {shown.length === 0 ? (
          <p className="text-xs text-text-dim">
            No items right now{activeCategory ? ` in ${activeCategory}` : ""} — the source feeds may be momentarily
            unreachable; try reloading shortly.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((it) => (
              <li key={it.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                    style={{ color: PRIORITY_COLOR[it.priority], border: `1px solid ${PRIORITY_COLOR[it.priority]}66` }}
                  >
                    {it.priority}
                  </span>
                  <div className="min-w-0">
                    <a
                      href={it.originalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-text hover:text-accent hover:underline"
                    >
                      {it.headline}
                    </a>
                    {it.summary && <p className="mt-0.5 text-xs text-text-dim">{it.summary}</p>}
                    <div className="mt-0.5 text-[11px] text-text-dim">
                      {it.sourceName}
                      {it.sourceHandle ? ` (${it.sourceHandle})` : ""} · {it.category} · {timeAgo(it.postedAt)}
                      {it.tags.length > 0 && <> · {it.tags.map((t) => `#${t}`).join(" ")}</>}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="mb-8 text-xs text-text-dim">
        <summary className="cursor-pointer hover:text-text">
          Source status — {okSources} of {feed.sources.length} feeds returned items
          {failedSources.length > 0 ? `, ${failedSources.length} unreachable` : ""} · fetched {timeAgo(feed.fetchedAt)}
        </summary>
        <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
          {feed.sources.map((s) => (
            <li key={s.key}>
              <span style={{ color: s.status === "ok" ? "#34c085" : s.status === "empty" ? "#8b96a8" : "#e05a4d" }}>●</span>{" "}
              {s.name} — {s.status === "error" ? `unreachable (${s.error})` : s.status === "empty" ? "nothing in its recency window" : `${s.count} items`}
            </li>
          ))}
        </ul>
      </details>

      <h2 className="mb-1 text-lg font-semibold text-text">Regional coverage</h2>
      <p className="mb-4 max-w-3xl text-xs text-text-dim/80">
        Separate from the curated feed above: recent articles from{" "}
        <a href="https://www.gdeltproject.org/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          GDELT
        </a>
        , a free, public global news-monitoring project, grouped by a plain keyword search per region — a readability
        grouping this app made, not an official classification, so a story can appear under more than one region.
      </p>

      {error && (
        <div className="gfew-panel mb-6 p-4">
          <p className="text-xs text-text-dim">
            Temporarily unavailable ({error}) — GDELT&apos;s public API rate-limited this request or is momentarily
            slow; that&apos;s expected occasionally on a free shared API, not a data error. Try reloading in a
            moment.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {regions.map(({ region, articles }) => (
          <section key={region.slug} className="gfew-panel p-4">
            <h3 className="mb-3 text-sm font-semibold text-text">{region.label}</h3>

            {articles.length === 0 && !error && (
              <p className="text-xs text-text-dim">No recent coverage matched in the last 2 days.</p>
            )}

            <ul className="space-y-2.5">
              {articles.map((a) => (
                <li key={a.url}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text hover:text-accent hover:underline"
                  >
                    {a.title}
                  </a>
                  <div className="mt-0.5 text-[11px] text-text-dim">
                    {a.domain}
                    {a.sourceCountry ? ` · ${a.sourceCountry}` : ""}
                    {a.language && a.language.toLowerCase() !== "english" ? ` · ${a.language}` : ""}
                    {a.seenAt ? ` · ${timeAgo(a.seenAt)}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
