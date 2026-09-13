import type { MetricPoint } from "../metrics/store";

/**
 * NOAA Oceanic Niño Index (ONI) — free, no key, no login. Overlapping
 * 3-month-season sea-surface-temperature anomaly in the Niño 3.4 region,
 * published by NOAA's Climate Prediction Center since 1950. This is the
 * standard, official basis for El Niño/La Niña declarations worldwide.
 *
 * Oilseeds engine spec §29-35, §144 — the "El Niño/La Niña Engine" and
 * "Weather Sources" (NOAA is item 1 on the spec's own weather-source
 * priority list). No rainfall/temperature/soil-moisture/satellite data for
 * Malaysia or Indonesia specifically is ingested here (no free, no-key,
 * station-level source for those was found — see methodology disclosure);
 * this file covers only the basin-wide ENSO state, which is the input the
 * spec's own El Niño/La Niña engines are built around.
 *
 * https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt
 */

const ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt";

// Season code -> its middle month, per NOAA's own convention (e.g. "JJA 2026"
// is centered on July 2026; "DJF 2026" is centered on Jan 2026, i.e. the
// December leg belongs to the prior calendar year but the season is filed
// under the January/February year).
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

export async function fetchNoaaOni(): Promise<MetricPoint[]> {
  const res = await fetch(ONI_URL, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`NOAA ONI: HTTP ${res.status}`);
  const text = await res.text();

  const points: MetricPoint[] = [];
  const lines = text.split("\n").slice(1); // header row
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 4) continue;
    const [seas, yrStr, , anomStr] = parts;
    const month = SEASON_MONTH[seas];
    const year = parseInt(yrStr, 10);
    const anom = parseFloat(anomStr);
    if (!month || Number.isNaN(year) || Number.isNaN(anom)) continue;
    points.push({
      metric_key: "climate.enso.oni",
      observed_at: `${year}-${String(month).padStart(2, "0")}-01`,
      value: anom,
      unit: "degC anomaly",
      source_key: "noaa_oni",
      source_tier: 1,
      frequency: "monthly",
    });
  }
  return points;
}
