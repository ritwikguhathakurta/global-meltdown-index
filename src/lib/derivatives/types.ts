/**
 * Shared types for the Derivatives & Leverage page-level analytical layer (src/lib/derivatives/).
 * This module computes DISPLAY metrics only — it is NOT registered in gfmi.ts's composite (see
 * docs/DERIVATIVES_ENGINE.md for why). No server imports here, same discipline as src/lib/carry/,
 * so this module can be unit-tested with `npm run test:derivatives` without a database.
 */

/** A single named reading with a provenance tag — every number shown on the dashboard must say
 * whether it's a real observation or a heuristic built from real proxies. Never REAL for a value
 * this repo can't actually source for free. */
export type DataQuality = "REAL" | "MODEL_ESTIMATE" | "UNAVAILABLE";

export type Reading = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  asOf: string | null;
  quality: DataQuality;
  /** For MODEL_ESTIMATE readings: which real proxies fed the heuristic, and why. Required
   * whenever quality is MODEL_ESTIMATE (enforced by the composers below, not by the type system). */
  methodology?: string;
};

/** 0-100 composite index (matches the spec's own scale for GDSI/GLI/MSI/etc.), split into LEVEL and
 * CHANGE per the "never one blended number" design principle (spec §148) — a page renders both,
 * never a single number pretending to carry both level and momentum information. */
export type CompositeIndex = {
  key: string;
  label: string;
  level: number | null;
  change4w: number | null;
  quality: DataQuality;
  methodology: string;
  inputs: Reading[];
};

export type LeverageRegime =
  | "LOW_LEVERAGE"
  | "NORMAL"
  | "BUILDING"
  | "HIGH"
  | "CROWDED"
  | "FRAGILE"
  | "DELEVERAGING"
  | "CASCADE";

export type PositioningRow = {
  market: string;
  category: string;
  netPctOi: number | null;
  extremityZ: number | null;
  asOf: string | null;
  crowded: boolean;
};
