export type IndicatorRow = {
  key: string;
  label: string;
  classification: string;
  value: number | null;
  unit?: string;
  status: string;
  sourceKey: string;
  sourceTier: number;
  asOf: string | null;
};

export type EngineRow = {
  engine_key: string;
  as_of: string;
  horizon: string;
  score: number | null;
  direction: string;
  regime: string;
  confidence: number;
  top_drivers: { key: string; label: string; contribution: number }[];
  leading_indicators: IndicatorRow[];
  coincident_indicators: IndicatorRow[];
  lagging_indicators: IndicatorRow[];
  contradictory_evidence: string[];
  not_yet_happened: string[];
  trigger_desc: string;
  amplifiers: string[];
  transmission_mechanism: string;
  invalidation_conditions: string[];
  confirmation_conditions: string[];
  methodology_version: string;
  data_completeness: number;
};
