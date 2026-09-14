import type { MetricPoint } from "../metrics/store";

/**
 * ENTSO-E Transparency Platform — free, official (all EU/EEA/UK/Balkan
 * transmission system operators' own reported data via the ENTSO-E central
 * hub), Tier 1. Requires a free self-service API token (ENTSOE_API_KEY,
 * instant signup at transparency.entsoe.eu/myAccount/webApiAccess).
 * https://transparency.entsoe.eu/
 *
 * Three data types, each verified live against the real API before use:
 *  - A44 Day-ahead prices (EUR/MWh) — one bidding-zone domain.
 *  - A65 Total load, actual (MW) — processType A16 "Realised".
 *  - A75 Actual generation per production type (MW) — processType A16,
 *    broken out by ENTSO-E's own PsrType code per fuel/technology.
 *  - A11 Cross-border physical flow (MW) — a directional (in_Domain,
 *    out_Domain) pair; capped by ENTSO-E itself at a 1-month query window
 *    ("maximum allowed period P1M" — confirmed live, a full-year request
 *    for this document type returns an error, unlike price/load/generation).
 *
 * All zone codes and border pairs below are ENTSO-E's own EIC (Energy
 * Identification Code) area identifiers — not fabricated, and each one was
 * verified live (returns real, non-empty data) before being added. Great
 * Britain was checked and excluded: its EIC domain still resolves, but
 * ENTSO-E returns "No matching data found" for day-ahead prices there —
 * GB stopped submitting day-ahead price data through this hub after
 * leaving the EU internal electricity market.
 */

const BASE_URL = "https://web-api.tp.entsoe.eu/api";

export const EU_GRID_ZONES: Record<string, string> = {
  germany: "10Y1001A1001A82H",
  france: "10YFR-RTE------C",
  spain: "10YES-REE------0",
  netherlands: "10YNL----------L",
  belgium: "10YBE----------2",
  poland: "10YPL-AREA-----S",
  austria: "10YAT-APG------L",
  portugal: "10YPT-REN------W",
  czech_republic: "10YCZ-CEPS-----N",
  switzerland: "10YCH-SWISSGRIDZ",
  italy_north: "10Y1001A1001A73I",
};

export const EU_GRID_ZONE_LABELS: Record<string, string> = {
  germany: "Germany-Luxembourg",
  france: "France",
  spain: "Spain",
  netherlands: "Netherlands",
  belgium: "Belgium",
  poland: "Poland",
  austria: "Austria",
  portugal: "Portugal",
  czech_republic: "Czech Republic",
  switzerland: "Switzerland",
  italy_north: "Italy (North zone)",
};

/** Real physical interconnections among the zones above, each live-verified
 * (returns actual non-empty flow quantities) before inclusion — not every
 * possible pair, only the ones ENTSO-E confirms are wired. Direction here
 * is (out -> in): the second country's flow into the first's domain. */
export const EU_GRID_BORDERS: { inSlug: string; outSlug: string }[] = [
  { inSlug: "germany", outSlug: "france" },
  { inSlug: "germany", outSlug: "netherlands" },
  { inSlug: "germany", outSlug: "belgium" },
  { inSlug: "germany", outSlug: "austria" },
  { inSlug: "germany", outSlug: "switzerland" },
  { inSlug: "germany", outSlug: "poland" },
  { inSlug: "germany", outSlug: "czech_republic" },
  { inSlug: "france", outSlug: "spain" },
  { inSlug: "france", outSlug: "belgium" },
  { inSlug: "france", outSlug: "switzerland" },
  { inSlug: "france", outSlug: "italy_north" },
  { inSlug: "netherlands", outSlug: "belgium" },
  { inSlug: "austria", outSlug: "switzerland" },
  { inSlug: "austria", outSlug: "italy_north" },
  { inSlug: "austria", outSlug: "czech_republic" },
  { inSlug: "switzerland", outSlug: "italy_north" },
  { inSlug: "poland", outSlug: "czech_republic" },
  { inSlug: "spain", outSlug: "portugal" },
];

/** ENTSO-E's own PsrType codes, bucketed into the handful of fuel families
 * this app's other commodity/energy engines already use, so a European
 * generation-mix row is directly comparable in spirit (not units) to the
 * US grid monitors' load/generation split. */
export type FuelBucket = "fossil" | "nuclear" | "hydro" | "wind" | "solar" | "other_renewable";
const PSR_TYPE_BUCKET: Record<string, FuelBucket> = {
  B02: "fossil", // Fossil Brown coal/Lignite
  B03: "fossil", // Fossil Coal-derived gas
  B04: "fossil", // Fossil Gas
  B05: "fossil", // Fossil Hard coal
  B06: "fossil", // Fossil Oil
  B07: "fossil", // Fossil Oil shale
  B08: "fossil", // Fossil Peat
  B14: "nuclear",
  B10: "hydro", // Hydro Pumped Storage
  B11: "hydro", // Hydro Run-of-river and poundage
  B12: "hydro", // Hydro Water Reservoir
  B18: "wind", // Wind Offshore
  B19: "wind", // Wind Onshore
  B16: "solar",
  B01: "other_renewable", // Biomass
  B09: "other_renewable", // Geothermal
  B13: "other_renewable", // Marine
  B15: "other_renewable", // Other renewable
  B17: "other_renewable", // Waste
  B20: "other_renewable", // Other
};
export const FUEL_BUCKETS: FuelBucket[] = ["fossil", "nuclear", "hydro", "wind", "solar", "other_renewable"];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatPeriod(d: Date): string {
  return d.toISOString().slice(0, 4) + d.toISOString().slice(5, 7) + d.toISOString().slice(8, 10) + d.toISOString().slice(11, 13) + d.toISOString().slice(14, 16);
}

async function entsoeQuery(params: Record<string, string>): Promise<string> {
  const apiKey = process.env.ENTSOE_API_KEY;
  if (!apiKey) throw new Error("ENTSOE_API_KEY not configured");
  const url = new URL(BASE_URL);
  url.searchParams.set("securityToken", apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const text = await res.text();
  if (!res.ok) throw new Error(`ENTSO-E: HTTP ${res.status} — ${text.slice(0, 300)}`);
  if (text.includes("Acknowledgement_MarketDocument")) {
    if (text.includes("No matching data")) return ""; // genuinely no data for this window — not an error
    throw new Error(`ENTSO-E: ${text.match(/<text>([^<]*)<\/text>/)?.[1] ?? "acknowledgement/error response"}`);
  }
  return text;
}

type QuantityPoint = { t: Date; value: number };

/** Parses every <TimeSeries> block's <Period>/<Point> quantities (or, for
 * price documents, <price.amount>) into absolute timestamps. Multiple
 * Period blocks per TimeSeries (observed live — ENTSO-E splits a query
 * range at a reporting-resolution change) are all included. Grouped by an
 * optional per-TimeSeries key (e.g. psrType) so a generation-mix response's
 * several fuel-type series don't get merged together. */
function parseTimeSeriesQuantities(xml: string, valueTag: "quantity" | "price.amount", keyTag?: string): Map<string, QuantityPoint[]> {
  const result = new Map<string, QuantityPoint[]>();
  const tsBlocks = xml.match(/<TimeSeries>[\s\S]*?<\/TimeSeries>/g) ?? [];
  for (const block of tsBlocks) {
    const key = keyTag ? (block.match(new RegExp(`<${keyTag}>([^<]*)</${keyTag}>`))?.[1] ?? "unknown") : "default";
    const points: QuantityPoint[] = result.get(key) ?? [];
    const periodBlocks = block.match(/<Period>[\s\S]*?<\/Period>/g) ?? [];
    for (const period of periodBlocks) {
      const start = period.match(/<start>([^<]*)<\/start>/)?.[1];
      const resolution = period.match(/<resolution>([^<]*)<\/resolution>/)?.[1];
      if (!start || !resolution) continue;
      const resMatch = resolution.match(/^PT(\d+)M$/);
      const resMinutes = resMatch ? parseInt(resMatch[1], 10) : resolution === "P1D" ? 1440 : null;
      if (resMinutes === null) continue;
      const startDate = new Date(start);
      const pointBlocks = period.match(/<Point>[\s\S]*?<\/Point>/g) ?? [];
      for (const pointBlock of pointBlocks) {
        const position = pointBlock.match(/<position>(\d+)<\/position>/)?.[1];
        const value = pointBlock.match(new RegExp(`<${valueTag.replace(".", "\\.")}>([^<]*)</${valueTag.replace(".", "\\.")}>`))?.[1];
        if (position === undefined || value === undefined) continue;
        const t = new Date(startDate.getTime() + (parseInt(position, 10) - 1) * resMinutes * 60_000);
        const v = parseFloat(value);
        if (!Number.isNaN(v)) points.push({ t, value: v });
      }
    }
    result.set(key, points);
  }
  return result;
}

function dailyAverage(points: QuantityPoint[]): Map<string, number> {
  const byDay = new Map<string, number[]>();
  for (const p of points) {
    const day = p.t.toISOString().slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(p.value);
    byDay.set(day, list);
  }
  const out = new Map<string, number>();
  for (const [day, vals] of byDay) out.set(day, vals.reduce((a, b) => a + b, 0) / vals.length);
  return out;
}

const LOOKBACK_DAYS = 14;

function recentWindow(): { start: Date; end: Date } {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);
  return { start, end };
}

export async function fetchEntsoeDayAheadPrices(): Promise<{ points: MetricPoint[]; errors: string[] }> {
  const { start, end } = recentWindow();
  const points: MetricPoint[] = [];
  const errors: string[] = [];
  for (const [slug, zone] of Object.entries(EU_GRID_ZONES)) {
    try {
      const xml = await entsoeQuery({ documentType: "A44", in_Domain: zone, out_Domain: zone, periodStart: formatPeriod(start), periodEnd: formatPeriod(end) });
      if (!xml) continue;
      const series = parseTimeSeriesQuantities(xml, "price.amount");
      const daily = dailyAverage(series.get("default") ?? []);
      for (const [day, avg] of daily) {
        points.push({ metric_key: `energy.eu_grid.${slug}.day_ahead_price`, observed_at: day, value: avg, unit: "EUR/MWh", source_key: "entsoe", source_tier: 1, frequency: "daily" });
      }
    } catch (e) {
      errors.push(`${slug}: ${(e as Error).message}`);
    }
    await delay(300);
  }
  return { points, errors };
}

export async function fetchEntsoeLoad(): Promise<{ points: MetricPoint[]; errors: string[] }> {
  const { start, end } = recentWindow();
  const points: MetricPoint[] = [];
  const errors: string[] = [];
  for (const [slug, zone] of Object.entries(EU_GRID_ZONES)) {
    try {
      const xml = await entsoeQuery({ documentType: "A65", processType: "A16", outBiddingZone_Domain: zone, periodStart: formatPeriod(start), periodEnd: formatPeriod(end) });
      if (!xml) continue;
      const series = parseTimeSeriesQuantities(xml, "quantity");
      const daily = dailyAverage(series.get("default") ?? []);
      for (const [day, avg] of daily) {
        points.push({ metric_key: `energy.eu_grid.${slug}.load_mw`, observed_at: day, value: avg, unit: "MW", source_key: "entsoe", source_tier: 1, frequency: "daily" });
      }
    } catch (e) {
      errors.push(`${slug}: ${(e as Error).message}`);
    }
    await delay(300);
  }
  return { points, errors };
}

export async function fetchEntsoeGeneration(): Promise<{ points: MetricPoint[]; errors: string[] }> {
  const { start, end } = recentWindow();
  const points: MetricPoint[] = [];
  const errors: string[] = [];
  for (const [slug, zone] of Object.entries(EU_GRID_ZONES)) {
    try {
      const xml = await entsoeQuery({ documentType: "A75", processType: "A16", in_Domain: zone, periodStart: formatPeriod(start), periodEnd: formatPeriod(end) });
      if (!xml) continue;
      const seriesByPsr = parseTimeSeriesQuantities(xml, "quantity", "psrType");
      const dailyByBucket = new Map<FuelBucket, Map<string, number[]>>();
      for (const [psrType, series] of seriesByPsr) {
        const bucket = PSR_TYPE_BUCKET[psrType];
        if (!bucket) continue; // unrecognized/unused code — skip rather than guess
        const daily = dailyAverage(series);
        const acc = dailyByBucket.get(bucket) ?? new Map<string, number[]>();
        for (const [day, avg] of daily) {
          const list = acc.get(day) ?? [];
          list.push(avg);
          acc.set(day, list);
        }
        dailyByBucket.set(bucket, acc);
      }
      for (const [bucket, byDay] of dailyByBucket) {
        for (const [day, vals] of byDay) {
          // Sum across the bucket's constituent PsrTypes (e.g. Wind Onshore +
          // Offshore) for that day — each is a genuine independent generation
          // stream, not double-counting the same one.
          const total = vals.reduce((a, b) => a + b, 0);
          points.push({ metric_key: `energy.eu_grid.${slug}.generation_mw.${bucket}`, observed_at: day, value: total, unit: "MW", source_key: "entsoe", source_tier: 1, frequency: "daily" });
        }
      }
    } catch (e) {
      errors.push(`${slug}: ${(e as Error).message}`);
    }
    await delay(300);
  }
  return { points, errors };
}

/** Previous full calendar month — ENTSO-E caps A11 cross-border-flow queries
 * at a 1-month window (confirmed live: a 1-year request is rejected with
 * "maximum allowed period P1M"), so this is a genuine monthly snapshot, not
 * an annual total the way the UN Comtrade trade flows are. */
function previousFullMonth(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return { start, end, label: start.toISOString().slice(0, 7) };
}

export async function fetchEntsoeCrossBorderFlowsForBorder(border: { inSlug: string; outSlug: string }): Promise<MetricPoint[]> {
  const { start, end, label } = previousFullMonth();
  const inZone = EU_GRID_ZONES[border.inSlug];
  const outZone = EU_GRID_ZONES[border.outSlug];
  const points: MetricPoint[] = [];

  for (const [dirIn, dirOut, pairKey] of [
    [inZone, outZone, `${border.outSlug}_to_${border.inSlug}`],
    [outZone, inZone, `${border.inSlug}_to_${border.outSlug}`],
  ] as const) {
    const xml = await entsoeQuery({ documentType: "A11", in_Domain: dirIn, out_Domain: dirOut, periodStart: formatPeriod(start), periodEnd: formatPeriod(end) });
    if (!xml) continue;
    const series = parseTimeSeriesQuantities(xml, "quantity");
    const allPoints = series.get("default") ?? [];
    if (allPoints.length === 0) continue;
    // 15-minute-average-MW points -> MWh by multiplying by 0.25h each, summed
    // over the month, then expressed in GWh for readability.
    const totalMwh = allPoints.reduce((a, p) => a + p.value * 0.25, 0);
    points.push({
      metric_key: `energy.eu_trade.${pairKey}`,
      observed_at: `${label}-01`,
      value: totalMwh / 1000,
      unit: "GWh",
      source_key: "entsoe",
      source_tier: 1,
      frequency: "monthly",
    });
    await delay(300);
  }
  return points;
}
