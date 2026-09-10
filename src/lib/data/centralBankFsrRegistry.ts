/**
 * Central Bank Financial Stability Report (FSR) Verification Registry.
 *
 * Every G7 + China + India central bank (the same nine-country universe as
 * bankingSystemicRisk.ts, reusing BANKING_COUNTRIES' keys) publishes its own
 * periodic "soundness and resilience of the financial system" assessment —
 * the Fed's "Financial Stability Report", the BoE's "Financial Stability
 * Report", BOJ's "Financial System Report", Bundesbank's "Financial
 * Stability Review", Banca d'Italia's "Financial Stability Report", Banque
 * de France's "Assessment of Risks to the French Financial System", the Bank
 * of Canada's "Financial Stability Report", the PBOC's "China Financial
 * Stability Report" and the RBI's "Financial Stability Report".
 *
 * This registry is a CURATED, MANUALLY-VERIFIED table, not a live feed — by
 * design (the user's own framing: "It need not to be live. It will change
 * whenever central bank publish its report"). Every url/publishedDate below
 * was checked directly against the central bank's own site (or a same-day
 * press report quoting it) at the time this was built; it changes only when
 * someone updates this file after the next edition is published, not
 * automatically. Do not treat a stale-looking date here as this app being
 * behind — check the linked report itself before assuming so.
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
  },
  {
    key: "france",
    country: "France",
    institution: "Banque de France",
    reportName: "Assessment of Risks to the French Financial System",
    reportUrl: "https://www.banque-france.fr/en/publications-and-statistics/publications/financial-stability-report-december-2025",
    publishedDate: "2026-01-20",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (June / December edition)",
    stance:
      "Elevated market valuations and growing interconnection between non-bank financial intermediaries and banks flagged as the key systemic risk; France's own sovereign-debt trajectory flagged as a specific domestic vulnerability.",
    bankStanceLevel: "moderate",
  },
  {
    key: "canada",
    country: "Canada",
    institution: "Bank of Canada",
    reportName: "Financial Stability Report",
    reportUrl: "https://www.bankofcanada.ca/2025/05/financial-stability-report-2025/",
    publishedDate: "2025-05-08",
    cadenceDays: 365,
    cadenceLabel: "Annual (May)",
    stance:
      "System judged resilient with a well-capitalized banking sector, but vulnerabilities described as having grown; U.S. trade policy/tariff uncertainty flagged as the main pressure on the outlook.",
    bankStanceLevel: "moderate",
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
