import type { MetricPoint } from "../metrics/store";

/**
 * ISO New England Web Services API — real-time system load and generation
 * fuel mix for the New England grid. Free, requires a registered username/
 * password (HTTP Basic Auth), Tier 1 official grid-operator source. Verified
 * live before wiring in: https://www.iso-ne.com/participate/support/web-services-data
 *
 * Electricity/Grid Engine (spec §23-25, §69) — first of the US ISOs being
 * added; PJM/ERCOT/CAISO/MISO/NYISO/SPP follow as their own registrations
 * complete. This does NOT claim to reproduce ISO-NE's official forecast
 * reserve margin (a different, forward-looking calculation) — it computes a
 * real-time "generation - load" operating margin from live data, labeled as
 * such, not asserted as the official metric.
 */
const BASE_URL = "https://webservices.iso-ne.com/api/v1.1";

type FiveMinLoadResponse = { FiveMinSystemLoad?: { BeginDate: string; LoadMw: number }[] };
type GenFuelMixResponse = { GenFuelMixes?: { GenFuelMix?: { BeginDate: string; GenMw: number }[] } };

async function isoNeGet<T>(path: string): Promise<T> {
  const username = process.env.ISO_NE_USERNAME;
  const password = process.env.ISO_NE_PASSWORD;
  if (!username || !password) throw new Error("ISO_NE_USERNAME/ISO_NE_PASSWORD not set");
  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`ISO-NE ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchIsoNeGridSnapshot(): Promise<MetricPoint[]> {
  const [load, fuelMix] = await Promise.all([
    isoNeGet<FiveMinLoadResponse>("/fiveminutesystemload/current.json"),
    isoNeGet<GenFuelMixResponse>("/genfuelmix/current.json"),
  ]);

  const points: MetricPoint[] = [];
  const loadRow = load.FiveMinSystemLoad?.[0];
  const mixRows = fuelMix.GenFuelMixes?.GenFuelMix ?? [];
  const totalGenMw = mixRows.reduce((sum, r) => sum + (r.GenMw ?? 0), 0);
  const asOf = loadRow?.BeginDate ?? mixRows[0]?.BeginDate;
  if (!asOf) return points;
  const observedAt = asOf.slice(0, 10);

  if (loadRow) {
    points.push({
      metric_key: "energy.grid.iso_ne.load_mw",
      observed_at: observedAt,
      value: loadRow.LoadMw,
      unit: "MW",
      source_key: "iso_ne",
      source_tier: 1,
      frequency: "daily",
    });
  }
  if (mixRows.length > 0) {
    points.push({
      metric_key: "energy.grid.iso_ne.generation_mw",
      observed_at: observedAt,
      value: totalGenMw,
      unit: "MW",
      source_key: "iso_ne",
      source_tier: 1,
      frequency: "daily",
    });
  }
  if (loadRow && mixRows.length > 0) {
    points.push({
      metric_key: "energy.grid.iso_ne.margin_mw",
      observed_at: observedAt,
      value: totalGenMw - loadRow.LoadMw,
      unit: "MW",
      source_key: "iso_ne",
      source_tier: 1,
      frequency: "daily",
    });
  }
  return points;
}
