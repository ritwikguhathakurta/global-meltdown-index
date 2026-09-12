import type { MetricPoint } from "../metrics/store";
import { BALANCE_COMMODITIES } from "../commodities/balanceTaxonomy";

/**
 * EIA international dataset's own "World" region aggregate — free, no key
 * beyond the standard EIA_API_KEY this app already uses elsewhere
 * (eiaApi.ts). Unlike the country-level petroleum balance built for the
 * Energy tab (which sums a curated 16-country list), EIA publishes a real
 * pre-computed World total directly (countryRegionId=WORL,
 * countryRegionTypeId="r" for Region) — verified live against known
 * figures before use (2025 world petroleum & other liquids production
 * ~106M bbl/day; 2024 world natural gas production/consumption ~149 Tcf;
 * 2024 world coal production/consumption ~8.8 billion MT — all match
 * published figures).
 *
 * EIA has no "crude oil consumption" concept at all (verified live — the
 * query returns zero rows, since crude isn't consumed directly, it's
 * refined first), so production and consumption pair up at the broader
 * "Total petroleum and other liquids" (productId 53, production) /
 * "Refined petroleum products" (productId 54, consumption) level instead —
 * the same convention already used in eiaApi.ts for country-level
 * balances. Natural gas (26, "Dry natural gas") and coal (7, "Coal") use
 * the same productId for both activities.
 */

const EIA_BASE = "https://api.eia.gov/v2/international/data/";

type Fuel = "crude_oil" | "natural_gas" | "coal";

const FUEL_CONFIG: Record<Fuel, { productionProductId: string; consumptionProductId: string; unit: string; divisor: number }> = {
  crude_oil: { productionProductId: "53", consumptionProductId: "54", unit: "TBPD", divisor: 1000 }, // -> million bbl/day
  natural_gas: { productionProductId: "26", consumptionProductId: "26", unit: "BCF", divisor: 1000 }, // -> trillion cubic feet
  coal: { productionProductId: "7", consumptionProductId: "7", unit: "MT", divisor: 1_000_000 }, // raw is 1000 MT -> billion MT
};

type EiaRow = { period: string; value: string };
type EiaResponse = { response: { data: EiaRow[] } };

async function fetchWorldSeries(apiKey: string, productId: string, activityId: string, unit: string): Promise<EiaRow[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: "annual",
    "data[]": "value",
    "facets[countryRegionId][]": "WORL",
    "facets[productId][]": productId,
    "facets[activityId][]": activityId,
    "facets[unit][]": unit,
  });
  const res = await fetch(`${EIA_BASE}?${params.toString()}`, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`EIA world energy (product ${productId}, activity ${activityId}): HTTP ${res.status}`);
  const json = (await res.json()) as EiaResponse;
  return json.response?.data ?? [];
}

export async function fetchEiaWorldEnergyBalances(apiKey: string): Promise<MetricPoint[]> {
  const commodities = BALANCE_COMMODITIES.filter((c) => c.source === "eia_world_energy");
  if (commodities.length === 0) return [];

  const points: MetricPoint[] = [];
  for (const commodity of commodities) {
    const fuel = commodity.sourceCode as Fuel;
    const config = FUEL_CONFIG[fuel];
    if (!config) continue;

    const [production, consumption] = await Promise.all([
      fetchWorldSeries(apiKey, config.productionProductId, "1", config.unit),
      fetchWorldSeries(apiKey, config.consumptionProductId, "2", config.unit),
    ]);

    for (const [attribute, rows] of [
      ["production", production],
      ["consumption", consumption],
    ] as const) {
      for (const row of rows) {
        const value = parseFloat(row.value);
        if (Number.isNaN(value)) continue;
        points.push({
          metric_key: `commodity.${commodity.slug}.${attribute}`,
          observed_at: `${row.period}-12-31`,
          value: value / config.divisor,
          unit: commodity.unit,
          source_key: "eia_world_energy",
          source_tier: 1,
          frequency: "annual",
        });
      }
    }
  }
  return points;
}
