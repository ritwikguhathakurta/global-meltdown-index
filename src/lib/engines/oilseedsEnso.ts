import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest, type Point } from "../metrics/stats";

/**
 * ENSO (El Niño-Southern Oscillation) state — Oilseeds engine, spec §32-35.
 * Built entirely from NOAA's own Oceanic Niño Index (noaaOni.ts) — the
 * standard official basis for El Niño/La Niña declarations.
 *
 * Phase classification follows NOAA's own published convention: an episode
 * is only "established" once the +-0.5 degC threshold has been met or
 * exceeded for 5 consecutive overlapping seasons; anything shorter is
 * disclosed as "developing" rather than asserted outright. This app does
 * NOT fit a rainfall-to-yield lag model (spec §31/144 asks for one, tested
 * across 1-18 month lags) — that requires a proper statistical backtest
 * against Malaysia/Indonesia yield data this app doesn't have at
 * station/regional level, so it is disclosed as not built rather than
 * asserting an unvalidated lag number.
 */

export type EnsoPhase = "El Nino" | "La Nina" | "Neutral";

export type EnsoState = {
  latestOni: number | null;
  asOf: string | null;
  phase: EnsoPhase | null;
  established: boolean; // true once the threshold has held for >=5 consecutive seasons (NOAA's own convention)
  consecutiveSeasons: number; // consecutive trailing seasons at/beyond the current phase's threshold
  history: Point[]; // last ~8 years, for charting
};

const THRESHOLD = 0.5;

export async function getEnsoState(db: SupabaseClient): Promise<EnsoState> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 8);
  const series = await fetchSeries(db, "climate.enso.oni", since.toISOString());
  const sorted = [...series].sort((a, b) => (a.t < b.t ? -1 : 1));
  const last = latest(sorted);

  if (!last) {
    return { latestOni: null, asOf: null, phase: null, established: false, consecutiveSeasons: 0, history: sorted };
  }

  const currentPhase: EnsoPhase = last.v >= THRESHOLD ? "El Nino" : last.v <= -THRESHOLD ? "La Nina" : "Neutral";

  let consecutiveSeasons = 0;
  if (currentPhase !== "Neutral") {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const v = sorted[i].v;
      const stillInPhase = currentPhase === "El Nino" ? v >= THRESHOLD : v <= -THRESHOLD;
      if (!stillInPhase) break;
      consecutiveSeasons++;
    }
  }

  return {
    latestOni: last.v,
    asOf: last.t,
    phase: currentPhase,
    established: consecutiveSeasons >= 5,
    consecutiveSeasons,
    history: sorted,
  };
}
