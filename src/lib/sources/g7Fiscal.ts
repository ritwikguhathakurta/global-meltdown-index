import type { MetricPoint } from "../metrics/store";
import { budgetDeadline, pastDeadline } from "../pipeline/timeBudget";
import { fetchWorkbookSheet } from "./xlsWorkbook";
import { parseSnapshotDate } from "./sovereignRiskPremium";

/**
 * Six genuinely new data points for the G7 Sovereign Debt engine, on top of
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
 *
 * real_gdp_growth / current_account_to_gdp: World Bank Open Data again
 * (NY.GDP.MKTP.KD.ZG, BN.CAB.XOKA.GD.ZS) — verified live with real, current
 * (2025) values for all seven countries. Both feed structuralScore in
 * g7DebtRegime.ts exactly as they already do for EM Debt (growth affects
 * debt-dynamics sustainability via r-g; current-account deficits signal
 * external financing need), same weights as the EM Debt engine uses for the
 * same two indicators.
 *
 * sovereign_cds_10y: the same free Damodaran/NYU Stern "Country Risk
 * Premiums" workbook already used for EM Debt (see sovereignRiskPremium.ts)
 * — verified live to carry real, distinct 10-year CDS spreads for all seven
 * G7 sovereigns too (e.g. Germany ~21bps, Italy ~61bps, US ~44bps as of the
 * 12/31/25 snapshot), not just emerging markets. Same single-annual-snapshot
 * caveat applies: no intra-year "CDS acceleration" signal is computed.
 */

const GDD_BASE = "https://api.imf.org/external/sdmx/2.1/data/IMF.FAD,GDD,2.0.0";
const WEO_BASE = "https://api.imf.org/external/sdmx/2.1/data/IMF.RES,WEO,9.0.0";
const DAMODARAN_URL = "https://www.stern.nyu.edu/~adamodar/pc/datasets/ctryprem.xlsx";

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

/** Shared World Bank fetch for the three whole-G7-at-once indicators (GDP
 * level, real GDP growth, current account/GDP) — one request covers all
 * seven countries since World Bank's API accepts a ";"-joined iso3 list. */
async function fetchG7WorldBankIndicator(wbCode: string, metricSuffix: string, unit: string): Promise<MetricPoint[]> {
  const iso3List = G7_COUNTRIES.map((c) => c.iso3).join(";");
  const iso3ToKey = new Map(G7_COUNTRIES.map((c) => [c.iso3, c.key]));
  const currentYear = new Date().getUTCFullYear();
  const url = `https://api.worldbank.org/v2/country/${iso3List}/indicator/${wbCode}?format=json&per_page=200&date=2015:${currentYear}`;
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
      metric_key: `g7.${countryKey}.${metricSuffix}`,
      observed_at: `${row.date}-01-01`,
      value: row.value as number,
      unit,
      source_key: "world_bank",
      source_tier: 1,
      frequency: "annual",
    });
  }
  return points;
}

async function fetchG7Gdp(): Promise<MetricPoint[]> {
  return fetchG7WorldBankIndicator("NY.GDP.MKTP.CD", "gdp_current_usd", "USD");
}

async function fetchG7RealGdpGrowth(): Promise<MetricPoint[]> {
  return fetchG7WorldBankIndicator("NY.GDP.MKTP.KD.ZG", "real_gdp_growth", "%");
}

async function fetchG7CurrentAccount(): Promise<MetricPoint[]> {
  return fetchG7WorldBankIndicator("BN.CAB.XOKA.GD.ZS", "current_account_to_gdp", "% of GDP");
}

// Exact country-name strings as they appear in Damodaran's own sheet —
// verified directly against a live download, matching G7_COUNTRIES.name.
const G7_CDS_SHEET_NAMES: Record<string, string> = {
  us: "United States",
  japan: "Japan",
  germany: "Germany",
  france: "France",
  italy: "Italy",
  uk: "United Kingdom",
  canada: "Canada",
};

async function fetchG7SovereignCds(): Promise<MetricPoint[]> {
  const rows = await fetchWorkbookSheet(DAMODARAN_URL, "10-year CDS Spreads");
  const header = rows[0] as string[];
  const cdsColIndex = header.findIndex((h) => typeof h === "string" && h.startsWith("CDS Spread ("));
  if (cdsColIndex === -1) throw new Error("Damodaran ctryprem.xlsx: CDS Spread column not found (header format may have changed)");
  const observedAt = parseSnapshotDate(header[cdsColIndex]);
  if (!observedAt) throw new Error(`Damodaran ctryprem.xlsx: could not parse snapshot date from header "${header[cdsColIndex]}"`);

  const nameToKey = new Map(Object.entries(G7_CDS_SHEET_NAMES).map(([key, name]) => [name, key]));
  const points: MetricPoint[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as (string | number)[];
    const countryKey = nameToKey.get(String(row[0] ?? "").trim());
    if (!countryKey) continue;
    const raw = row[cdsColIndex];
    if (typeof raw !== "number") continue; // "NA" or blank — no quoted CDS for this country

    points.push({
      metric_key: `g7.${countryKey}.sovereign_cds_10y`,
      observed_at: observedAt,
      value: Math.round(raw * 10000 * 100) / 100, // stored as decimal (0.0044) -> bps (44)
      unit: "bps",
      source_key: "damodaran_nyu",
      source_tier: 2,
      frequency: "annual",
      raw: { source_file: "ctryprem.xlsx", sheet: "10-year CDS Spreads" },
    });
  }
  return points;
}

export async function fetchG7FiscalData(): Promise<MetricPoint[]> {
  const results: MetricPoint[] = [];
  const deadline = budgetDeadline(80_000);
  for (const c of G7_COUNTRIES) {
    if (pastDeadline(deadline)) {
      console.error(`G7 fiscal data: stopping early at time budget, ${c.key} and later skipped this run`);
      break;
    }
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
  await new Promise((r) => setTimeout(r, 300));
  try {
    results.push(...(await fetchG7RealGdpGrowth()));
  } catch (e) {
    console.error(`World Bank G7 real GDP growth: ${(e as Error).message}`);
  }
  await new Promise((r) => setTimeout(r, 300));
  try {
    results.push(...(await fetchG7CurrentAccount()));
  } catch (e) {
    console.error(`World Bank G7 current account/GDP: ${(e as Error).message}`);
  }
  await new Promise((r) => setTimeout(r, 300));
  try {
    results.push(...(await fetchG7SovereignCds()));
  } catch (e) {
    console.error(`Damodaran G7 sovereign CDS: ${(e as Error).message}`);
  }
  return results;
}
