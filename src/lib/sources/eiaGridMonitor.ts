import type { MetricPoint } from "../metrics/store";

/**
 * EIA-930 "Hourly Electric Grid Monitor" via EIA API v2
 * (`electricity/rto/region-data`) — free, Tier 1 official US government
 * source, using the same EIA_API_KEY already registered for eiaApi.ts.
 *
 * MISO's own public real-time data broker (api.misoenergy.org/
 * MISORTWDDataBroker) was confirmed live-dead during this build — the
 * endpoint itself states "This API has been deprecated" with no documented
 * free replacement (MISO's new Data Exchange platform requires its own
 * registration). Rather than block on that, EIA-930 is used instead: every
 * US balancing authority (including MISO, PJM, ERCOT, SPP) is legally
 * required to submit hourly demand and net-generation data to EIA, which
 * republishes it same-day with only a 1-3 hour lag. This is real official
 * data, not a proxy, and it unblocks four grids at once with the API key we
 * already have — no additional registration needed for any of them.
 *
 * Electricity/Grid Engine (spec §23-25, §69).
 * https://www.eia.gov/opendata/browser/electricity/rto/region-data
 */

const BASE_URL = "https://api.eia.gov/v2";

export const EIA_GRID_RESPONDENTS: { code: string; slug: string; label: string }[] = [
  { code: "MISO", slug: "miso", label: "Midcontinent (MISO)" },
  { code: "PJM", slug: "pjm", label: "Mid-Atlantic (PJM)" },
  { code: "ERCO", slug: "ercot", label: "Texas (ERCOT)" },
  { code: "SWPP", slug: "spp", label: "Southwest Power Pool (SPP)" },
];

type EiaRow = { period: string; respondent: string; type: string; value: string | number | null };
type EiaDataResponse = { response?: { data?: EiaRow[] }; error?: string };

async function eiaGridQuery(apiKey: string, type: "D" | "NG"): Promise<EiaRow[]> {
  const url = new URL(`${BASE_URL}/electricity/rto/region-data/data/`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("frequency", "hourly");
  url.searchParams.set("data[0]", "value");
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "desc");
  url.searchParams.set("length", "20");
  for (const r of EIA_GRID_RESPONDENTS) url.searchParams.append("facets[respondent][]", r.code);
  url.searchParams.append("facets[type][]", type);
  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`EIA grid-monitor ${type}: HTTP ${res.status}`);
  const json = (await res.json()) as EiaDataResponse;
  if (json.error) throw new Error(`EIA grid-monitor ${type}: ${json.error}`);
  return json.response?.data ?? [];
}

function latestByRespondent(rows: EiaRow[]): Map<string, { period: string; value: number }> {
  const out = new Map<string, { period: string; value: number }>();
  for (const r of rows) {
    const existing = out.get(r.respondent);
    if (existing && existing.period >= r.period) continue;
    const value = typeof r.value === "string" ? parseFloat(r.value) : r.value;
    if (value === null || value === undefined || Number.isNaN(value)) continue;
    out.set(r.respondent, { period: r.period, value });
  }
  return out;
}

export async function fetchEiaGridSnapshots(apiKey: string): Promise<MetricPoint[]> {
  const [demandRows, genRows] = await Promise.all([eiaGridQuery(apiKey, "D"), eiaGridQuery(apiKey, "NG")]);
  const demand = latestByRespondent(demandRows);
  const generation = latestByRespondent(genRows);

  const points: MetricPoint[] = [];
  for (const r of EIA_GRID_RESPONDENTS) {
    const d = demand.get(r.code);
    const g = generation.get(r.code);
    const observedAt = (d?.period ?? g?.period ?? new Date().toISOString()).slice(0, 10);
    if (d) {
      points.push({ metric_key: `energy.grid.${r.slug}.load_mw`, observed_at: observedAt, value: d.value, unit: "MWh", source_key: "eia_api", source_tier: 1, frequency: "daily" });
    }
    if (g) {
      points.push({ metric_key: `energy.grid.${r.slug}.generation_mw`, observed_at: observedAt, value: g.value, unit: "MWh", source_key: "eia_api", source_tier: 1, frequency: "daily" });
    }
    if (d && g) {
      points.push({ metric_key: `energy.grid.${r.slug}.margin_mw`, observed_at: observedAt, value: g.value - d.value, unit: "MWh", source_key: "eia_api", source_tier: 1, frequency: "daily" });
    }
  }
  return points;
}
