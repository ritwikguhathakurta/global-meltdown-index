import type { MetricPoint } from "../metrics/store";
import { EIA_COUNTRIES } from "./eiaApi";

/**
 * IRENA IRENASTAT — free, no key, no login, official PxWeb statistical API
 * for renewable/non-renewable electricity capacity and generation by
 * country. Verified live before wiring in: https://pxweb.irena.org
 *
 * IRENA replaced the two separate per-metric tables this connector used
 * originally (`Country_ELECCAP_*`/`Country_ELECGEN_*`, dated by H1/H2 release)
 * with one combined table on its H2 2026 refresh — verified live 2026-10-26
 * after both old URLs started 404ing in production. The new
 * `Country_ELECSTAT_*` table holds both metrics behind a `Data Type`
 * dimension (`0` = generation, `1` = capacity) instead of being two tables,
 * and its `Technology` codes for the two totals are swapped from what the
 * old capacity table used (`0` is now Total Non-Renewable, `1` is now Total
 * Renewable — previously capacity used `0`=renewable/`16`=non-renewable and
 * generation used `0`=renewable/`13`=non-renewable, two different schemes).
 * `Grid connection` also gained a real "All" option (`0`) in the new table,
 * replacing the capacity table's old need to sum on-grid + off-grid by hand.
 *
 * Generation data genuinely lags capacity by about a year in IRENA's own
 * publication cadence, but the table's `Year` metadata still lists the
 * current year as a selectable value before data for it exists — querying
 * that year returns PxWeb's own "not available" marker (`".."`) rather than
 * an error. `findLatestYearWithData` probes backwards from the newest listed
 * year with one cheap reference-country query per metric, rather than
 * trusting metadata's last year to mean "has real data" the way the old,
 * single-metric tables could get away with.
 *
 * Reuses the same 16-country set as eiaApi.ts's Country Energy Balance so
 * renewables line up against the same countries — IRENA itself covers all
 * 224 countries/areas, so more can be added later with no API changes.
 *
 * Country Energy Balance / Transition Risk (spec, renewables).
 */

const TABLE =
  "https://pxweb.irena.org/api/v1/en/IRENASTAT/Power%20Capacity%20and%20Generation/Country_ELECSTAT_2026_H2_PX.px";

const TECH_NON_RENEWABLE = "0";
const TECH_RENEWABLE = "1";
const DATA_TYPE_GENERATION = "0";
const DATA_TYPE_CAPACITY = "1";
const GRID_ALL = "0";
const PROBE_COUNTRY = "USA";
const NOT_AVAILABLE = "..";

type PxMeta = { variables: { code: string; values: string[]; valueTexts: string[] }[] };
type PxData = { data: { key: string[]; values: string[] }[] };

async function fetchMeta(): Promise<PxMeta> {
  const res = await fetch(TABLE, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`IRENA metadata: HTTP ${res.status}`);
  return (await res.json()) as PxMeta;
}

async function pxQuery(query: Record<string, unknown>[]): Promise<PxData> {
  const res = await fetch(TABLE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json" } }),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`IRENA query: HTTP ${res.status}`);
  return (await res.json()) as PxData;
}

/**
 * Walks the Year variable's listed values newest-first and returns the first
 * one where a single reference country actually has a non-".." value for
 * this Data Type, since IRENA lists the current year before data for it is
 * published rather than omitting it from the metadata.
 */
async function findLatestYearWithData(
  meta: PxMeta,
  dataType: string,
): Promise<{ code: string; year: string }> {
  const yearVar = meta.variables.find((v) => v.code === "Year");
  if (!yearVar || yearVar.values.length === 0) throw new Error("IRENA metadata: no Year variable");

  for (let idx = yearVar.values.length - 1; idx >= 0; idx--) {
    const code = yearVar.values[idx];
    const result = await pxQuery([
      { code: "Country/area", selection: { filter: "item", values: [PROBE_COUNTRY] } },
      { code: "Technology", selection: { filter: "item", values: [TECH_RENEWABLE] } },
      { code: "Data Type", selection: { filter: "item", values: [dataType] } },
      { code: "Grid connection", selection: { filter: "item", values: [GRID_ALL] } },
      { code: "Year", selection: { filter: "item", values: [code] } },
    ]);
    const value = result.data[0]?.values?.[0];
    if (value !== undefined && value !== NOT_AVAILABLE) {
      return { code, year: yearVar.valueTexts[idx] };
    }
  }
  throw new Error("IRENA: no year with real data found for this Data Type");
}

async function fetchByDataType(dataType: string, metricSuffixes: { renewable: string; nonRenewable: string }, unit: string): Promise<MetricPoint[]> {
  const meta = await fetchMeta();
  const { code: yearCode, year } = await findLatestYearWithData(meta, dataType);
  const result = await pxQuery([
    { code: "Country/area", selection: { filter: "item", values: EIA_COUNTRIES.map((c) => c.code) } },
    { code: "Technology", selection: { filter: "item", values: [TECH_NON_RENEWABLE, TECH_RENEWABLE] } },
    { code: "Data Type", selection: { filter: "item", values: [dataType] } },
    { code: "Grid connection", selection: { filter: "item", values: [GRID_ALL] } },
    { code: "Year", selection: { filter: "item", values: [yearCode] } },
  ]);

  const slugByCode = new Map(EIA_COUNTRIES.map((c) => [c.code, c.slug]));
  const observedAt = `${year}-12-31`;
  const points: MetricPoint[] = [];
  for (const row of result.data) {
    const [country, tech] = row.key;
    const slug = slugByCode.get(country);
    const value = parseFloat(row.values[0]);
    if (!slug || Number.isNaN(value)) continue;
    const suffix = tech === TECH_RENEWABLE ? metricSuffixes.renewable : metricSuffixes.nonRenewable;
    points.push({ metric_key: `energy.country.${slug}.${suffix}`, observed_at: observedAt, value, unit, source_key: "irena_irenastat", source_tier: 1, frequency: "annual" });
  }
  return points;
}

export async function fetchIrenaRenewablesCapacity(): Promise<MetricPoint[]> {
  return fetchByDataType(
    DATA_TYPE_CAPACITY,
    { renewable: "renewable_capacity_mw", nonRenewable: "nonrenewable_capacity_mw" },
    "MW",
  );
}

export async function fetchIrenaRenewablesGeneration(): Promise<MetricPoint[]> {
  return fetchByDataType(
    DATA_TYPE_GENERATION,
    { renewable: "renewable_generation_gwh", nonRenewable: "nonrenewable_generation_gwh" },
    "GWh",
  );
}
