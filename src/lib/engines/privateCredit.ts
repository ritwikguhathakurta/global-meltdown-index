import type { EngineContext, EngineResult, Horizon } from "./types";
import { buildIndicator } from "./indicator";
import { composeEngineResult } from "./compose";

/**
 * Private Credit engine (V3 §20) — explicitly a market-price proxy, not the
 * AUM/non-accrual/covenant/underwriting-standards data the spec envisions.
 * No free source publishes that data (Cliffwater, PitchBook LCD and similar
 * are paid). What free data *does* exist: publicly-traded BDCs (Business
 * Development Companies) report their portfolios' credit quality quarterly,
 * and their share prices react in real time to the market's assessment of
 * that quality, historically leading reported NAV markdowns. BDCs are a
 * US-specific regulatory structure (Investment Company Act of 1940) with no
 * direct G7-country equivalent that trades as liquidly, so this stays
 * intentionally US-anchored rather than guessing at thinly-traded foreign
 * direct-lending vehicles.
 */
export async function runPrivateCreditEngine(ctx: EngineContext, horizon: Horizon): Promise<EngineResult> {
  const [arcc, main, fsk, obdc, bxsl] = await Promise.all([
    buildIndicator(ctx.db, "privatecredit.bdc_arcc", "Ares Capital (ARCC)", "leading", "daily", "USD"),
    buildIndicator(ctx.db, "privatecredit.bdc_main", "Main Street Capital (MAIN)", "leading", "daily", "USD"),
    buildIndicator(ctx.db, "privatecredit.bdc_fsk", "FS KKR Capital (FSK)", "leading", "daily", "USD"),
    buildIndicator(ctx.db, "privatecredit.bdc_obdc", "Blue Owl Capital Corp (OBDC)", "leading", "daily", "USD"),
    buildIndicator(ctx.db, "privatecredit.bdc_bxsl", "Blackstone Secured Lending (BXSL)", "leading", "daily", "USD"),
  ]);

  return composeEngineResult({
    engineKey: "private_credit",
    asOf: ctx.asOf,
    horizon,
    regimeLabels: ["AMPLE_LIQUIDITY", "STABLE", "REPRICING", "STRESS_PRICED_IN", "MARKET_DISLOCATION"],
    inputs: [
      { ref: arcc.ref, series: arcc.series, weight: 1.0, zDirection: -1 },
      { ref: main.ref, series: main.series, weight: 0.8, zDirection: -1 },
      { ref: fsk.ref, series: fsk.series, weight: 0.7, zDirection: -1 },
      { ref: obdc.ref, series: obdc.series, weight: 0.8, zDirection: -1 },
      { ref: bxsl.ref, series: bxsl.series, weight: 0.7, zDirection: -1 },
    ],
    triggerDesc:
      "A broad, simultaneous decline across multiple large BDCs (rather than one company's idiosyncratic problem) is the pattern that would indicate the market is pricing in systemic private-credit portfolio deterioration ahead of the next quarterly NAV/non-accrual disclosure.",
    transmissionMechanism:
      "BDCs typically use leverage themselves; a sustained price decline can push them toward asset-coverage limits, forcing deleveraging or dividend cuts, while the underlying stress (borrower distress at portfolio companies, many in software/AI/data-center/CRE-adjacent sectors) can simultaneously pressure bank and insurance-company private-credit exposures this free dataset cannot see directly.",
    amplifiers: [
      "Simultaneous Banking engine deterioration (banks increasingly co-invest in and lend to private-credit funds)",
      "Simultaneous AI/data-center financing stress once the AI-related engines are built (private credit is a major funding source for data-center buildout)",
      "BDC discount-to-NAV widening sharply (not tracked — this engine sees price only, not disclosed NAV)",
    ],
    invalidationConditions: ["Tracked BDC prices stabilize or recover", "No confirmed rise in reported non-accruals at the next quarterly disclosure"],
    confirmationConditions: ["Reported non-accrual rates rise at quarterly disclosure (not tracked in real time — no free source)", "Simultaneous leveraged-loan or private-equity markdown activity"],
    notYetHappened: ["No confirmed broad-based BDC price decline has been detected in the tracked basket"],
    contradictoryEvidence: ["Share price is a market-sentiment proxy, not the underlying portfolio data — a genuinely deteriorating loan book could exist for a quarter or more before it is fully priced in"],
    methodologyVersion: "v0.1-freedata-proxy",
  });
}
