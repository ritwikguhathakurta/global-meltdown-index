export type FreshnessStatus = "LIVE" | "RECENT" | "STALE" | "UNAVAILABLE";

/**
 * Maps data age to a freshness status given the series' expected publication frequency.
 * "LIVE" tolerance is intentionally generous for daily series (markets are closed most
 * of the time); it means "as fresh as this source ever gets", not "updated this second".
 */
export function freshnessFor(
  observedAtIso: string | null,
  frequency: "daily" | "weekly" | "monthly" | "quarterly" = "daily"
): FreshnessStatus {
  if (!observedAtIso) return "UNAVAILABLE";
  const ageDays = (Date.now() - new Date(observedAtIso).getTime()) / 86400000;
  const thresholds: Record<string, [number, number]> = {
    daily: [4, 10],
    weekly: [10, 21],
    monthly: [40, 75],
    quarterly: [110, 200],
  };
  const [liveMax, recentMax] = thresholds[frequency];
  if (ageDays <= liveMax) return "LIVE";
  if (ageDays <= recentMax) return "RECENT";
  return "STALE";
}

export function gradeFor(sourceTier: number, freshness: FreshnessStatus): "A" | "B" | "C" | "D" | "F" {
  if (freshness === "UNAVAILABLE") return "F";
  if (sourceTier === 1) return freshness === "STALE" ? "B" : "A";
  if (sourceTier === 2) return freshness === "STALE" ? "C" : "B";
  if (sourceTier === 3) return freshness === "STALE" ? "D" : "C";
  return freshness === "LIVE" ? "D" : "F";
}
