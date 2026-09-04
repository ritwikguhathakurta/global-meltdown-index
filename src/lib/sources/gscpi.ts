import type { MetricPoint } from "../metrics/store";
import { fetchWorkbookSheet } from "./xlsWorkbook";

/**
 * NY Fed Global Supply Chain Pressure Index — free, official (Federal Reserve
 * Bank of New York), Tier 1. Monthly. https://www.newyorkfed.org/research/gscpi.html
 * Standard-deviations-from-average composite of shipping/freight/PMI supply-chain
 * indicators; 0 = historical average pressure, positive = above-average pressure.
 */
const GSCPI_URL = "https://www.newyorkfed.org/medialibrary/research/interactives/gscpi/downloads/gscpi_data.xlsx";

export async function fetchGscpiSeries(): Promise<MetricPoint[]> {
  const rows = await fetchWorkbookSheet(GSCPI_URL, "GSCPI Monthly Data");
  const points: MetricPoint[] = [];
  for (const row of rows) {
    const dateStr = row[0];
    const value = row[1];
    if (typeof dateStr !== "string" || typeof value !== "number") continue;
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) continue;
    points.push({
      metric_key: "supplychain.gscpi",
      observed_at: parsed.toISOString().slice(0, 10),
      value,
      unit: "std_dev",
      source_key: "ny_fed_gscpi",
      source_tier: 1,
      frequency: "monthly",
    });
  }
  return points;
}
