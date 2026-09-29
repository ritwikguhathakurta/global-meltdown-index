import type { MetricPoint } from "../metrics/store";

/**
 * UCDP (Uppsala Conflict Data Program) Georeferenced Event Dataset — free,
 * official (Uppsala University / PRIO), real armed-conflict battle-death
 * events since 1989, but its API requires a self-service access token
 * (confirmed live: `https://ucdpapi.pcr.uu.se/api/gedevents/24.1` returns
 * HTTP 401 "API token required. Add header: x-ucdp-access-token: <your-token>"
 * without one — registration is free but wasn't completed during planning).
 *
 * Gated on UCDP_ACCESS_TOKEN exactly like dhanMcx.ts is gated on Dhan
 * credentials: without the token this throws a clear, distinguishable error
 * (not a silent skip) so ingest.ts can report "not configured" rather than a
 * confusing generic failure.
 */
const BASE_URL = "https://ucdpapi.pcr.uu.se/api/gedevents/24.1";
const PAGE_SIZE = 1000;

type UcdpEvent = {
  country: string;
  region: string;
  date_start: string;
  best: number; // best estimate of total deaths in this event
  type_of_violence: number; // 1=state-based, 2=non-state, 3=one-sided
};

async function fetchPage(token: string, page: number, sinceIso: string): Promise<UcdpEvent[]> {
  const url = `${BASE_URL}?pagesize=${PAGE_SIZE}&page=${page}&StartDate=${sinceIso}`;
  const res = await fetch(url, { headers: { "x-ucdp-access-token": token }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`UCDP GED API: HTTP ${res.status}`);
  const json = (await res.json()) as { Result?: UcdpEvent[] };
  return json.Result ?? [];
}

/** Aggregates real battle-death events into a per-region, per-month fatality total — a genuine
 * conflict-intensity series, not a fabricated risk score. Regions are UCDP's own region field. */
export async function fetchUcdpConflict(token: string, sinceIso: string): Promise<MetricPoint[]> {
  const fatalitiesByRegionMonth = new Map<string, number>();
  const eventsByRegionMonth = new Map<string, number>();

  for (let page = 0; page < 20; page++) {
    const rows = await fetchPage(token, page, sinceIso);
    if (rows.length === 0) break;
    for (const r of rows) {
      const month = r.date_start.slice(0, 7);
      const regionSlug = r.region.toLowerCase().replace(/[^a-z]+/g, "_");
      const key = `${regionSlug}|${month}`;
      fatalitiesByRegionMonth.set(key, (fatalitiesByRegionMonth.get(key) ?? 0) + (r.best ?? 0));
      eventsByRegionMonth.set(key, (eventsByRegionMonth.get(key) ?? 0) + 1);
    }
    if (rows.length < PAGE_SIZE) break;
  }

  const points: MetricPoint[] = [];
  for (const [key, fatalities] of fatalitiesByRegionMonth) {
    const [regionSlug, month] = key.split("|");
    const base = { observed_at: `${month}-01`, source_key: "ucdp_ged", source_tier: 1 as const, frequency: "monthly" as const };
    points.push({ ...base, metric_key: `geopolitical.ucdp.${regionSlug}.fatalities`, value: fatalities, unit: "deaths" });
    points.push({ ...base, metric_key: `geopolitical.ucdp.${regionSlug}.event_count`, value: eventsByRegionMonth.get(key) ?? 0, unit: "events" });
  }
  if (points.length === 0) throw new Error("UCDP GED API: no events parsed since the given start date");
  return points;
}
