import type { MetricPoint } from "../metrics/store";

/**
 * Three genuinely new data points for the G7 Sovereign Debt engine, on top of
 * what's already flowing into the existing Treasury & Sovereign engine
 * (10Y/30Y yields and debt/GDP for all seven — see treasury.ts and
 * govBondYields.ts, reused directly by g7DebtRegime.ts rather than re-fetched
 * here):
 *
 * fiscal_balance_to_gdp: no existing source in this project tracks general-
 * government fiscal balance for ANY G7 country. IMF's World Economic Outlook
 * database (WEO — free, no key) has "Net lending/borrowing, general
 * government, % of GDP" for all seven. WEO mixes historical actuals with
 * multi-year-ahead forecasts in the same series with no reliable status flag
 * — capped to observations at least one full calendar year old to avoid
 * ingesting a pure forward projection as an observed fact (same discipline
 * already applied to the EM Debt engine's own WEO gap-filler, see
 * imfFiscalGaps.ts).
 *
 * govt_debt_to_gdp for France specifically: checked directly — this project's
 * existing FRED-sourced sovereign.*_debt_to_gdp series (see fred.ts) covers
 * US/Germany/Italy/Japan/UK/Canada but has no French series at all (FRED
 * simply doesn't carry one). IMF's Global Debt Database (GDD — free, no key)
 * has genuine general-government-debt/GDP data for France, so it fills this
 * one specific gap; the other six G7 countries keep reading their existing
 * FRED-sourced values unchanged.
 *
 * gdp_current_usd: not itself a risk ratio — fetched only as the size weight
 * for the GDP-weighted G7 composite (the spec's own requirement that "US and
 * Japan must have higher global transmission weight than smaller G7
 * economies" rather than a flat 7-way average). World Bank Open Data
 * (api.worldbank.org, free, no key), same product already used for EM Debt.
 */

const GDD_BASE = "https://api.imf.org/external/sdmx/2.1/data/IMF.FAD,GDD,2.0.0";
const WEO_BASE = "https://api.imf.org/external/sdmx/2.1/data/IMF.RES,WEO,9.0.0";

export type G7Country = { iso3: string; key: string; name: string; currency: string; centralBank: string };

export const G7_COUNTRIES: G7Country[] = [
  { iso3: "USA", key: "us", name: "United States", currency: "USD", centralBank: "Federal Reserve" },
  { iso3: "JPN", key: "japan", name: "Japan", currency: "JPY", centralBank: "Bank of Japan" },
  { iso3: "DEU", key: "germany", name: "Germany", currency: "EUR", centralBank: "ECB" },
  { iso3: "FRA", key: "france", name: "France", currency: "EUR", centralBank: "ECB" },
  { iso3: "ITA", key: "italy", name: "Italy", currency: "EUR", centralBank: "ECB" },
  { iso3: "GBR", key: "uk", name: "United Kingdom", currency: "GBP", centralBank: "Bank of England" },
  { iso3: "CAN", key: "canada", name: "Canada", currency: "CAD", centralBank: "Bank of Canada" },
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

async function fetchFiscalBalanceWeo(iso3: string, countryKey: string): Promise<MetricPoint[]> {
  const url = `${WEO_BASE}/${iso3}.GGXCNL_NGDP.A?startPeriod=2015`;
  const res = await fetchWithRetry(url);
  const obs = parseObsList(await res.text());
  const cutoffYear = new Date().getUTCFullYear() - 1;
  return obs
    .filter((o) => Number(o.year) <= cutoffYear)
    .map((o) => ({
      metric_key: `g7.${countryKey}.fiscal_balance_to_gdp`,
      observed_at: `${o.year}-01-01`,
      value: o.value,
      unit: "% of GDP",
      source_key: "imf_weo",
      source_tier: 1,
      frequency: "annual" as const,
    }));
}

async function fetchFranceGovtDebtGdd(): Promise<MetricPoint[]> {
  const url = `${GDD_BASE}/FRA.FL_S13_POGDP_PT.A?startPeriod=2015`;
  const res = await fetchWithRetry(url);
  const obs = parseObsList(await res.text());
  return obs.map((o) => ({
    metric_key: "g7.france.govt_debt_to_gdp",
    observed_at: `${o.year}-01-01`,
    value: o.value,
    unit: "% of GDP",
    source_key: "imf_gdd",
    source_tier: 1,
    frequency: "annual" as const,
  }));
}

type WbObservation = { countryiso3code: string; date: string; value: number | null };

async function fetchG7Gdp(): Promise<MetricPoint[]> {
  const iso3List = G7_COUNTRIES.map((c) => c.iso3).join(";");
  const iso3ToKey = new Map(G7_COUNTRIES.map((c) => [c.iso3, c.key]));
  const currentYear = new Date().getUTCFullYear();
  const url = `https://api.worldbank.org/v2/country/${iso3List}/indicator/NY.GDP.MKTP.CD?format=json&per_page=200&date=2015:${currentYear}`;
  const res = await fetchWithRetry(url);
  const json = (await res.json()) as [unknown, WbObservation[] | null];
  const rows = json[1] ?? [];

  const latestByCountry = new Map<string, WbObservation>();
  for (const row of rows) {
    if (row.value === null) continue;
    const existing = latestByCountry.get(row.countryiso3code);
    if (!existing || row.date > existing.date) latestByCountry.set(row.countryiso3code, row);
  }

  const points: MetricPoint[] = [];
  for (const [iso3, row] of latestByCountry) {
    const countryKey = iso3ToKey.get(iso3);
    if (!countryKey) continue;
    points.push({
      metric_key: `g7.${countryKey}.gdp_current_usd`,
      observed_at: `${row.date}-01-01`,
      value: row.value as number,
      unit: "USD",
      source_key: "world_bank",
      source_tier: 1,
      frequency: "annual",
    });
  }
  return points;
}

export async function fetchG7FiscalData(): Promise<MetricPoint[]> {
  const results: MetricPoint[] = [];
  for (const c of G7_COUNTRIES) {
    try {
      results.push(...(await fetchFiscalBalanceWeo(c.iso3, c.key)));
    } catch (e) {
      console.error(`IMF WEO G7 fiscal balance (${c.key}): ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  try {
    results.push(...(await fetchFranceGovtDebtGdd()));
  } catch (e) {
    console.error(`IMF GDD France govt debt: ${(e as Error).message}`);
  }
  await new Promise((r) => setTimeout(r, 300));
  try {
    results.push(...(await fetchG7Gdp()));
  } catch (e) {
    console.error(`World Bank G7 GDP: ${(e as Error).message}`);
  }
  return results;
}
