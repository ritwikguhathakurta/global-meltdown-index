import { fetchWorldNews } from "@/lib/sources/gdeltNews";

// Six staggered GDELT calls (see gdeltNews.ts) are too slow/unreliable for
// Next.js's one-time build-time prerender attempt to tolerate — force this
// route to only ever render per-request on the deployed server, never
// during `next build`.
export const dynamic = "force-dynamic";
// Generous safety margin above the ~12s worst-case (6 regions x 1.2s stagger
// + one 6s request) — comfortably within the Hobby-plan ceiling.
export const maxDuration = 60;

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

export default async function WorldNewsPage() {
  const results = await fetchWorldNews();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-text">World News</h1>
      <p className="mb-2 mt-2 max-w-3xl text-sm text-text-dim">
        Real, live headlines from the last 2 days, pulled directly from{" "}
        <a href="https://www.gdeltproject.org/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          GDELT
        </a>{" "}
        — a free, public, no-API-key global news-monitoring project that has indexed worldwide broadcast, print, and
        web news since 2015.
      </p>
      <p className="mb-6 max-w-3xl text-xs text-text-dim/80">
        Grouped below by a plain keyword search per region — a readability grouping this app made, not an official
        GDELT or press classification. This is raw headline aggregation, not AI-synthesized analysis or editorial
        curation; click through to the publisher for the full story. A region shows &ldquo;temporarily
        unavailable&rdquo; if GDELT&apos;s public API rate-limited this request — that&apos;s expected occasionally
        on a free shared API, not a data error, and clears up on the next load.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {results.map(({ region, articles, error }) => (
          <section key={region.slug} className="gfew-panel p-4">
            <h2 className="mb-3 text-sm font-semibold text-text">{region.label}</h2>

            {articles.length === 0 && error && (
              <p className="text-xs text-text-dim">Temporarily unavailable ({error}) — try reloading in a moment.</p>
            )}
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
