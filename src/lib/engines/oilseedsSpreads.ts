import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, zScore, type Point } from "../metrics/stats";

/**
 * Vegetable Oil Relative Value Matrix — Oilseeds engine, spec §26-27.
 * Computed entirely from existing Pink Sheet prices ($/mt, monthly) already
 * in this app — no new ingestion. Each spread is z-scored against its own
 * trailing history so a $200/mt gap means something different for a pair
 * that normally moves $50 apart versus one that normally moves $400 apart.
 */

const PAIRS: { a: string; b: string; label: string }[] = [
  { a: "soybean_oil", b: "palm_oil", label: "Soybean Oil vs Palm Oil" },
  { a: "soybean_oil", b: "sunflower_oil", label: "Soybean Oil vs Sunflower Oil" },
  { a: "soybean_oil", b: "rapeseed_oil", label: "Soybean Oil vs Rapeseed Oil" },
  { a: "rapeseed_oil", b: "sunflower_oil", label: "Rapeseed Oil vs Sunflower Oil" },
];

export type OilSpreadRow = {
  label: string;
  spread: number | null;
  asOf: string | null;
  zScore5y: number | null;
};

export async function getVegetableOilSpreads(db: SupabaseClient): Promise<OilSpreadRow[]> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 10);
  const sinceIso = since.toISOString();

  const slugs = [...new Set(PAIRS.flatMap((p) => [p.a, p.b]))];
  const seriesBySlug = new Map<string, Point[]>();
  await Promise.all(
    slugs.map(async (slug) => {
      seriesBySlug.set(slug, await fetchSeries(db, `commodity.${slug}.price`, sinceIso));
    })
  );

  return PAIRS.map((pair) => {
    const seriesA = seriesBySlug.get(pair.a) ?? [];
    const seriesB = seriesBySlug.get(pair.b) ?? [];
    const byDateB = new Map(seriesB.map((p) => [p.t, p.v]));

    const spreadSeries: Point[] = [];
    for (const p of seriesA) {
      const bVal = byDateB.get(p.t);
      if (bVal === undefined) continue;
      spreadSeries.push({ t: p.t, v: p.v - bVal });
    }
    spreadSeries.sort((x, y) => (x.t < y.t ? -1 : 1));

    const lastSpread = latest(spreadSeries);
    return {
      label: pair.label,
      spread: lastSpread?.v ?? null,
      asOf: lastSpread?.t ?? null,
      zScore5y: zScore(spreadSeries, 60),
    };
  });
}
