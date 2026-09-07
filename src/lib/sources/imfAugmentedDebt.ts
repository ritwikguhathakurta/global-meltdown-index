import type { MetricPoint } from "../metrics/store";

/**
 * China LGFV (Local Government Financing Vehicle) debt has no standing,
 * machine-readable public data series anywhere — checked FRED, OECD, World
 * Bank, BIS, and the IMF's own DataMapper API (which covers General
 * Government Debt for China but nothing broken out for LGFVs). The one
 * place a real, official number exists is the IMF's annual China Article IV
 * Consultation staff report, which publishes a staff-estimated "Augmented
 * Debt" series — general government debt plus government-guided funds and
 * LGFV activity — in a "Text Table"/"Memorandum Items" line each year, with
 * an explicit footnote: "Augmented Debt includes debt of LGFVs and other
 * off-budget government funds."
 *
 * These are IMF staff *estimates* (not an official Chinese government
 * statistic — no such statistic exists, which is the entire reason LGFV
 * debt is an analytical/surveillance concern rather than a routine data
 * release), published roughly once a year, only as PDF prose/tables — no
 * API to poll. The values below were extracted directly from the most
 * recent report's own historical table (verified against two independent
 * mentions within the same document, and cross-checked against the prior
 * year's report and independent reporting on the same figures) and are
 * NOT projections — the IMF report's own forward years (2026-2030) are
 * explicitly staff projections, not observations, and are deliberately
 * excluded here to avoid mixing forecasts into a historical series.
 *
 * Source: IMF Country Report No. 26/044, "People's Republic of China:
 * 2025 Article IV Consultation" (published February 2026),
 * https://www.imf.org/en/publications/cr/issues/2026/02/17/peoples-republic-of-china-2025-article-iv-consultation-press-release-staff-report-and-574028
 * Text Table 3 ("Selected Economic Indicators") and Annex table, "Augmented
 * debt (percent of GDP)" row: 2020=97.5, 2021=98.7, 2022=104.2, 2023=111.3,
 * 2024=117.0, 2025=126.6 (2025 is the report's current-year estimate).
 *
 * THIS IS NOT AN AUTO-REFRESHING FEED. There is no source to poll daily;
 * this array needs a human to append one point after each new China
 * Article IV Consultation report is published (usually Q4/Q1 each year) —
 * see the same table in the new report. Until then, this correctly shows
 * RECENT/STALE per the "annual" freshness window, same as our other
 * genuinely-annual indicators (debt/GDP ratios, 10-K debt maturity), which
 * is an accurate reflection of how often this data actually changes, not a
 * pipeline bug.
 */
const AUGMENTED_DEBT_PCT_GDP: { year: number; value: number }[] = [
  { year: 2020, value: 97.5 },
  { year: 2021, value: 98.7 },
  { year: 2022, value: 104.2 },
  { year: 2023, value: 111.3 },
  { year: 2024, value: 117.0 },
  { year: 2025, value: 126.6 },
];

export function fetchChinaLgfvDebt(): MetricPoint[] {
  return AUGMENTED_DEBT_PCT_GDP.map(({ year, value }) => ({
    metric_key: "china.lgfv_debt",
    observed_at: `${year}-12-31`,
    value,
    unit: "% of GDP",
    source_key: "imf_article_iv",
    source_tier: 1,
    frequency: "annual",
  }));
}
