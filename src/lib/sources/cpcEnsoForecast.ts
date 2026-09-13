import type { MetricPoint } from "../metrics/store";

/**
 * NOAA CPC's own official ENSO probability FORECAST — free, no key, no
 * login, plain server-rendered HTML (verified live: the numeric table is
 * present in the raw response, not loaded via a separate JS/JSON call).
 * Updated on the 2nd Thursday of each month alongside the ENSO Diagnostics
 * Discussion. Gives the percent chance of La Niña / Neutral / El Niño for
 * 9 upcoming, overlapping 3-month seasons — this is a genuine forward-
 * looking forecast, unlike the ONI series (noaaOni.ts), which is purely
 * retrospective.
 *
 * https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/
 *
 * This is the "forecasted weather" input for the Rainfall Impact engine
 * (oilseedsRainfallImpact.ts): ENSO phase is a well-documented driver of
 * Southeast Asian palm-belt rainfall (El Niño -> drought risk, La Niña ->
 * excess-rainfall risk), so this forecast is combined there with this
 * app's own historical ENSO-phase-vs-rainfall-regime relationship (from
 * NOAA ONI + NASA POWER, both already ingested) to project a probabilistic
 * near-term rainfall regime, rather than needing a raw precipitation
 * forecast product (which would need a much heavier GRIB/NetCDF
 * processing pipeline this app doesn't have).
 *
 * Each re-ingestion (this runs in the daily pipeline) naturally overwrites
 * the prior month's forecast for any season the two both cover, via the
 * existing metric_key+observed_at+source upsert — which is exactly the
 * "update when a new forecast arrives" behavior wanted here, not a bug to
 * work around.
 */

const URL = "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/";

// Season code -> its middle month, matching NOAA's own convention (same
// mapping already used for the ONI series in noaaOni.ts).
const SEASON_MONTH: Record<string, number> = {
  DJF: 1,
  JFM: 2,
  FMA: 3,
  MAM: 4,
  AMJ: 5,
  MJJ: 6,
  JJA: 7,
  JAS: 8,
  ASO: 9,
  SON: 10,
  OND: 11,
  NDJ: 12,
};

const MONTH_NAMES: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

export async function fetchCpcEnsoForecast(): Promise<MetricPoint[]> {
  const res = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`CPC ENSO forecast: HTTP ${res.status}`);
  const html = await res.text();

  const issuedMatch = html.match(/Issued\s+([A-Za-z]+)\s+(\d{4})/);
  if (!issuedMatch) throw new Error("CPC ENSO forecast: could not find issuance month/year on page");
  const issuedMonth = MONTH_NAMES[issuedMatch[1]];
  const issuedYear = parseInt(issuedMatch[2], 10);
  if (!issuedMonth || Number.isNaN(issuedYear)) throw new Error(`CPC ENSO forecast: unrecognized issuance date "${issuedMatch[0]}"`);

  const rowRegex = /<abbr>([A-Z]{3})\s*<span[\s\S]*?<\/abbr><\/th><td>(\d+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td>/g;
  const points: MetricPoint[] = [];
  let prevMonth = 0;
  let year = issuedYear;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html))) {
    const [, seas, laNinaStr, neutralStr, elNinoStr] = match;
    const month = SEASON_MONTH[seas];
    if (!month) continue;
    if (month < prevMonth) year++;
    prevMonth = month;
    const observedAt = `${year}-${String(month).padStart(2, "0")}-01`;

    const values: Record<string, string> = { la_nina: laNinaStr, neutral: neutralStr, el_nino: elNinoStr };
    for (const [phase, raw] of Object.entries(values)) {
      const value = parseFloat(raw);
      if (Number.isNaN(value)) continue;
      points.push({
        metric_key: `climate.enso.forecast.${phase}`,
        observed_at: observedAt,
        value,
        unit: "% probability",
        source_key: "cpc_enso_forecast",
        source_tier: 1,
        frequency: "monthly",
      });
    }
  }
  if (points.length === 0) throw new Error("CPC ENSO forecast: no probability rows parsed from page");
  return points;
}
