import type { MetricPoint } from "../metrics/store";

/**
 * CAISO "Today's Outlook" — free, no key, no login, Tier 1 official
 * grid-operator source (California ISO). Simple CSV feeds (5-minute
 * resolution) for current demand and generation by fuel type. Verified
 * live before wiring in: https://www.caiso.com/todays-outlook
 *
 * Electricity/Grid Engine (spec §23-25, §69) — second US ISO after ISO-NE.
 * Generation = sum of all fuel-type columns (including net imports, which
 * genuinely serve CAISO load); this is a real-time supply/demand balance,
 * not CAISO's own forward-looking planning reserve margin.
 */
const DEMAND_URL = "https://www.caiso.com/outlook/current/demand.csv";
const FUEL_SOURCE_URL = "https://www.caiso.com/outlook/current/fuelsource.csv";

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split("\n")
    .map((line) => line.split(","));
}

function lastNumericRow(rows: string[][]): string[] | null {
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i].length >= 2 && rows[i].some((cell, idx) => idx > 0 && cell !== "" && !Number.isNaN(Number(cell)))) return rows[i];
  }
  return null;
}

export async function fetchCaisoGridSnapshot(): Promise<MetricPoint[]> {
  const [demandRes, fuelRes] = await Promise.all([
    fetch(DEMAND_URL, { next: { revalidate: 0 } }),
    fetch(FUEL_SOURCE_URL, { next: { revalidate: 0 } }),
  ]);
  if (!demandRes.ok) throw new Error(`CAISO demand: HTTP ${demandRes.status}`);
  if (!fuelRes.ok) throw new Error(`CAISO fuelsource: HTTP ${fuelRes.status}`);

  const demandRows = parseCsv(await demandRes.text());
  const fuelRows = parseCsv(await fuelRes.text());
  const demandLast = lastNumericRow(demandRows);
  const fuelLast = lastNumericRow(fuelRows);
  const fuelHeader = fuelRows[0];

  const points: MetricPoint[] = [];
  const observedAt = new Date().toISOString().slice(0, 10);

  const currentDemandIdx = demandRows[0]?.indexOf("Current demand") ?? -1;
  const loadMw = demandLast && currentDemandIdx >= 0 ? parseFloat(demandLast[currentDemandIdx]) : null;
  if (loadMw !== null && !Number.isNaN(loadMw)) {
    points.push({ metric_key: "energy.grid.caiso.load_mw", observed_at: observedAt, value: loadMw, unit: "MW", source_key: "caiso_outlook", source_tier: 1, frequency: "daily" });
  }

  let generationMw: number | null = null;
  if (fuelLast) {
    generationMw = fuelHeader.slice(1).reduce((sum, _label, i) => {
      const v = parseFloat(fuelLast[i + 1]);
      return sum + (Number.isNaN(v) ? 0 : v);
    }, 0);
    points.push({ metric_key: "energy.grid.caiso.generation_mw", observed_at: observedAt, value: generationMw, unit: "MW", source_key: "caiso_outlook", source_tier: 1, frequency: "daily" });
  }

  if (loadMw !== null && generationMw !== null) {
    points.push({ metric_key: "energy.grid.caiso.margin_mw", observed_at: observedAt, value: generationMw - loadMw, unit: "MW", source_key: "caiso_outlook", source_tier: 1, frequency: "daily" });
  }
  return points;
}
