import type { Point } from "../metrics/stats";
import { pctChangeOverDays, latest, zScore, mean } from "../metrics/stats";
import type { CompositeIndex, Reading, CountryMilitaryRow } from "./types";

/**
 * Per-country military spending rows (real: sipriMilex.ts %-of-GDP + worldBankMilitary.ts
 * absolute USD) and a Military Buildup composite — the average z-scored year-over-year growth
 * in USD military spending across tracked countries. Real data throughout: every input is an
 * official published figure, and the composite is a genuine average of real growth rates, not a
 * proxy standing in for something unobservable.
 */
export function buildCountryMilitaryRows(inputs: {
  countries: { slug: string; label: string }[];
  spendPctGdpByCountry: Record<string, Point[]>;
  spendUsdByCountry: Record<string, Point[]>;
}): CountryMilitaryRow[] {
  return inputs.countries.map(({ slug, label }) => {
    const pctSeries = inputs.spendPctGdpByCountry[slug] ?? [];
    const usdSeries = inputs.spendUsdByCountry[slug] ?? [];
    const latestPct = latest(pctSeries);
    const latestUsd = latest(usdSeries);
    return {
      countrySlug: slug,
      countryLabel: label,
      spendPctGdp: latestPct?.v ?? null,
      spendUsd: latestUsd?.v ?? null,
      spendUsdYoyPct: pctChangeOverDays(usdSeries, 365),
      asOf: latestUsd?.t ?? latestPct?.t ?? null,
    };
  });
}

export function computeMilitaryBuildup(rows: CountryMilitaryRow[]): CompositeIndex {
  const readings: Reading[] = [];
  const growthRates = rows.filter((r) => r.spendUsdYoyPct !== null).map((r) => r.spendUsdYoyPct as number);

  for (const r of rows) {
    if (r.spendUsdYoyPct === null) continue;
    readings.push({ key: `${r.countrySlug}_yoy`, label: `${r.countryLabel} military spend YoY`, value: r.spendUsdYoyPct, unit: "%", asOf: r.asOf, quality: "REAL" });
  }

  if (growthRates.length === 0) {
    return { key: "military_buildup", label: "Military Buildup Index", level: null, change4w: null, quality: "UNAVAILABLE", methodology: "No year-over-year military-spending growth data available yet (needs at least two annual observations per country).", inputs: readings };
  }

  const avgGrowth = mean(growthRates);
  // SIPRI/World Bank annual data has no natural z-score baseline within this connector alone (only
  // ~20 countries x a handful of years) — a fixed, documented scale is used instead of a fabricated
  // z-score: +/-10% YoY real-terms growth is a genuinely large single-year move historically.
  const level = Math.max(0, Math.min(100, 50 + (avgGrowth / 10) * 25));

  return {
    key: "military_buildup",
    label: "Military Buildup Index",
    level,
    change4w: null, // annual data — no meaningful 4-week change
    quality: "REAL",
    methodology: `Average year-over-year growth in USD military expenditure across ${growthRates.length} tracked countries (SIPRI + World Bank, both official), mapped to 0-100 as 50 + 25×(avg growth / 10%). Real data throughout; annual frequency, so this updates slowly by design.`,
    inputs: readings,
  };
}

/** Not composed here — kept available for a future dashboard use of a full z-score against a
 * country's own trailing history once enough annual observations accumulate (needs 20+ years,
 * which SIPRI's own back-series already has once ingested). */
export function militarySpendZ(series: Point[]): number | null {
  return zScore(series, 20);
}
