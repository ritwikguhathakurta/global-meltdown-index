import type { Point } from "../metrics/stats";
import { latest, pctChangeOverDays, mean } from "../metrics/stats";
import type { CompositeIndex, Reading, ConflictRegionRow } from "./types";

/**
 * Per-region conflict rows (real: ucdpConflict.ts's monthly battle-death fatality and event-count
 * aggregates, UCDP GED, Tier 1) and a Conflict Intensity composite — the average month-over-month
 * change in battle-death fatalities across UCDP's five standard regions. Real throughout: every
 * input is a genuine, official event-level dataset aggregated to a real monthly total, not a
 * fabricated severity score.
 *
 * Distinct from Escalation (escalation.ts), which is GDELT/GPR-derived — automated text-coding of
 * news coverage. This composite is built from actual recorded battle-death events, a materially
 * more concrete signal, so it's kept as its own reading rather than folded into Escalation.
 *
 * zScore() needs 20+ observations and the daily pipeline only ever carries the trailing ~13
 * months (ucdpConflict.ts's own lookback, sized to the API's pagination cap — UCDP's full history
 * since 1989 is hundreds of thousands of events, far more than one run can page through). Same
 * short-history situation military.ts hit with SIPRI/World Bank annual data: a fixed, documented
 * scale is used instead of a fabricated z-score. +/-50% month-over-month change in a region's
 * battle-death total is a genuinely large move (UCDP regions are continent-sized aggregates, so
 * swings this big reflect a real escalation/de-escalation, not noise).
 */
export function buildConflictRegionRows(inputs: {
  regions: { slug: string; label: string }[];
  fatalitiesBySlug: Record<string, Point[]>;
  eventCountBySlug: Record<string, Point[]>;
}): ConflictRegionRow[] {
  return inputs.regions.map(({ slug, label }) => {
    const fatalitiesSeries = inputs.fatalitiesBySlug[slug] ?? [];
    const eventSeries = inputs.eventCountBySlug[slug] ?? [];
    const latestFatalities = latest(fatalitiesSeries);
    const latestEvents = latest(eventSeries);
    return {
      regionSlug: slug,
      regionLabel: label,
      fatalities: latestFatalities?.v ?? null,
      fatalitiesChangePct: pctChangeOverDays(fatalitiesSeries, 90),
      eventCount: latestEvents?.v ?? null,
      asOf: latestFatalities?.t ?? latestEvents?.t ?? null,
    };
  });
}

export function computeConflictIntensity(rows: ConflictRegionRow[]): CompositeIndex {
  const readings: Reading[] = [];
  const changes: number[] = [];

  for (const r of rows) {
    if (r.fatalities !== null) {
      readings.push({ key: `${r.regionSlug}_fatalities`, label: `${r.regionLabel} battle-death fatalities (monthly)`, value: r.fatalities, unit: "deaths", asOf: r.asOf, quality: "REAL" });
    }
    if (r.fatalitiesChangePct !== null) {
      readings.push({ key: `${r.regionSlug}_change`, label: `${r.regionLabel} fatalities, 90-day change`, value: r.fatalitiesChangePct, unit: "%", asOf: r.asOf, quality: "REAL" });
      changes.push(r.fatalitiesChangePct);
    }
  }

  if (changes.length === 0) {
    return { key: "conflict_intensity", label: "Conflict Intensity Index", level: null, change4w: null, quality: "UNAVAILABLE", methodology: "No UCDP region has at least two monthly observations yet.", inputs: readings };
  }

  const avgChange = mean(changes);
  const level = Math.max(0, Math.min(100, 50 + (avgChange / 50) * 25));

  return {
    key: "conflict_intensity",
    label: "Conflict Intensity Index",
    level,
    change4w: null,
    quality: "REAL",
    methodology: `Average 90-day change in monthly battle-death fatalities (UCDP GED) across ${changes.length} tracked regions, mapped to 0-100 as 50 + 25x(avg change / 50%). Real recorded battle-death event data throughout, not automated text-coding or a modeled severity score.`,
    inputs: readings,
  };
}
