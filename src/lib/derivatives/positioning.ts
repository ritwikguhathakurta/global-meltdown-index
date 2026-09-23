import type { Point } from "../metrics/stats";
import { zScore, latest } from "../metrics/stats";
import type { CompositeIndex, PositioningRow } from "./types";

/**
 * Positioning Crowding Index (PCI) — built entirely from real CFTC COT %-of-open-interest net
 * positions (cftcCot.ts's Legacy, Disaggregated and Traders-in-Financial-Futures reports). A
 * market/category is "crowded" when |z-score of net %OI| >= CROWDED_Z (2.0 = roughly the top/bottom
 * ~2.5% of its own trailing-year history) — the same z-score convention every other engine in this
 * repo uses (metrics/stats.ts), not a bespoke threshold invented for this page.
 */
export const CROWDED_Z = 2.0;

export type PositioningMarketDef = { market: string; category: string; metricKey: string };

export function buildPositioningRow(def: PositioningMarketDef, series: Point[]): PositioningRow {
  const last = latest(series);
  const z = zScore(series, 104); // COT is weekly; 104 weeks = 2 years of trailing history
  return {
    market: def.market,
    category: def.category,
    netPctOi: last?.v ?? null,
    extremityZ: z,
    asOf: last?.t ?? null,
    crowded: z !== null && Math.abs(z) >= CROWDED_Z,
  };
}

/** PCI level = share of tracked market/category rows currently crowded, scaled 0-100. Change is
 * measured against the same share 4 weeks earlier (COT reports weekly, so 4 observations back). */
export function computePci(defs: PositioningMarketDef[], seriesByKey: Map<string, Point[]>): CompositeIndex {
  const rows = defs.map((d) => buildPositioningRow(d, seriesByKey.get(d.metricKey) ?? []));
  const withData = rows.filter((r) => r.extremityZ !== null);
  const level = withData.length > 0 ? (rows.filter((r) => r.crowded).length / withData.length) * 100 : null;

  // 4-observations-back crowding share, recomputed from each series with its last 4 points dropped.
  let changeLevel: number | null = null;
  if (withData.length > 0) {
    const priorRows = defs.map((d) => {
      const full = seriesByKey.get(d.metricKey) ?? [];
      const trimmed = full.length > 4 ? full.slice(0, full.length - 4) : [];
      return buildPositioningRow(d, trimmed);
    });
    const priorWithData = priorRows.filter((r) => r.extremityZ !== null);
    if (priorWithData.length > 0) {
      changeLevel = (priorRows.filter((r) => r.crowded).length / priorWithData.length) * 100 - (level ?? 0);
    }
  }

  return {
    key: "pci",
    label: "Positioning Crowding Index",
    level,
    change4w: changeLevel,
    quality: withData.length > 0 ? "REAL" : "UNAVAILABLE",
    methodology: "Share of tracked CFTC COT market/participant-category rows with |z-score of net %OI| ≥ 2.0 over trailing 2 years, scaled 0-100. Real data throughout — no proxy or estimate.",
    inputs: rows.map((r) => ({
      key: `${r.market}.${r.category}`,
      label: `${r.market} — ${r.category}`,
      value: r.netPctOi,
      unit: "% of open interest",
      asOf: r.asOf,
      quality: r.netPctOi !== null ? "REAL" : "UNAVAILABLE",
    })),
  };
}
