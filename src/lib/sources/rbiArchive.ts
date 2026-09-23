/**
 * Shared helpers for reading the Reserve Bank of India's press-release
 * archive at rbi.org.in — used by both rbiLiquidity.ts (daily Money Market
 * Operations) and rbiYieldCurve.ts (T-Bill/G-Sec auction results).
 *
 * The listing page's default view only shows the last few weeks. Real
 * historical depth (needed for e.g. seeing more than one Diwali/fiscal
 * year-end cycle) requires its own year/month archive, which is a genuine,
 * publicly-advertised feature of the page itself (an accordion of year/month
 * links) — not a bypass of anything. It's wired to a plain "GetYearMonth"
 * JS handler that sets two hidden fields and clicks a hidden submit button,
 * i.e. a classic ASP.NET WebForms postback (hidden __VIEWSTATE /
 * __EVENTVALIDATION fields plus the session cookie from the initial GET),
 * so reaching it programmatically means replicating that same postback
 * rather than following a query-string link. Verified directly: the
 * response is a normal 200 HTML page with the requested year's releases
 * (not a CAPTCHA/challenge page), and passing month="0" returns the WHOLE
 * YEAR (~350-450 releases) in one request, which is what this uses — far
 * cheaper than one request per month.
 *
 * TIMEOUT HISTORY — read before touching this again: every fetch to this
 * domain has timed out from the pipeline for weeks. A browser-like
 * User-Agent was tried first (matching the documented WAF-quirk pattern in
 * bpsIndonesia.ts/mpobMalaysia.ts) and DID NOT fix it — re-verified live in
 * this same session: rbi.org.in responds in 1.3-2.6s when hit directly
 * (with or without a browser UA) from a normal network, yet the exact same
 * URL still times out from the Vercel pipeline after that UA change shipped.
 * A header can't explain "fast from anywhere else, hangs specifically from
 * one cloud platform" — the much more likely cause is RBI blocking Vercel's
 * outbound IP ranges at the network level (a common pattern for Indian
 * government sites against cloud-provider ASNs), which manifests as a
 * connection that never completes (hence a timeout, not a fast 403) and
 * which no request header can work around. The timeouts below were
 * widened from 15-20s to a more patient 45-60s as a genuine test of the
 * competing "just slow from this network path" hypothesis — check
 * pipeline_runs after a real run for whether this is now succeeding,
 * still timing out (supports the IP-block theory — see AGENTS/CLAUDE.md
 * before attempting yet another header/UA change, which is very unlikely
 * to be the actual lever here), or failing with a different, more specific
 * error (would newly rule in/out other causes).
 */
const LISTING_URL = "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA };
const FETCH_TIMEOUT_MS = 45000;
const POST_TIMEOUT_MS = 60000;

function extractFormValue(html: string, name: string): string {
  const re = new RegExp(`name="${name}"[^>]*value="([^"]*)"`);
  return html.match(re)?.[1] ?? "";
}

/** Wraps a fetch failure with the elapsed time and the underlying error's
 * own name/cause (not just its message) — a timeout, a DNS failure and a
 * connection reset all currently collapse into the same generic message,
 * which is exactly what made the wrong root cause (WAF/UA) look plausible
 * for as long as it did. Real error detail lands in pipeline_runs.detail. */
async function timedFetch(url: string, init: RequestInit, timeoutMs: number, label: string): Promise<Response> {
  const startedAt = Date.now();
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    const elapsedMs = Date.now() - startedAt;
    throw new Error(`${label}: ${err.name}: ${err.message} (cause: ${err.cause ?? "none"}, elapsed ${elapsedMs}ms of ${timeoutMs}ms budget)`);
  }
}

export async function fetchRbiCurrentListingHtml(): Promise<string> {
  const res = await timedFetch(LISTING_URL, { headers: HEADERS }, FETCH_TIMEOUT_MS, "RBI press release listing");
  if (!res.ok) throw new Error(`RBI press release listing: HTTP ${res.status}`);
  return res.text();
}

export async function fetchRbiArchiveYearHtml(year: number): Promise<string> {
  const initial = await timedFetch(LISTING_URL, { headers: HEADERS }, FETCH_TIMEOUT_MS, `RBI archive (${year}): initial GET`);
  if (!initial.ok) throw new Error(`RBI archive (${year}): initial GET HTTP ${initial.status}`);
  const initialHtml = await initial.text();
  const cookies = (initial.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

  const body = new URLSearchParams({
    __VIEWSTATE: extractFormValue(initialHtml, "__VIEWSTATE"),
    __VIEWSTATEGENERATOR: extractFormValue(initialHtml, "__VIEWSTATEGENERATOR"),
    __EVENTVALIDATION: extractFormValue(initialHtml, "__EVENTVALIDATION"),
    hdnYear: String(year),
    hdnMonth: "0",
    "UsrFontCntr$btn": "",
  });
  const res = await timedFetch(
    LISTING_URL,
    { method: "POST", headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies }, body: body.toString() },
    POST_TIMEOUT_MS,
    `RBI archive (${year}): POST`
  );
  if (!res.ok) throw new Error(`RBI archive (${year}): POST HTTP ${res.status}`);
  return res.text();
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchReleaseText(prid: string): Promise<string> {
  const res = await timedFetch(`${LISTING_URL}?prid=${prid}`, { headers: HEADERS }, FETCH_TIMEOUT_MS, `RBI release ${prid}`);
  if (!res.ok) throw new Error(`RBI release ${prid}: HTTP ${res.status}`);
  return stripHtml(await res.text());
}

export function discoverPrids(html: string, titleExact: string): string[] {
  const escaped = titleExact.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`href=BS_PressReleaseDisplay\\.aspx\\?prid=(\\d+)>${escaped}<`, "g");
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.add(m[1]);
  return [...out];
}

/** Small concurrency-limited map — polite to a single public server, but fast enough to backfill years of history in one pipeline run. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R | null>
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const r = await fn(items[idx]).catch(() => null);
      if (r !== null) results.push(r);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
