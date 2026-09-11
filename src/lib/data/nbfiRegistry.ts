/**
 * Non-Bank Financial Intermediation (NBFI) Monitoring Registry.
 *
 * The Liquidity master spec explicitly calls out NBFI as a first-class
 * liquidity amplifier, not a footnote — this registry is the counterpart to
 * centralBankFsrRegistry.ts, but for the ONE genuinely global, authoritative
 * source that exists for NBFI system-wide size/growth/leverage/liquidity-
 * mismatch monitoring: the Financial Stability Board's annual "Global
 * Monitoring Report on Nonbank Financial Intermediation" (the FSB itself,
 * not a national regulator, since NBFI is inherently a cross-border, global
 * phenomenon in exactly the way spec's own NBFI sections frame it — "Global
 * Monitoring of NBFI... leverage, liquidity mismatch, funding/
 * interconnectedness").
 *
 * Unlike the 34-country FSR registry, this is deliberately ONE entry, not
 * one per jurisdiction — no national regulator publishes a comparably
 * comprehensive, methodologically-consistent NBFI monitoring report; the
 * FSB's own report is itself a synthesis across 29 jurisdictions covering
 * >90% of global GDP. Splitting this into per-country entries would mean
 * either fabricating jurisdiction-level detail this app cannot verify, or
 * padding the table with mostly-empty rows — both explicitly against this
 * project's discipline.
 *
 * The headline figures below (NBFI sector size, share of global financial
 * assets, growth rate, narrow-measure size) are transcribed directly from
 * the report's own publication-day summary (verified live at fsb.org before
 * being added) — they are NOT auto-extracted or auto-updated; like the FSR
 * registry's stance/bankStanceLevel fields, refreshing them requires a human
 * to read the new edition and edit this file. The FRESHNESS of that
 * transcription is auto-checked on every pipeline run — see nbfiCheck.ts.
 */

export type NbfiMonitoringEntry = {
  key: string;
  institution: string;
  reportName: string;
  reportUrl: string;
  publishedDate: string; // ISO date
  cadenceLabel: string;
  /** Jurisdictions covered by the underlying data collection, per the report's own methodology statement. */
  coverageNote: string;
  /** Total NBFI sector assets, as stated in the report itself. */
  totalAssetsUsdTn: number;
  /** NBFI sector's share of total global financial assets, as stated in the report itself. */
  shareOfGlobalFinancialAssetsPct: number;
  /** Year-over-year growth of the total NBFI sector, as stated in the report itself. */
  totalAssetsGrowthYoyPct: number;
  /** The FSB's own "narrow measure" — entities engaged in credit intermediation
   * that may pose bank-like financial-stability risks (the sub-set spec's own
   * NBFI sections are most concerned with: leverage, liquidity mismatch,
   * maturity transformation, redemption risk). */
  narrowMeasureUsdTn: number;
  narrowMeasureGrowthYoyPct: number;
  /** The report's own stated vulnerability findings for the narrow measure — curated, human-read, not auto-extracted. */
  stance: string;
  stanceLevel: "calm" | "moderate" | "elevated";
  checkUrl: string;
  checkRegex: string;
  checkExpected: string;
};

export const NBFI_MONITORING_REGISTRY: NbfiMonitoringEntry[] = [
  {
    key: "fsb_global_nbfi_monitoring",
    institution: "Financial Stability Board (FSB)",
    reportName: "Global Monitoring Report on Nonbank Financial Intermediation 2025",
    reportUrl: "https://www.fsb.org/uploads/P161225.pdf",
    publishedDate: "2025-12-16",
    cadenceLabel: "Annual (~mid-December)",
    coverageNote: "29 jurisdictions accounting for over 90% of global GDP; data as of end-2024.",
    totalAssetsUsdTn: 256.8,
    shareOfGlobalFinancialAssetsPct: 51.0,
    totalAssetsGrowthYoyPct: 9.4,
    narrowMeasureUsdTn: 76.3,
    narrowMeasureGrowthYoyPct: 12,
    stance:
      "NBFI sector grew 9.4% in 2024 — double the pace of banking (4.7%) — pushing its share of global financial assets to 51%, near pre-pandemic levels. The narrow measure (entities posing bank-like financial-stability risk) grew 12% to $76.3tn. Most narrow-measure vulnerability metrics were broadly stable, but fixed-income and mixed funds showed high liquidity transformation, while finance companies, broker-dealers and structured-finance vehicles showed high leverage. The report separately flags severe data-availability limitations for private credit.",
    stanceLevel: "moderate",
    checkUrl: "https://www.fsb.org/work-of-the-fsb/financial-innovation-and-structural-change/non-bank-financial-intermediation/",
    // "Nonbank" (no hyphen) is specific to the 2025 edition's title on this
    // listing page — every prior edition (2018-2024) is titled "Non-Bank"
    // (hyphenated), verified directly against the page's own raw text before
    // wiring in. If a future edition reverts to the hyphenated form, this
    // regex will find zero matches (see nbfiCheck.ts's "no match" branch,
    // which reports "needs_review" rather than silently reporting current) —
    // it can only fail safe, never silently stale.
    checkRegex: "Global Monitoring Report on Nonbank Financial Intermediation (\\d{4})",
    checkExpected: "2025",
  },
];
