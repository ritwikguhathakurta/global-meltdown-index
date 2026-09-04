/**
 * How far back to fetch/read a series so it has at least ~20 trailing
 * observations for zScore() (src/lib/metrics/stats.ts requires 20 minimum).
 * A uniform 400-day window works for daily/weekly series but starves
 * monthly/quarterly series (400 days = ~13 monthly points, well under 20) —
 * this must be used consistently on both the ingestion side (how much
 * history gets fetched from the source) and the read side (buildIndicator's
 * query window), or ingestion can store enough history that the read side
 * still can't see it.
 */
export function lookbackDaysFor(frequency: "daily" | "weekly" | "monthly" | "quarterly"): number {
  switch (frequency) {
    case "daily":
    case "weekly":
      return 400;
    case "monthly":
      return 1900; // ~5.2 years -> ~60+ monthly observations
    case "quarterly":
      return 9125; // ~25 years -> covers true quarterly series and the annual-frequency
    // series (e.g. IMF debt/GDP) that are bucketed as "quarterly" for lack of an annual type
  }
}
