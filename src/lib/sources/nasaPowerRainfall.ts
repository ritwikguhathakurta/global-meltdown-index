import type { MetricPoint } from "../metrics/store";

/**
 * NASA POWER (Prediction Of Worldwide Energy Resources) — free, no key, no
 * login. Point-based monthly precipitation from NASA's MERRA-2 reanalysis,
 * 1981-present, via a plain REST API (no raster/GIS processing needed,
 * unlike CHIRPS/AgERA5's gridded NetCDF/GeoTIFF products, which this app
 * has no infrastructure to process).
 *
 * Oilseeds engine spec §29-31 — one representative point per major
 * Malaysia/Indonesia oil-palm-growing region. This is a raw regional
 * rainfall indicator, NOT the spec's rainfall-to-yield lag model (§31,
 * lags tested 1-18 months): Indonesia's and Malaysia's own monthly
 * production/export series (bpsIndonesia.ts, mpobMalaysia.ts) currently
 * have well under 2 years of history each, nowhere near enough
 * observations to fit a credible distributed-lag regression — doing so
 * anyway would be fitting noise and presenting it as a model.
 *
 * https://power.larc.nasa.gov/docs/services/api/
 */

const REGIONS: { slug: string; label: string; country: "Malaysia" | "Indonesia"; lat: number; lon: number }[] = [
  { slug: "malaysia_peninsular", label: "Peninsular Malaysia (Johor)", country: "Malaysia", lat: 2.0, lon: 103.3 },
  { slug: "malaysia_sabah", label: "Sabah", country: "Malaysia", lat: 5.4, lon: 118.1 },
  { slug: "malaysia_sarawak", label: "Sarawak", country: "Malaysia", lat: 2.3, lon: 111.8 },
  { slug: "indonesia_riau", label: "Riau", country: "Indonesia", lat: 0.5, lon: 101.4 },
  { slug: "indonesia_north_sumatra", label: "North Sumatra", country: "Indonesia", lat: 2.5, lon: 99.0 },
  { slug: "indonesia_central_kalimantan", label: "Central Kalimantan", country: "Indonesia", lat: -1.7, lon: 113.3 },
];

const START_YEAR = 2006; // matches the Oilseeds spec's own 20-year minimum ask

// NASA POWER's MERRA-2-derived monthly product lags real-world "now" by
// several months (processing latency) — requesting an `end` year the API
// hasn't published yet returns HTTP 422, not a partial result. Retrying one
// year earlier before giving up avoids hardcoding a lag that will drift.
async function fetchRegionForEndYear(region: (typeof REGIONS)[number], endYear: number): Promise<Response> {
  const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=PRECTOTCORR&community=AG&longitude=${region.lon}&latitude=${region.lat}&start=${START_YEAR}&end=${endYear}&format=JSON`;
  return fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
}

async function fetchRegion(region: (typeof REGIONS)[number]): Promise<MetricPoint[]> {
  const currentYear = new Date().getUTCFullYear();
  let res = await fetchRegionForEndYear(region, currentYear);
  if (!res.ok) res = await fetchRegionForEndYear(region, currentYear - 1);
  if (!res.ok) throw new Error(`NASA POWER (${region.slug}): HTTP ${res.status}`);
  const json = await res.json();
  const series = json?.properties?.parameter?.PRECTOTCORR as Record<string, number> | undefined;
  if (!series) throw new Error(`NASA POWER (${region.slug}): unexpected response shape`);

  const points: MetricPoint[] = [];
  for (const [key, value] of Object.entries(series)) {
    // Keys are "YYYYMM"; NASA POWER also appends a "YYYY13" annual-mean row per year, skipped here.
    const month = key.slice(4, 6);
    if (month === "13") continue;
    if (value === -999) continue; // NASA POWER's documented fill value for missing data
    const year = key.slice(0, 4);
    points.push({
      metric_key: `climate.rainfall.${region.slug}`,
      observed_at: `${year}-${month}-01`,
      value,
      unit: "mm/day",
      source_key: "nasa_power",
      source_tier: 1,
      frequency: "monthly",
    });
  }
  return points;
}

export async function fetchNasaPowerRainfall(): Promise<MetricPoint[]> {
  const results = await Promise.all(REGIONS.map((r) => fetchRegion(r)));
  return results.flat();
}

export { REGIONS as NASA_POWER_REGIONS };
