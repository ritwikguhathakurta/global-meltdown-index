import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLatestForKeys } from "../metrics/store";
import { EU_GRID_ZONES, EU_GRID_ZONE_LABELS, EU_GRID_BORDERS, FUEL_BUCKETS, type FuelBucket } from "../sources/entsoe";

/**
 * European Grid Monitor + Cross-Border Electricity Trade Network — built on
 * ENTSO-E Transparency Platform data (spec-equivalent extension of the
 * existing US ISO Grid Monitor to Europe, plus a genuine physical-flow
 * trade network alongside the UN Comtrade-based Energy Trade Network).
 *
 * Day-ahead price is a real EUR/MWh clearing price (not a US-style locational
 * marginal price, but the closest real European equivalent); load and
 * generation are real MW levels from each TSO's own reporting, bucketed into
 * six fuel families. Cross-border flows are real physical MW readings
 * aggregated to a monthly GWh total per direction (see entsoe.ts — ENTSO-E
 * itself caps this document type at a 1-month query window, so this is a
 * monthly snapshot, not an annual trade value like the UN Comtrade flows).
 */

export type EuropeanGridRow = {
  slug: string;
  label: string;
  dayAheadPrice: number | null;
  dayAheadPriceAsOf: string | null;
  dayAheadPricePrevious: number | null;
  loadMw: number | null;
  loadMwAsOf: string | null;
  generationMix: Partial<Record<FuelBucket, number>>;
  totalGenerationMw: number | null;
};

export type EuropeanTradeFlow = {
  fromSlug: string;
  fromLabel: string;
  toSlug: string;
  toLabel: string;
  valueGwh: number;
  month: string; // "YYYY-MM"
};

export type EuropeanGridResult = {
  rows: EuropeanGridRow[];
  tradeFlows: EuropeanTradeFlow[];
};

function labelFor(slug: string): string {
  return EU_GRID_ZONE_LABELS[slug] ?? slug;
}

export async function getEuropeanGrid(db: SupabaseClient): Promise<EuropeanGridResult> {
  const slugs = Object.keys(EU_GRID_ZONES);
  const keys: string[] = [];
  for (const slug of slugs) {
    keys.push(`energy.eu_grid.${slug}.day_ahead_price`, `energy.eu_grid.${slug}.load_mw`);
    for (const bucket of FUEL_BUCKETS) keys.push(`energy.eu_grid.${slug}.generation_mw.${bucket}`);
  }

  const borderPairKeys: { key: string; fromSlug: string; toSlug: string }[] = [];
  for (const b of EU_GRID_BORDERS) {
    borderPairKeys.push({ key: `energy.eu_trade.${b.outSlug}_to_${b.inSlug}`, fromSlug: b.outSlug, toSlug: b.inSlug });
    borderPairKeys.push({ key: `energy.eu_trade.${b.inSlug}_to_${b.outSlug}`, fromSlug: b.inSlug, toSlug: b.outSlug });
  }

  const [gridLatest, tradeLatest] = await Promise.all([
    fetchLatestForKeys(db, keys),
    fetchLatestForKeys(db, borderPairKeys.map((p) => p.key)),
  ]);

  const rows: EuropeanGridRow[] = slugs.map((slug) => {
    const price = gridLatest.get(`energy.eu_grid.${slug}.day_ahead_price`);
    const load = gridLatest.get(`energy.eu_grid.${slug}.load_mw`);
    const generationMix: Partial<Record<FuelBucket, number>> = {};
    let totalGenerationMw: number | null = null;
    for (const bucket of FUEL_BUCKETS) {
      const g = gridLatest.get(`energy.eu_grid.${slug}.generation_mw.${bucket}`);
      if (g) {
        generationMix[bucket] = g.v;
        totalGenerationMw = (totalGenerationMw ?? 0) + g.v;
      }
    }
    return {
      slug,
      label: labelFor(slug),
      dayAheadPrice: price?.v ?? null,
      dayAheadPriceAsOf: price?.t ?? null,
      dayAheadPricePrevious: price?.previous?.v ?? null,
      loadMw: load?.v ?? null,
      loadMwAsOf: load?.t ?? null,
      generationMix,
      totalGenerationMw,
    };
  });

  const tradeFlows: EuropeanTradeFlow[] = borderPairKeys
    .map((p) => {
      const latest = tradeLatest.get(p.key);
      if (!latest) return null;
      return {
        fromSlug: p.fromSlug,
        fromLabel: labelFor(p.fromSlug),
        toSlug: p.toSlug,
        toLabel: labelFor(p.toSlug),
        valueGwh: latest.v,
        month: latest.t.slice(0, 7),
      };
    })
    .filter((f): f is EuropeanTradeFlow => f !== null)
    .sort((a, b) => b.valueGwh - a.valueGwh);

  return { rows, tradeFlows };
}
