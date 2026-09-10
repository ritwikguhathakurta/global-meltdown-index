/**
 * Central Bank Financial Stability Report (FSR) Verification Registry.
 *
 * Every G7 + China + India central bank (the same nine-country universe as
 * bankingSystemicRisk.ts, reusing BANKING_COUNTRIES' keys) publishes its own
 * periodic "soundness and resilience of the financial system" assessment —
 * the Fed's "Financial Stability Report", the BoE's "Financial Stability
 * Report", BOJ's "Financial System Report", Bundesbank's "Financial
 * Stability Review", Banca d'Italia's "Financial Stability Report", Banque
 * de France's "Financial Stability Report", the Bank of Canada's "Financial
 * Stability Report", the PBOC's "China Financial Stability Report" and the
 * RBI's "Financial Stability Report".
 *
 * The qualitative fields below (institution, report name, stance,
 * bankStanceLevel) are CURATED and MANUALLY VERIFIED — reading and
 * classifying a report's own content is a human judgment, not something to
 * auto-extract reliably (same discipline as everywhere else in this app).
 * They change only when someone updates this file after reading a new
 * edition, not automatically.
 *
 * The FRESHNESS of that curation, though, IS auto-checked on every pipeline
 * run — see centralBankFsrCheck.ts and the central_bank_fsr_checks table
 * (migration 0019). Each entry below declares HOW to mechanically verify
 * whether a newer edition has likely appeared (checkMethod/checkRegex/
 * checkExpected or feedInstitution), so a stale row gets flagged for review
 * instead of silently going out of date. This was not theoretical: building
 * and testing this check is what caught France's and Canada's rows already
 * being one edition behind the day this was written (see git history).
 *
 * `bankStanceLevel` is a deliberately coarse, human-read classification of
 * that report's OWN stated overall tone (calm / moderate / elevated) —
 * transcribed from the report's own language (or reporting that quotes it
 * directly), not inferred or extrapolated. It exists so the dashboard can
 * flag when this app's own computed composite score reads meaningfully
 * more or less stressed than the central bank's own published assessment —
 * see getBankingSystemicRiskTable's compositeScore and the methodology
 * page's "Central Bank FSR Verification" section for what that comparison
 * does and does NOT claim (it is not a point-in-time backtest: this app does
 * not store historical composite-score snapshots, so the comparison is
 * always against TODAY's composite score, not a reconstructed score as of
 * the report's own publication date — disclosed, not simulated).
 */

export type BankStanceLevel = "calm" | "moderate" | "elevated";

/** How centralBankFsrCheck.ts automatically re-verifies this row is still
 * current, on every pipeline run:
 *  - "rss": the institution already has a live press-release RSS feed wired
 *    up in centralBankRss.ts, accumulating into central_bank_events (Fed,
 *    BoE, RBI). Check whether that table now holds a "Financial Stability
 *    Report"-titled item for this institution dated AFTER publishedDate.
 *  - "html": fetch `checkUrl` (the institution's own publications listing
 *    page, not the specific-edition reportUrl above, since several of these
 *    mint a brand-new URL every edition) and run `checkRegex` (a RegExp
 *    source with exactly one capture group) against the page's tag-stripped,
 *    entity-decoded text. Compare the FIRST match's captured group to
 *    `checkExpected` — a mismatch (or no match at all) means whatever now
 *    appears first in that institution's own listing no longer matches what
 *    this registry has on file, so a newer edition has likely been
 *    published and this row needs a human re-verification pass before the
 *    entry above is edited. Regexes are anchored to each institution's own
 *    real list-row wording (see centralBankFsrCheck.ts's comment for the
 *    exact text this was tested against), not a generic date scan — a
 *    generic scan would also match nav/breadcrumb text or older archived
 *    rows that never disappear from these listing pages. */
export type FsrCheckMethod = "rss" | "html";

export type CentralBankFsrEntry = {
  key: string; // matches BANKING_COUNTRIES key in bankFinancialSoundness.ts
  country: string;
  institution: string;
  reportName: string;
  reportUrl: string;
  publishedDate: string; // ISO yyyy-mm-dd, verified against the source directly
  cadenceDays: number; // typical publication cycle in days, for staleness banding
  cadenceLabel: string;
  stance: string; // short paraphrase of the report's own stated assessment
  bankStanceLevel: BankStanceLevel;
  checkMethod: FsrCheckMethod;
  /** rss only: the exact `institution` value used in centralBankRss.ts's
   * CENTRAL_BANK_FEEDS, to match rows already accumulating in
   * central_bank_events. */
  feedInstitution?: string;
  /** html only: the listing page to fetch. */
  checkUrl?: string;
  /** html only: RegExp source with one capture group, tested against the
   * page's first matching occurrence. */
  checkRegex?: string;
  /** html only: the expected value of that first match's capture group. */
  checkExpected?: string;
};

export const CENTRAL_BANK_FSR_REGISTRY: CentralBankFsrEntry[] = [
  {
    key: "us",
    country: "United States",
    institution: "Federal Reserve Board",
    reportName: "Financial Stability Report",
    reportUrl: "https://www.federalreserve.gov/publications/files/financial-stability-report-20260508.pdf",
    publishedDate: "2026-05-08",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (May / November)",
    stance:
      "Elevated asset valuations and high, concentrated leverage in shadow banking/private credit, alongside moderate funding risk; system judged structurally more resilient than pre-2008 on capital and liquidity.",
    bankStanceLevel: "moderate",
    checkMethod: "rss",
    feedInstitution: "Federal Reserve",
  },
  {
    key: "uk",
    country: "United Kingdom",
    institution: "Bank of England (Financial Policy Committee)",
    reportName: "Financial Stability Report",
    reportUrl: "https://www.bankofengland.co.uk/financial-stability-report/2026/july-2026",
    publishedDate: "2026-07-07",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (~July / December)",
    stance:
      "Households, businesses and the banking system judged resilient enough to support a stress; this edition's stated focus is AI-driven cyber/operational risk, not capital or liquidity stress.",
    bankStanceLevel: "calm",
    checkMethod: "rss",
    feedInstitution: "Bank of England",
  },
  {
    key: "japan",
    country: "Japan",
    institution: "Bank of Japan",
    reportName: "Financial System Report",
    reportUrl: "https://www.boj.or.jp/en/research/brp/fsr/fsr260421.htm",
    publishedDate: "2026-04-21",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (April / October)",
    stance:
      "Financial system stability maintained on the whole and credit intermediation functioning smoothly, though the report flags market volatility from Middle East tensions since late February 2026.",
    bankStanceLevel: "calm",
    checkMethod: "html",
    checkUrl: "https://www.boj.or.jp/en/research/brp/fsr/index.htm",
    checkRegex: "Financial System Report \\(([A-Za-z]+ \\d{4})\\)",
    checkExpected: "April 2026",
  },
  {
    key: "germany",
    country: "Germany",
    institution: "Deutsche Bundesbank",
    reportName: "Financial Stability Review",
    reportUrl: "https://www.bundesbank.de/en/publications/reports/financial-stability-reviews",
    publishedDate: "2025-11-06",
    cadenceDays: 365,
    cadenceLabel: "Annual (November)",
    stance:
      "Risks to the German financial system explicitly stated to have increased — geopolitical tension, trade conflict and rising government debt; bank NPL ratio rising steadily since late 2022, initially concentrated in commercial real estate.",
    bankStanceLevel: "elevated",
    checkMethod: "html",
    checkUrl: "https://www.bundesbank.de/en/publications/reports/financial-stability-reviews",
    checkRegex: "Financial Stability Review (\\d{4}) \\d{2}\\.\\d{2}\\.\\d{4}",
    checkExpected: "2025",
  },
  {
    key: "italy",
    country: "Italy",
    institution: "Banca d'Italia",
    reportName: "Financial Stability Report, No. 1",
    reportUrl: "https://www.bancaditalia.it/pubblicazioni/rapporto-stabilita/index.html",
    publishedDate: "2026-04-29",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (April / November)",
    stance:
      "Main risks judged to stem from international/geopolitical factors rather than domestic credit conditions; household risk described as limited given sound balance sheets and low debt.",
    bankStanceLevel: "moderate",
    checkMethod: "html",
    checkUrl: "https://www.bancaditalia.it/pubblicazioni/rapporto-stabilita/index.html",
    checkRegex: "(\\d{1,2} \\w+ \\d{4}) Rapporto sulla stabilit",
    checkExpected: "29 aprile 2026",
  },
  {
    key: "france",
    country: "France",
    institution: "Banque de France",
    reportName: "Financial Stability Report — June 2026",
    reportUrl: "https://www.banque-france.fr/en/news/financial-stability-report-june-2026",
    publishedDate: "2026-06-24",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (June / December)",
    stance:
      "The French financial system is stated to continue displaying resilience in the face of a series of shocks since 2020, though the report flags new adverse commodity-supply disruption risk from Middle East geopolitical tensions.",
    bankStanceLevel: "moderate",
    // Auto-check verified working with a full browser header set from a
    // residential IP, but returns HTTP 403 from Vercel's serverless IPs —
    // same class of datacenter-IP block seen with the FFIEC CDR webservice
    // elsewhere in this app. Left wired in (rather than downgraded to a
    // manual-only entry) since the block may not be permanent; the
    // dashboard surfaces this honestly as "Check failed", not "Verified".
    checkMethod: "html",
    checkUrl: "https://www.banque-france.fr/en/publications-and-research/our-main-publications/financial-stability-report",
    checkRegex: "Financial stability report - (\\w+ \\d{4})",
    checkExpected: "June 2026",
  },
  {
    key: "canada",
    country: "Canada",
    institution: "Bank of Canada",
    reportName: "Financial Stability Report — 2026",
    reportUrl: "https://www.bankofcanada.ca/publications/financial-stability-report/financial-stability-report-2026/",
    publishedDate: "2026-05-28",
    cadenceDays: 365,
    cadenceLabel: "Annual (May)",
    stance:
      "System stated to have continued functioning well despite US tariffs and trade uncertainty; households/businesses generally stable and banks have strengthened resilience, but vulnerabilities in certain sectors could amplify stress if multiple challenges emerge simultaneously.",
    bankStanceLevel: "moderate",
    checkMethod: "html",
    checkUrl: "https://www.bankofcanada.ca/publications/financial-stability-report/",
    checkRegex: "Financial Stability Report\\W{0,3}(\\d{4})",
    checkExpected: "2026",
  },
  {
    key: "china",
    country: "China",
    institution: "People's Bank of China",
    reportName: "China Financial Stability Report (2025)",
    reportUrl: "https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/2025122616592613805/index.html",
    publishedDate: "2025-12-26",
    cadenceDays: 365,
    cadenceLabel: "Annual (December)",
    stance:
      "Financial risks described as converging and generally controllable; 3,217 of 3,529 rated banking institutions (98% of system assets) rated as operating safely; residual risk concentrated in real estate finance, LGFV debt and small/mid-size local banks.",
    bankStanceLevel: "calm",
    checkMethod: "html",
    checkUrl: "https://www.pbc.gov.cn/en/3688235/3688414/3710021/index.html",
    checkRegex: "Financial Stability Reports (\\d{4})",
    checkExpected: "2025",
  },
  {
    key: "india",
    country: "India",
    institution: "Reserve Bank of India (FSDC Sub-Committee)",
    reportName: "Financial Stability Report",
    reportUrl: "https://rbi.org.in/Scripts/FsReports.aspx",
    publishedDate: "2026-06-30",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (June / December)",
    stance:
      "Domestic financial system resilience described as continuously improving — strong capital buffers, low non-performing loans, robust profitability; stress tests show capital staying above the regulatory minimum even under adverse shocks.",
    bankStanceLevel: "calm",
    checkMethod: "rss",
    feedInstitution: "Reserve Bank of India",
  },
];

export type FsrFreshness = "current" | "due" | "overdue";

export function fsrFreshness(entry: CentralBankFsrEntry, asOf: Date = new Date()): { daysSince: number; status: FsrFreshness } {
  const published = new Date(entry.publishedDate + "T00:00:00Z");
  const daysSince = Math.floor((asOf.getTime() - published.getTime()) / 86400000);
  let status: FsrFreshness = "current";
  if (daysSince > entry.cadenceDays * 1.6) status = "overdue";
  else if (daysSince > entry.cadenceDays * 1.15) status = "due";
  return { daysSince, status };
}

const STANCE_RANK: Record<BankStanceLevel, number> = { calm: 0, moderate: 1, elevated: 2 };

/** Buckets this app's own 0-100 composite score onto the same three-level
 * scale as bankStanceLevel above, purely so the two can be compared —
 * thresholds are the same calm/moderate/elevated/high bands already used
 * elsewhere on the banking dashboard (scoreColor), collapsed to three. */
export function ourStanceLevel(compositeScore: number | null): BankStanceLevel | null {
  if (compositeScore === null) return null;
  if (compositeScore < 40) return "calm";
  if (compositeScore < 65) return "moderate";
  return "elevated";
}

export type StanceComparison = "more_stressed" | "less_stressed" | "consistent";

export function compareStance(ourLevel: BankStanceLevel | null, bankLevel: BankStanceLevel): StanceComparison | null {
  if (ourLevel === null) return null;
  const diff = STANCE_RANK[ourLevel] - STANCE_RANK[bankLevel];
  if (diff > 0) return "more_stressed";
  if (diff < 0) return "less_stressed";
  return "consistent";
}
