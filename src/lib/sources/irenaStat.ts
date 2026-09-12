import type { MetricPoint } from "../metrics/store";
import { EIA_COUNTRIES } from "./eiaApi";

/**
 * IRENA IRENASTAT — free, no key, no login, official PxWeb statistical API
 * for renewable/non-renewable electricity capacity and generation by
 * country. Verified live before wiring in: https://pxweb.irena.org
 *
 * Two tables, both published annually with different lags (IRENA's own
 * cadence, not a defect here): capacity (published March) currently runs
 * through 2025; generation (published July) currently runs through 2023.
 * The latest available year is discovered dynamically from each table's
 * metadata rather than hardcoded, since IRENA appends a new year on release.
 *
 * Reuses the same 16-country set as eiaApi.ts's Country Energy Balance so
 * renewables line up against the same countries — IRENA itself covers all
 * 224 countries/areas, so more can be added later with no API changes.
 *
 * Country Energy Balance / Transition Risk (spec, renewables).
 */

const CAPACITY_TABLE =
  "https://pxweb.irena.org/api/v1/en/IRENASTAT/Power%20Capacity%20and%20Generation/Country_ELECCAP_2026_H1_v-PX%201.px";
const GENERATION_TABLE =
  "https://pxweb.irena.org/api/v1/en/IRENASTAT/Power%20Capacity%20and%20Generation/Country_ELECGEN_2025_H2_v-PX%201.px";

type PxMeta = { variables: { code: string; values: string[]; valueTexts: string[] }[] };
type PxData = { data: { key: string[]; values: string[] }[] };

async function latestYearCode(tableUrl: string): Promise<{ code: string; year: string }> {
  const res = await fetch(tableUrl, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`IRENA metadata: HTTP ${res.status}`);
  const meta = (await res.json()) as PxMeta;
  const yearVar = meta.variables.find((v) => v.code === "Year");
  if (!yearVar || yearVar.values.length === 0) throw new Error("IRENA metadata: no Year variable");
  const idx = yearVar.values.length - 1;
  return { code: yearVar.values[idx], year: yearVar.valueTexts[idx] };
}

async function pxQuery(tableUrl: string, query: Record<string, unknown>[]): Promise<PxData> {
  const res = await fetch(tableUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json" } }),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`IRENA query: HTTP ${res.status}`);
  return (await res.json()) as PxData;
}

export async function fetchIrenaRenewablesCapacity(): Promise<MetricPoint[]> {
  const { code: yearCode, year } = await latestYearCode(CAPACITY_TABLE);
  const result = await pxQuery(CAPACITY_TABLE, [
    { code: "Country/area", selection: { filter: "item", values: EIA_COUNTRIES.map((c) => c.code) } },
    { code: "Technology", selection: { filter: "item", values: ["0", "16"] } }, // Total renewable, Total non-renewable
    { code: "Grid connection", selection: { filter: "item", values: ["0", "1"] } }, // OnGrid + OffGrid, summed below (no "All" option in this table)
    { code: "Year", selection: { filter: "item", values: [yearCode] } },
  ]);

  const slugByCode = new Map(EIA_COUNTRIES.map((c) => [c.code, c.slug]));
  const sums = new Map<string, { renewable: number; nonRenewable: number }>();
  for (const row of result.data) {
    const [country, tech] = row.key;
    const value = parseFloat(row.values[0]);
    if (Number.isNaN(value)) continue;
    const entry = sums.get(country) ?? { renewable: 0, nonRenewable: 0 };
    if (tech === "0") entry.renewable += value;
    else if (tech === "16") entry.nonRenewable += value;
    sums.set(country, entry);
  }

  const observedAt = `${year}-12-31`;
  const points: MetricPoint[] = [];
  for (const [country, { renewable, nonRenewable }] of sums) {
    const slug = slugByCode.get(country);
    if (!slug) continue;
    points.push({ metric_key: `energy.country.${slug}.renewable_capacity_mw`, observed_at: observedAt, value: renewable, unit: "MW", source_key: "irena_irenastat", source_tier: 1, frequency: "annual" });
    points.push({ metric_key: `energy.country.${slug}.nonrenewable_capacity_mw`, observed_at: observedAt, value: nonRenewable, unit: "MW", source_key: "irena_irenastat", source_tier: 1, frequency: "annual" });
  }
  return points;
}

export async function fetchIrenaRenewablesGeneration(): Promise<MetricPoint[]> {
  const { code: yearCode, year } = await latestYearCode(GENERATION_TABLE);
  const result = await pxQuery(GENERATION_TABLE, [
    { code: "Country/area", selection: { filter: "item", values: EIA_COUNTRIES.map((c) => c.code) } },
    { code: "Technology", selection: { filter: "item", values: ["0", "13"] } }, // Total renewable, Total non-renewable
    { code: "Data Type", selection: { filter: "item", values: ["0"] } },
    { code: "Grid connection", selection: { filter: "item", values: ["2"] } }, // All
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
    const suffix = tech === "0" ? "renewable_generation_gwh" : "nonrenewable_generation_gwh";
    points.push({ metric_key: `energy.country.${slug}.${suffix}`, observed_at: observedAt, value, unit: "GWh", source_key: "irena_irenastat", source_tier: 1, frequency: "annual" });
  }
  return points;
}
