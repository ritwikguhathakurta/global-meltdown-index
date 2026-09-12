import type { CommodityHeatmapResult, CommodityDirectionLabel } from "./commodities";
import { classifyDirection } from "./commodities";
import type { CommodityBalanceResult } from "./commodityBalance";

/**
 * Momentum + Balance Composite — explicitly NOT the ~115-section spec's
 * full Commodity Direction Score. That formula (referenced in this app's
 * own earlier disclosures as momentum 10% / demand 20% / supply 15% /
 * inventory 15% / balance 15%) only accounts for 75% of its own stated
 * weighting — the remaining ~25% component was never fully captured from
 * the original spec text, and rather than invent a number to fill that
 * gap, this is a smaller, honestly-scoped two-factor blend built only from
 * data this app actually has:
 *
 *   - price momentum (engines/commodities.ts's own z-scored return blend)
 *   - a balance "tightness" signal: where the latest stocks-to-use ratio
 *     sits vs. its own full history (0 = tightest ever, seen as bullish;
 *     100 = loosest ever, seen as bearish), inverted onto the same -100..
 *     +100 scale as momentum
 *
 * Simple equal weight (50/50) — not a spec-derived ratio, just the
 * obvious default for two factors with no basis to prefer one. Only
 * covers the ~16 commodities where this app has BOTH a price series and a
 * USDA-PSD-style consumption series under the same slug (see the overlap
 * between taxonomy.ts and balanceTaxonomy.ts) — everything else keeps
 * showing momentum-only or balance-only in their own existing tables.
 */

export type CompositeRow = {
  slug: string;
  label: string;
  momentumScore: number | null;
  balanceScore: number | null;
  compositeScore: number | null;
  direction: CommodityDirectionLabel;
};

export type CommodityCompositeResult = {
  rows: CompositeRow[];
};

function balanceScoreFromPercentile(percentile: number | null): number | null {
  if (percentile === null) return null;
  // percentile 0 (tightest ever) -> +100 (bullish); 100 (loosest ever) -> -100 (bearish)
  return Math.round((50 - percentile) * 2);
}

export function getCommodityComposite(heatmap: CommodityHeatmapResult, balances: CommodityBalanceResult): CommodityCompositeResult {
  const balanceBySlug = new Map(balances.rows.map((r) => [r.slug, r]));
  const rows: CompositeRow[] = [];

  for (const priceRow of heatmap.rows) {
    const balanceRow = balanceBySlug.get(priceRow.slug);
    if (!balanceRow) continue; // only the price+balance overlap set

    const balanceScore = balanceScoreFromPercentile(balanceRow.stocksToUsePercentile);
    const momentumScore = priceRow.momentumScore;

    let compositeScore: number | null;
    if (momentumScore !== null && balanceScore !== null) {
      compositeScore = Math.round((momentumScore + balanceScore) / 2);
    } else {
      compositeScore = momentumScore ?? balanceScore;
    }

    rows.push({
      slug: priceRow.slug,
      label: priceRow.label,
      momentumScore,
      balanceScore,
      compositeScore,
      direction: classifyDirection(compositeScore),
    });
  }

  return { rows: rows.sort((a, b) => (b.compositeScore ?? -Infinity) - (a.compositeScore ?? -Infinity)) };
}
