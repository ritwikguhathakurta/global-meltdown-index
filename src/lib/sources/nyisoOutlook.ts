import type { MetricPoint } from "../metrics/store";

/**
 * NYISO MIS Public Data Archive — free, no key, no account, Tier 1 official
 * grid-operator source (New York ISO). Fully anonymous CSV files under a
 * stable daily-file path convention. Verified live before wiring in:
 * https://www.nyiso.com/public-data
 *
 * Electricity/Grid Engine (spec §23-25, §69) — third US ISO after ISO-NE and
 * CAISO. Load = sum of all zone-level "Load" readings at the latest shared
 * timestamp (P-58B real-time actual load); generation = sum of all fuel
 * categories at the latest timestamp (real-time fuel mix).
 */
/**
 * NYISO's daily files are keyed by the US Eastern trading day, not UTC —
 * using the UTC calendar date 404s for roughly the last ~4-5 hours of every
 * ET day (UTC has already rolled to the next date while NYISO hasn't),
 * which only matters for off-schedule manual runs since the real daily cron
 * (21:30 UTC) always lands mid-afternoon ET, safely on the same date in
 * both zones.
 */
function todayEasternYyyymmdd(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}${get("month")}${get("day")}`;
}

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((cell) => cell.replace(/^"|"$/g, "")));
}

function sumAtLatestTimestamp(rows: string[][], timestampCol: number, valueCol: number): { value: number; timestamp: string } | null {
  if (rows.length < 2) return null;
  const body = rows.slice(1);
  const latestTs = body.reduce((max, r) => (r[timestampCol] > max ? r[timestampCol] : max), body[0][timestampCol]);
  const sum = body.filter((r) => r[timestampCol] === latestTs).reduce((s, r) => s + (parseFloat(r[valueCol]) || 0), 0);
  return { value: sum, timestamp: latestTs };
}

export async function fetchNyisoGridSnapshot(): Promise<MetricPoint[]> {
  const date = todayEasternYyyymmdd();
  const [loadRes, fuelRes] = await Promise.all([
    fetch(`https://mis.nyiso.com/public/csv/pal/${date}pal.csv`, { next: { revalidate: 0 } }),
    fetch(`https://mis.nyiso.com/public/csv/rtfuelmix/${date}rtfuelmix.csv`, { next: { revalidate: 0 } }),
  ]);
  if (!loadRes.ok) throw new Error(`NYISO pal: HTTP ${loadRes.status}`);
  if (!fuelRes.ok) throw new Error(`NYISO rtfuelmix: HTTP ${fuelRes.status}`);

  const loadRows = parseCsv(await loadRes.text());
  const fuelRows = parseCsv(await fuelRes.text());
  // pal.csv columns: Time Stamp, Time Zone, Name, PTID, Load
  const loadResult = sumAtLatestTimestamp(loadRows, 0, 4);
  // rtfuelmix.csv columns: Time Stamp, Time Zone, Fuel Category, Gen MW
  const fuelResult = sumAtLatestTimestamp(fuelRows, 0, 3);

  const points: MetricPoint[] = [];
  const observedAt = new Date().toISOString().slice(0, 10);
  if (loadResult) {
    points.push({ metric_key: "energy.grid.nyiso.load_mw", observed_at: observedAt, value: loadResult.value, unit: "MW", source_key: "nyiso_mis", source_tier: 1, frequency: "daily" });
  }
  if (fuelResult) {
    points.push({ metric_key: "energy.grid.nyiso.generation_mw", observed_at: observedAt, value: fuelResult.value, unit: "MW", source_key: "nyiso_mis", source_tier: 1, frequency: "daily" });
  }
  if (loadResult && fuelResult) {
    points.push({ metric_key: "energy.grid.nyiso.margin_mw", observed_at: observedAt, value: fuelResult.value - loadResult.value, unit: "MW", source_key: "nyiso_mis", source_tier: 1, frequency: "daily" });
  }
  return points;
}
