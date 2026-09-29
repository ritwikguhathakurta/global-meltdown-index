/**
 * Shared types for the Geopolitical page-level analytical layer (src/lib/geopolitical/).
 * This module computes DISPLAY metrics only — it is NOT registered in gfmi.ts's composite. The
 * existing registered `geopolitical` engine (src/lib/engines/geopolitical.ts, GFMI weight 0.6,
 * built on the Caldara-Iacoviello GPR index) already holds the GFMI seat; this layer exists
 * purely to power the dashboard's own tabs, the same split documented for
 * src/lib/derivatives/ vs. src/lib/engines/derivativesLeverage.ts (see docs/DERIVATIVES_ENGINE.md).
 * No server imports here, same discipline as src/lib/derivatives/ and src/lib/carry/, so this
 * module can be unit-tested with `npm run test:geopolitical` without a database.
 */

/** Every number shown must say whether it's a real observation or a heuristic built from real
 * proxies. Never REAL for a value this repo can't actually source for free. */
export type DataQuality = "REAL" | "MODEL_ESTIMATE" | "UNAVAILABLE";

export type Reading = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  asOf: string | null;
  quality: DataQuality;
  /** For MODEL_ESTIMATE readings: which real proxies fed the heuristic, and why. */
  methodology?: string;
};

/** 0-100 composite, LEVEL and CHANGE kept separate (never one blended number). */
export type CompositeIndex = {
  key: string;
  label: string;
  level: number | null;
  change4w: number | null;
  quality: DataQuality;
  methodology: string;
  inputs: Reading[];
};

export type CountryMilitaryRow = {
  countrySlug: string;
  countryLabel: string;
  spendPctGdp: number | null;
  spendUsd: number | null;
  spendUsdYoyPct: number | null;
  asOf: string | null;
};

export type ChokepointRow = {
  slug: string;
  label: string;
  transitsPerDay: number | null;
  transitsZ: number | null;
  asOf: string | null;
};
