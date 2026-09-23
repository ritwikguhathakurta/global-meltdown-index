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
 * domain timed out from the pipeline for weeks despite rbi.org.in itself
 * responding in 1.3-2.6s from a normal network. A browser-like User-Agent
 * was tried first (matching the documented WAF-quirk pattern in
 * bpsIndonesia.ts/mpobMalaysia.ts) and did NOT fix it. An IP-range-block
 * theory was tried next and was directly disproved: a standalone diagnostic
 * route hitting this exact function from the actual Vercel production
 * environment returned in 3.8s, no block. The real fix was simpler than
 * either theory — the original 15-20s per-fetch timeouts were just
 * genuinely too tight for this specific server on a bad day (confirmed:
 * after widening to 45-60s below, a real pipeline run succeeded end to end,
 * 20 + 299 real points). Don't re-tighten these back down without a live
 * re-test; don't re-attempt a header/UA change for this domain — both
 * plausible-looking theories before this one turned out wrong.
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
