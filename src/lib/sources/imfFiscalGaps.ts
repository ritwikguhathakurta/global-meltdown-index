import type { MetricPoint } from "../metrics/store";
import { budgetDeadline, pastDeadline } from "../pipeline/timeBudget";

/**
 * Patches two specific World Bank WDI coverage gaps in the EM Debt
 * structural bucket, using two of IMF's own databases — checked live, not
 * assumed, and used ONLY for the specific countries confirmed to have no
 * WDI data at all (this file never overrides a genuine WDI value).
 *
 * govt_debt_to_gdp: World Bank's WDI general-government-debt indicator
 * (GC.DOD.TOTL.GD.ZS) has no data at all for Indonesia, China, the
 * Philippines, Poland or the Czech Republic (checked directly against the
 * live API). IMF's Global Debt Database (GDD — free, no key; "190 advanced
 * economies, emerging market economies and low-income countries, dating
 * back to 1950") has a genuinely populated general-government-debt/GDP
 * series for exactly these five, verified live: China 88.3%, Indonesia
 * 40.2%, the Philippines 57.1%, Poland 55.3%, Czech Republic 43.0% (all
 * 2024) — all plausible against known fiscal positions.
 *
 * fiscal_balance_to_gdp: World Bank's WDI fiscal-balance indicator
 * (GC.NLD.TOTL.GD.ZS) has no data for China or Indonesia (checked
 * directly). IMF's World Economic Outlook database (WEO — free, no key)
 * has "Net lending/borrowing, general government, % of GDP" for both. WEO
 * is a projections database: any given vintage's most recent 1-2 years are
 * Fund staff estimates rather than closed government accounts, and it also
 * carries multi-year-ahead forecasts. To avoid quietly ingesting a pure
 * forward projection as if it were an observed fact, only observations at
 * least one full calendar year old are used here — still typically a
 * preliminary IMF estimate rather than final accounts, but never a
 * multi-year-out forecast.
 */

const GDD_BASE = "https://api.imf.org/external/sdmx/2.1/data/IMF.FAD,GDD,2.0.0";
const WEO_BASE = "https://api.imf.org/external/sdmx/2.1/data/IMF.RES,WEO,9.0.0";

const GOVT_DEBT_GAP_COUNTRIES = [
  { iso3: "IDN", key: "indonesia" },
  { iso3: "CHN", key: "china" },
  { iso3: "PHL", key: "philippines" },
  { iso3: "POL", key: "poland" },
  { iso3: "CZE", key: "czech_republic" },
];

const FISCAL_BALANCE_GAP_COUNTRIES = [
  { iso3: "CHN", key: "china" },
  { iso3: "IDN", key: "indonesia" },
];

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

function parseObsList(xml: string): { year: string; value: number }[] {
  const obsMatches = xml.match(/<Obs[^>]*\/>/g) ?? [];
  const out: { year: string; value: number }[] = [];
  for (const obs of obsMatches) {
    const year = obs.match(/TIME_PERIOD="(\d{4})"/)?.[1];
    const valueStr = obs.match(/OBS_VALUE="(-?[0-9.]+)"/)?.[1];
    if (!year || !valueStr) continue;
    const value = Number(valueStr);
    if (Number.isNaN(value)) continue;
    out.push({ year, value });
  }
  return out;
}

async function fetchGovtDebtGdd(iso3: string, countryKey: string): Promise<MetricPoint[]> {
  const url = `${GDD_BASE}/${iso3}.FL_S13_POGDP_PT.A?startPeriod=2015`;
  const res = await fetchWithRetry(url);
  const obs = parseObsList(await res.text());
  return obs.map((o) => ({
    metric_key: `emdebt.${countryKey}.govt_debt_to_gdp`,
    observed_at: `${o.year}-01-01`,
    value: o.value,
    unit: "% of GDP",
    source_key: "imf_gdd",
    source_tier: 1,
    frequency: "annual",
  }));
}

async function fetchFiscalBalanceWeo(iso3: string, countryKey: string): Promise<MetricPoint[]> {
  const url = `${WEO_BASE}/${iso3}.GGXCNL_NGDP.A?startPeriod=2015`;
  const res = await fetchWithRetry(url);
  const obs = parseObsList(await res.text());
  const cutoffYear = new Date().getUTCFullYear() - 1;
  return obs
    .filter((o) => Number(o.year) <= cutoffYear)
    .map((o) => ({
      metric_key: `emdebt.${countryKey}.fiscal_balance_to_gdp`,
      observed_at: `${o.year}-01-01`,
      value: o.value,
      unit: "% of GDP",
      source_key: "imf_weo",
      source_tier: 1,
      frequency: "annual",
    }));
}

export async function fetchImfFiscalGapFillers(): Promise<MetricPoint[]> {
  const results: MetricPoint[] = [];
  const deadline = budgetDeadline(80_000);
  for (const c of GOVT_DEBT_GAP_COUNTRIES) {
    if (pastDeadline(deadline)) {
      console.error(`IMF GDD govt debt: stopping early at time budget, ${c.key} and later skipped this run`);
      break;
    }
    try {
      results.push(...(await fetchGovtDebtGdd(c.iso3, c.key)));
    } catch (e) {
      console.error(`IMF GDD govt debt (${c.key}): ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  for (const c of FISCAL_BALANCE_GAP_COUNTRIES) {
    if (pastDeadline(deadline)) {
      console.error(`IMF WEO fiscal balance: stopping early at time budget, ${c.key} and later skipped this run`);
      break;
    }
    try {
      results.push(...(await fetchFiscalBalanceWeo(c.iso3, c.key)));
    } catch (e) {
      console.error(`IMF WEO fiscal balance (${c.key}): ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}
