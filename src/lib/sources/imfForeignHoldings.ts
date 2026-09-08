import type { MetricPoint } from "../metrics/store";
import { EM_DEBT_COUNTRIES } from "./worldBankEmDebt";

/**
 * Foreign holdings of local debt securities, from the IMF's Portfolio
 * Investment Positions by Counterpart Economy dataset (PIP, formerly CPIS)
 * — free, no-key, documented SDMX API (data.imf.org/en/Resource-Pages/IMF-API).
 *
 * This is the "foreign ownership of local bonds" component this engine
 * previously declined to build (see emDebtRegime.ts's original comment),
 * on the grounds that CPIS/PIP participation is voluntary with known gaps
 * among major non-Western creditors. That concern is real, but verified
 * live it argues for disclosure, not exclusion: querying debt-securities
 * Assets positions with a single tracked economy as COUNTERPART_COUNTRY
 * returns one <Series> per REPORTING (creditor) economy that voluntarily
 * submitted data — 64-75 reporting economies per tracked country as of the
 * 2023 vintage, summing to plausible, sanity-checked totals (e.g. India
 * $79.1bn with a realistic concentration in known FPI-routing jurisdictions
 * — Singapore, Mauritius — matching independently known patterns in Indian
 * portfolio-flow data; China $561.9bn, Korea $224.6bn, all consistent with
 * known market sizes).
 *
 * The risk signal this engine actually uses downstream (see
 * emDebtRegime.ts) is the YEAR-OVER-YEAR CHANGE in this aggregate, not its
 * absolute level — a declining aggregate reads as foreign investors
 * reducing exposure (the spec's "foreign-investor exit pressure"). This is
 * far more robust to a persistently-incomplete reporter set than the level
 * would be, since whichever creditors don't report are typically missing
 * in both years being compared.
 *
 * Annual, published with a real lag (the 2023 end-year vintage was the
 * latest complete one available at the time this was built) — not a live
 * feed, disclosed as such wherever it's used. Multiple years are ingested
 * per run (not just the latest) specifically so the YoY comparison has
 * real history to work from once the pipeline has run more than once.
 */

const PIP_BASE = "https://api.imf.org/external/sdmx/2.1/data/IMF.STA,PIP,5.0.0";

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        const res = await fetch(url, { headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" }, next: { revalidate: 0 }, signal: controller.signal });
        if (res.ok) return res;
        lastError = new Error(`HTTP ${res.status}`);
      } finally {
        clearTimeout(timeout);
      }
    } catch (e) {
      lastError = e;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// The IMF SDMX API returns structure-specific XML (not JSON, regardless of
// Accept header — verified directly). Each <Series> is one reporting
// (creditor) economy's holdings of the target economy's debt securities;
// summing OBS_VALUE across all series for a given year gives the aggregate
// foreign-held total for that year, across however many economies actually
// reported.
function sumObsByYear(xml: string): Map<string, number> {
  const totals = new Map<string, number>();
  const seriesBlocks = xml.match(/<Series[\s\S]*?<\/Series>/g) ?? [];
  for (const block of seriesBlocks) {
    const obsMatches = block.match(/<Obs[^>]*\/>/g) ?? [];
    for (const obs of obsMatches) {
      const period = obs.match(/TIME_PERIOD="(\d{4})"/)?.[1];
      const valueStr = obs.match(/OBS_VALUE="(-?[0-9.]+)"/)?.[1];
      if (!period || !valueStr) continue;
      const value = Number(valueStr);
      if (Number.isNaN(value)) continue;
      totals.set(period, (totals.get(period) ?? 0) + value);
    }
  }
  return totals;
}

async function fetchForeignHoldingsForCountry(iso3: string, countryKey: string): Promise<MetricPoint[]> {
  const currentYear = new Date().getUTCFullYear();
  // SECTOR=S1, COUNTERPART_SECTOR=S1 = "Total economy" on both sides — the
  // codelist's aggregate total, not a wildcard (confirmed live: a blank/"_T"
  // segment here returns nothing, "S1" is the actual populated total code).
  const url = `${PIP_BASE}/.A.P_F3_P_USD.S1.S1.${iso3}.A?startPeriod=${currentYear - 8}`;
  const res = await fetchWithRetry(url);
  const xml = await res.text();
  const totalsByYear = sumObsByYear(xml);

  const points: MetricPoint[] = [];
  for (const [year, total] of totalsByYear) {
    if (total <= 0) continue;
    points.push({
      metric_key: `emdebt.${countryKey}.foreign_holdings_debt_usd`,
      observed_at: `${year}-12-31`,
      value: total,
      unit: "USD",
      source_key: "imf_pip",
      source_tier: 1,
      frequency: "annual",
      raw: { counterpartCountry: iso3, note: "summed across all voluntary PIP reporting economies" },
    });
  }
  return points;
}

export async function fetchImfForeignHoldings(): Promise<MetricPoint[]> {
  const results: MetricPoint[] = [];
  for (const c of EM_DEBT_COUNTRIES) {
    try {
      const points = await fetchForeignHoldingsForCountry(c.iso3, c.key);
      results.push(...points);
    } catch (e) {
      console.error(`IMF PIP foreign holdings (${c.key}): ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}
