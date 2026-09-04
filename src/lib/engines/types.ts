export type Horizon = "short" | "medium" | "long";

export type IndicatorRef = {
  key: string;
  label: string;
  classification: "leading" | "coincident" | "lagging";
  value: number | null;
  unit?: string;
  status: "LIVE" | "RECENT" | "STALE" | "UNAVAILABLE";
  sourceKey: string;
  sourceTier: number;
  asOf: string | null;
};

export type EngineResult = {
  engineKey: string;
  asOf: string;
  horizon: Horizon;
  score: number | null; // 0-100, null if too much data missing to be meaningful
  direction: "improving" | "deteriorating" | "stable" | "unknown";
  regime: string;
  confidence: number; // 0-1, driven by data completeness
  topDrivers: { key: string; label: string; contribution: number }[];
  leadingIndicators: IndicatorRef[];
  coincidentIndicators: IndicatorRef[];
  laggingIndicators: IndicatorRef[];
  contradictoryEvidence: string[];
  notYetHappened: string[];
  triggerDesc: string;
  amplifiers: string[];
  transmissionMechanism: string;
  invalidationConditions: string[];
  confirmationConditions: string[];
  dataCompleteness: number; // fraction of indicators with LIVE/RECENT status
  methodologyVersion: string;
};

export type EngineContext = {
  db: import("@supabase/supabase-js").SupabaseClient;
  asOf: string;
};
