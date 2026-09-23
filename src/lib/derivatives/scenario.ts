import type { CompositeIndex } from "./types";

/**
 * Deterministic scenario / reverse-stress-test calculator (spec §82-84, §133-134). No fabricated
 * dealer gamma, margin-call amounts or forced-selling volumes — this is a transparent, documented
 * linear sensitivity model over the same MODEL_ESTIMATE stress proxies already computed in
 * stress.ts, so a user can see exactly how a shock maps to a change in those same page-level
 * numbers. It does not claim to predict an actual dollar amount of margin calls or collateral
 * demand — spec §82's "additional margin / collateral requirement / estimated forced selling"
 * dollar outputs are NOT produced, since nothing here has real margin or dealer-book data to size
 * them against; only the directional/index-level impact is shown, clearly labeled as an estimate.
 */
export type ScenarioInput = {
  equityPct: number; // e.g. -15 for a 15% equity decline
  ratesBp: number; // e.g. +100 for a 100bp yield rise
  usdPct: number; // e.g. +5 for a 5% USD appreciation
  vixPct: number; // e.g. +50 for a 50% VIX increase
};

export type ScenarioOutput = {
  input: ScenarioInput;
  msiLevelDelta: number;
  csiLevelDelta: number;
  pciLevelDelta: number;
  projectedMsiLevel: number | null;
  projectedCsiLevel: number | null;
  projectedPciLevel: number | null;
  narrative: string[];
};

/** Sensitivities below are documented, order-of-magnitude heuristics (not fitted/backtested
 * coefficients — no labeled historical dataset exists to fit them against): a 10% equity
 * decline maps to roughly +4 MSI points (rising volatility typically raises margin requirements);
 * a 100bp rate shock maps to roughly +6 CSI points (bond collateral value falls, raising haircuts);
 * a 50% VIX spike maps to roughly +10 PCI points (crowded positioning becomes more likely to be
 * forced to unwind). These are directional teaching aids, not a calibrated risk model. */
export function runScenario(input: ScenarioInput, current: { msi: CompositeIndex; csi: CompositeIndex; pci: CompositeIndex }): ScenarioOutput {
  const msiLevelDelta = Math.abs(input.equityPct) * 0.4 + (input.vixPct > 0 ? input.vixPct * 0.15 : 0);
  const csiLevelDelta = Math.abs(input.ratesBp) * 0.06 + Math.abs(input.equityPct) * 0.2;
  const pciLevelDelta = input.vixPct > 0 ? input.vixPct * 0.2 : 0;

  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const projectedMsiLevel = current.msi.level !== null ? clamp(current.msi.level + msiLevelDelta) : null;
  const projectedCsiLevel = current.csi.level !== null ? clamp(current.csi.level + csiLevelDelta) : null;
  const projectedPciLevel = current.pci.level !== null ? clamp(current.pci.level + pciLevelDelta) : null;

  const narrative: string[] = [];
  if (input.equityPct !== 0) narrative.push(`Equity ${input.equityPct > 0 ? "+" : ""}${input.equityPct}% → volatility and margin-stress proxies rise roughly in proportion to the move's size, not its direction.`);
  if (input.ratesBp !== 0) narrative.push(`Rates ${input.ratesBp > 0 ? "+" : ""}${input.ratesBp}bp → bond collateral values fall, pushing the collateral-stress proxy up.`);
  if (input.vixPct > 0) narrative.push(`VIX +${input.vixPct}% → crowded positioning (PCI) becomes more likely to be tested, and margin-stress proxy rises further.`);
  if (input.usdPct !== 0) narrative.push(`USD ${input.usdPct > 0 ? "+" : ""}${input.usdPct}% has no direct sensitivity in this model — shown for reference only (no free cross-currency margin/collateral data exists to size its effect).`);
  narrative.push("These are directional, order-of-magnitude estimates over already-labeled MODEL ESTIMATE proxies — not a calibrated forecast of real margin calls, collateral demand or forced-selling volume.");

  return { input, msiLevelDelta, csiLevelDelta, pciLevelDelta, projectedMsiLevel, projectedCsiLevel, projectedPciLevel, narrative };
}
