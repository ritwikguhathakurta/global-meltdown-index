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
 */
const LISTING_URL = "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx";
const HEADERS = { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" };

function extractFormValue(html: string, name: string): string {
  const re = new RegExp(`name="${name}"[^>]*value="([^"]*)"`);
  return html.match(re)?.[1] ?? "";
}

export async function fetchRbiCurrentListingHtml(): Promise<string> {
  const res = await fetch(LISTING_URL, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`RBI press release listing: HTTP ${res.status}`);
  return res.text();
}

export async function fetchRbiArchiveYearHtml(year: number): Promise<string> {
  const initial = await fetch(LISTING_URL, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
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
  const res = await fetch(LISTING_URL, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies },
    body: body.toString(),
    signal: AbortSignal.timeout(20000),
  });
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
  const res = await fetch(`${LISTING_URL}?prid=${prid}`, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
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
