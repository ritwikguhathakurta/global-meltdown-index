import type { MetricPoint } from "../metrics/store";

/**
 * World Bank Open Data API (api.worldbank.org) — free, no key, official multilateral
 * source (World Development Indicators + International Debt Statistics). Verified
 * live and returns real, current figures (e.g. Turkey's short-term external debt was
 * 114.5% of reserves as of the 2024 observation — short-term FX obligations exceeding
 * total reserves, a genuine rollover-risk red flag).
 *
 * This is the backbone of the EM Debt engine's structural-vulnerability side, replacing
 * the old FX-only approach: government debt/GDP, external debt/GNI, external debt
 * service/exports, short-term external debt/reserves, reserve adequacy (months of
 * imports), current-account/GDP, real GDP growth, and (best-effort — see below) the
 * fiscal balance. Multi-country batch requests (semicolon-separated ISO3 codes) work
 * and are used to keep this to 8 requests per pipeline run instead of 8×14=112.
 *
 * All 8 series are annual — WDI's structural/BOP-derived indicators are published
 * with a real 1-2 year lag, not withheld or under-fetched. freshnessFor's annual
 * thresholds and last_verified_at (see indicator.ts) already account for this: a
 * genuinely old reference year that we keep successfully re-confirming reads as
 * current, not stale.
 *
 * Not every country publishes every series every year (fiscal-balance data in
 * particular — GC.NLD.TOTL.GD.ZS — has real gaps for several EM economies in WDI).
 * Missing observations are simply omitted here, not backfilled or estimated; the
 * engine marks that specific indicator UNAVAILABLE for that country rather than
 * guessing.
 */

export type EmDebtCountry = { iso3: string; key: string; name: string };

export const EM_DEBT_COUNTRIES: EmDebtCountry[] = [
  { iso3: "BRA", key: "brazil", name: "Brazil" },
  { iso3: "MEX", key: "mexico", name: "Mexico" },
  { iso3: "ZAF", key: "south_africa", name: "South Africa" },
  { iso3: "TUR", key: "turkey", name: "Turkey" },
  { iso3: "IND", key: "india", name: "India" },
  { iso3: "IDN", key: "indonesia", name: "Indonesia" },
  { iso3: "CHN", key: "china", name: "China" },
  { iso3: "PHL", key: "philippines", name: "Philippines" },
  { iso3: "POL", key: "poland", name: "Poland" },
  { iso3: "HUN", key: "hungary", name: "Hungary" },
  { iso3: "CZE", key: "czech_republic", name: "Czech Republic" },
  { iso3: "THA", key: "thailand", name: "Thailand" },
  { iso3: "MYS", key: "malaysia", name: "Malaysia" },
  { iso3: "KOR", key: "south_korea", name: "South Korea" },
];

type WbIndicatorDef = { code: string; metricSuffix: string; unit: string };

export const WB_EM_DEBT_INDICATORS: WbIndicatorDef[] = [
  { code: "GC.DOD.TOTL.GD.ZS", metricSuffix: "govt_debt_to_gdp", unit: "% of GDP" },
  { code: "NY.GDP.MKTP.KD.ZG", metricSuffix: "real_gdp_growth", unit: "%" },
  { code: "DT.DOD.DECT.GN.ZS", metricSuffix: "external_debt_to_gni", unit: "% of GNI" },
  { code: "DT.TDS.DECT.EX.ZS", metricSuffix: "external_debt_service_to_exports", unit: "% of exports" },
  { code: "DT.DOD.DSTC.IR.ZS", metricSuffix: "short_term_debt_to_reserves", unit: "% of reserves" },
  { code: "FI.RES.TOTL.MO", metricSuffix: "reserves_months_imports", unit: "months" },
  { code: "BN.CAB.XOKA.GD.ZS", metricSuffix: "current_account_to_gdp", unit: "% of GDP" },
  { code: "GC.NLD.TOTL.GD.ZS", metricSuffix: "fiscal_balance_to_gdp", unit: "% of GDP" },
];

const ISO3_LIST = EM_DEBT_COUNTRIES.map((c) => c.iso3).join(";");
const ISO3_TO_KEY = new Map(EM_DEBT_COUNTRIES.map((c) => [c.iso3, c.key]));

type WbObservation = {
  countryiso3code: string;
  date: string;
  value: number | null;
};

// The World Bank API intermittently hangs or times out on an otherwise-valid
// request, then answers the identical request instantly seconds later (verified
// directly, repeatedly, while building this) — a transient rate-limit/backend
// issue, not a bad indicator code. Retried with a hard per-attempt timeout
// rather than letting one flaky call block the whole pipeline run.
async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch(url, { next: { revalidate: 0 }, signal: controller.signal });
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

async function fetchWbIndicator(def: WbIndicatorDef): Promise<MetricPoint[]> {
  const currentYear = new Date().getUTCFullYear();
  const url = `https://api.worldbank.org/v2/country/${ISO3_LIST}/indicator/${def.code}?format=json&per_page=500&date=2015:${currentYear}`;
  const res = await fetchWithRetry(url);
  const json = (await res.json()) as [unknown, WbObservation[] | null];
  const rows = json[1] ?? [];

  // WDI returns every requested year per country, mostly null until published —
  // keep only the latest non-null observation per country for this indicator.
  const latestByCountry = new Map<string, WbObservation>();
  for (const row of rows) {
    if (row.value === null) continue;
    const existing = latestByCountry.get(row.countryiso3code);
    if (!existing || row.date > existing.date) latestByCountry.set(row.countryiso3code, row);
  }

  const points: MetricPoint[] = [];
  for (const [iso3, row] of latestByCountry) {
    const countryKey = ISO3_TO_KEY.get(iso3);
    if (!countryKey) continue;
    points.push({
      metric_key: `emdebt.${countryKey}.${def.metricSuffix}`,
      observed_at: `${row.date}-01-01`,
      value: row.value as number,
      unit: def.unit,
      source_key: "world_bank",
      source_tier: 1,
      frequency: "annual",
      raw: { indicator: def.code, iso3 },
    });
  }
  return points;
}

export async function fetchWorldBankEmDebtIndicators(): Promise<MetricPoint[]> {
  const results: MetricPoint[] = [];
  for (const def of WB_EM_DEBT_INDICATORS) {
    // Sequential with a short pause between calls — the World Bank API rate-limits
    // rapid bursts (confirmed directly: back-to-back requests intermittently hang or
    // time out, then work fine seconds later with no other change).
    const points = await fetchWbIndicator(def);
    results.push(...points);
    await new Promise((r) => setTimeout(r, 400));
  }
  return results;
}
