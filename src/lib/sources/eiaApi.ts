import type { MetricPoint } from "../metrics/store";

/**
 * US Energy Information Administration — API v2. Free (email-registered key,
 * no approval wait), Tier 1 official US government source. Two datasets used
 * here, both verified live before wiring in:
 *
 *  - `international/data` — country-level petroleum production (activityId=1,
 *    productId=53 "Total petroleum and other liquids") and consumption
 *    (activityId=2, productId=54 "Refined petroleum products"), monthly,
 *    ~3-4 month publication lag. This is the real data behind the Country
 *    Energy Balance Engine's Import Dependency (spec §6, 10): (Consumption -
 *    Production) / Consumption.
 *  - `natural-gas/stor/wkly/data` — US Lower 48 states natural gas working
 *    underground storage (duoarea=R48), weekly, BCF. Closes the "natural gas
 *    storage" gap disclosed in the original energySystemicRisk.ts build.
 *
 * https://www.eia.gov/opendata/documentation.php
 */

const BASE_URL = "https://api.eia.gov/v2";

// Major producer + consumer countries per spec §5, using EIA's ISO3-based
// countryRegionId codes (verified live for a sample: SAU, CHN, USA, RUS, IND).
export const EIA_COUNTRIES: { code: string; slug: string }[] = [
  { code: "USA", slug: "us" },
  { code: "SAU", slug: "saudi_arabia" },
  { code: "RUS", slug: "russia" },
  { code: "CAN", slug: "canada" },
  { code: "IRQ", slug: "iraq" },
  { code: "ARE", slug: "uae" },
  { code: "IRN", slug: "iran" },
  { code: "KWT", slug: "kuwait" },
  { code: "QAT", slug: "qatar" },
  { code: "NOR", slug: "norway" },
  { code: "BRA", slug: "brazil" },
  { code: "AUS", slug: "australia" },
  { code: "CHN", slug: "china" },
  { code: "IND", slug: "india" },
  { code: "JPN", slug: "japan" },
  { code: "KOR", slug: "south_korea" },
];

type EiaRow = {
  period: string; // "YYYY-MM"
  countryRegionId: string;
  value: string | number | null;
};

type EiaDataResponse = {
  response?: { data?: EiaRow[] };
  error?: string;
};

async function eiaQuery(path: string, apiKey: string, params: Record<string, string | string[]>): Promise<EiaRow[]> {
  const url = new URL(`${BASE_URL}/${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`EIA ${path}: HTTP ${res.status}`);
  const json = (await res.json()) as EiaDataResponse;
  if (json.error) throw new Error(`EIA ${path}: ${json.error}`);
  return json.response?.data ?? [];
}

function countryOilQuery(apiKey: string, sinceIso: string, activityId: string, productId: string): Promise<EiaRow[]> {
  const startPeriod = sinceIso.slice(0, 7); // YYYY-MM
  return eiaQuery("international/data/", apiKey, {
    frequency: "monthly",
    "data[0]": "value",
    "facets[countryRegionId][]": EIA_COUNTRIES.map((c) => c.code),
    "facets[activityId][]": [activityId],
    "facets[productId][]": [productId],
    start: startPeriod,
    length: "5000",
  });
}

export async function fetchEiaCountryPetroleum(apiKey: string, sinceIso: string): Promise<MetricPoint[]> {
  const slugByCode = new Map(EIA_COUNTRIES.map((c) => [c.code, c.slug]));
  const [production, consumption] = await Promise.all([
    countryOilQuery(apiKey, sinceIso, "1", "53"),
    countryOilQuery(apiKey, sinceIso, "2", "54"),
  ]);

  const points: MetricPoint[] = [];
  const toPoints = (rows: EiaRow[], metricSuffix: string) => {
    for (const r of rows) {
      const slug = slugByCode.get(r.countryRegionId);
      const value = typeof r.value === "string" ? parseFloat(r.value) : r.value;
      if (!slug || value === null || value === undefined || Number.isNaN(value)) continue;
      points.push({
        metric_key: `energy.country.${slug}.${metricSuffix}`,
        observed_at: `${r.period}-01`,
        value,
        unit: "kbpd",
        source_key: "eia_api",
        source_tier: 1,
        frequency: "monthly",
      });
    }
  };
  toPoints(production, "oil_production");
  toPoints(consumption, "oil_consumption");
  return points;
}

export async function fetchEiaNaturalGasStorage(apiKey: string): Promise<MetricPoint[]> {
  const rows = await eiaQuery("natural-gas/stor/wkly/data/", apiKey, {
    frequency: "weekly",
    "data[0]": "value",
    "facets[duoarea][]": ["R48"],
    length: "5000",
  });
  const points: MetricPoint[] = [];
  for (const r of rows) {
    const value = typeof r.value === "string" ? parseFloat(r.value) : r.value;
    if (value === null || value === undefined || Number.isNaN(value)) continue;
    points.push({
      metric_key: "energy.us_natgas_storage",
      observed_at: r.period,
      value,
      unit: "bcf",
      source_key: "eia_api",
      source_tier: 1,
      frequency: "weekly",
    });
  }
  return points;
}
