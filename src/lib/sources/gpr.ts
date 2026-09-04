import type { MetricPoint } from "../metrics/store";
import { fetchWorkbookSheet, excelSerialToIso } from "./xlsWorkbook";

/**
 * Geopolitical Risk Index (Caldara & Iacoviello, Federal Reserve Board
 * economists) — free, publicly published, methodologically transparent
 * academic index built from automated text search of 10 major newspapers.
 * Not a government source, so Tier 2 rather than Tier 1. Monthly, since 1900.
 * https://www.matteoiacoviello.com/gpr.htm
 */
const GPR_URL = "https://www.matteoiacoviello.com/gpr_files/data_gpr_export.xls";

export async function fetchGprSeries(): Promise<MetricPoint[]> {
  const rows = await fetchWorkbookSheet(GPR_URL, "Sheet1");
  const points: MetricPoint[] = [];
  // header row 0: month, GPR (overall), GPRT (threats sub-index, more forward-looking),
  // GPRA (acts sub-index, confirms a threat became a realized event)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const serial = row[0];
    const gpr = row[1];
    const gprThreats = row[2];
    const gprActs = row[3];
    if (typeof serial !== "number") continue;
    const observed_at = excelSerialToIso(serial);
    if (typeof gpr === "number") {
      points.push({ metric_key: "geopolitical.gpr_index", observed_at, value: gpr, unit: "index_1985_2019_avg_100", source_key: "gpr_index", source_tier: 2, frequency: "monthly" });
    }
    if (typeof gprThreats === "number") {
      points.push({ metric_key: "geopolitical.gpr_threats", observed_at, value: gprThreats, unit: "index_1985_2019_avg_100", source_key: "gpr_index", source_tier: 2, frequency: "monthly" });
    }
    if (typeof gprActs === "number") {
      points.push({ metric_key: "geopolitical.gpr_acts", observed_at, value: gprActs, unit: "index_1985_2019_avg_100", source_key: "gpr_index", source_tier: 2, frequency: "monthly" });
    }
  }
  return points;
}
