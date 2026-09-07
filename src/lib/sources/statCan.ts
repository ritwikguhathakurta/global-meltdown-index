import type { MetricPoint } from "../metrics/store";

/**
 * Canada's Supply Chains proxy: Statistics Canada's own Web Data Service
 * (WDS) API — free, no key, official, Tier 1 — table 16-10-0047-01
 * ("Manufacturers' sales, inventories, orders and inventory to sales
 * ratios, by industry"), the "Ratio of total inventory to sales" series for
 * total Manufacturing, seasonally adjusted.
 *
 * This exists as a direct-from-StatCan connector rather than FRED because
 * FRED's OECD-mirrored Canadian series for this concept (order books,
 * inventory/shipments) stopped updating in 2023 — the aggregator lagged,
 * not the underlying source, which StatCan itself keeps current monthly
 * (verified: this vector's latest observation trails "today" by only ~2
 * months, StatCan's normal release lag).
 *
 * Direction: a FALLING inventory-to-sales ratio means goods are scarcer
 * relative to demand — the 2021-22 chip-shortage pattern, where
 * manufacturers couldn't restock because inputs weren't arriving — so a
 * lower ratio reads as more supply-chain pressure, the same sign
 * convention used for other "more of this is calming" series elsewhere in
 * this codebase (zDirection -1 is applied where this is consumed).
 */
const PRODUCT_ID = "16100047";
// Geography=Canada(1), Principal statistic=Ratio of total inventory to sales(8),
// Seasonal adjustment=Seasonally adjusted(2), NAICS=Manufacturing(1), padded to
// StatCan WDS's fixed 10-coordinate format.
const COORDINATE = "1.8.2.1.0.0.0.0.0.0";

type WdsDataPoint = { refPer: string; value: number | null };
type WdsResponse = { status: string; object?: { vectorId: number; vectorDataPoint: WdsDataPoint[] } }[];

export async function fetchCanadaInventoryToSalesRatio(): Promise<MetricPoint[]> {
  const res = await fetch("https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ productId: Number(PRODUCT_ID), coordinate: COORDINATE, latestN: 120 }]),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`StatCan WDS: HTTP ${res.status}`);
  const json = (await res.json()) as WdsResponse;
  const entry = json[0];
  if (entry.status !== "SUCCESS" || !entry.object) throw new Error(`StatCan WDS: ${JSON.stringify(entry)}`);

  const points: MetricPoint[] = [];
  for (const p of entry.object.vectorDataPoint) {
    if (p.value === null || p.value === undefined) continue;
    points.push({
      metric_key: "supplychain.canada_inventory_sales_ratio",
      observed_at: p.refPer.slice(0, 10),
      value: p.value,
      unit: "ratio",
      source_key: "statcan",
      source_tier: 1,
      frequency: "monthly",
    });
  }
  if (points.length === 0) throw new Error("StatCan WDS: no data points returned");
  return points;
}
