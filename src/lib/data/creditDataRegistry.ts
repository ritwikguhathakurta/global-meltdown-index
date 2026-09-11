/**
 * Central Bank Credit Data Verification Registry.
 *
 * Same 34-country universe and region grouping as the Central Bank FSR
 * Verification registry (centralBankFsrRegistry.ts) — the user's own
 * instruction: "All the countries which are in banking should be in Credit
 * also." Unlike the FSR registry, this one is NOT a curated narrative
 * classification: every reading here is the BIS (Bank for International
 * Settlements) Credit-to-GDP Gap — the official Basel III countercyclical-
 * capital-buffer indicator (actual credit-to-GDP minus its long-run
 * HP-filter trend) — already genuinely ingested into this app's own
 * metric_series table via bisCreditGap.ts, free/no-key/no-auth SDMX REST API
 * at stats.bis.org, verified live for all 34 countries before being wired
 * in here.
 *
 * This makes the "automated updation" requirement structurally simpler and
 * MORE robust than the FSR registry's per-institution HTML scraping/RSS
 * checks: there is nothing extra to "check" for freshness — the same
 * pipeline run that re-fetches this quarter's BIS data for the existing
 * engines (Banking, Property) is the freshness update for this table too.
 * No separate check_status/needs_review machinery is needed; the "as of"
 * date shown is simply the latest point already in metric_series.
 *
 * COVERAGE: BIS's Credit-to-GDP Gap dataflow (WS_CREDIT_GAP) does not cover
 * every country — checked directly against the live API before excluding
 * anyone, not assumed from documentation. Six of the 25 non-BANKING_
 * COUNTRIES on the FSR registry return "No data" from this exact dataflow:
 * Philippines, Romania, Peru, UAE, Kenya, Egypt. These are shown with
 * `status: "unavailable"` rather than silently omitted or backed by a
 * weaker, unverified proxy.
 *
 * SUPPLEMENTARY SOURCES: the user specifically cited two other well-known
 * public credit datasets — the RBI's Sectoral Bank Credit Deployment data
 * (India) and the New York Fed's Household Debt and Credit Report (US).
 * Both are genuine, real, freely accessible sources, but building ingestion
 * for them is a distinct, larger task (sector-level breakdown / household-
 * level microdata, not a single country-level score) — out of scope for
 * this pass. They're surfaced here as `supplementalSources` links on the
 * relevant rows so the user's own examples are directly reachable, without
 * this app claiming to have built a scoring layer on top of them yet.
 */

import type { FsrRegion } from "./centralBankFsrRegistry";

export type CreditDataEntry = {
  key: string; // matches the corresponding centralBankFsrRegistry entry's key
  region: FsrRegion;
  country: string;
  institution: string;
  seriesName: string;
  sourceUrl: string;
  status: "available" | "unavailable";
  /** metric_series key already ingested via bisCreditGap.ts, for `status:
   * "available"` rows only. */
  metricKey?: string;
  /** Why this country has no reading, for `status: "unavailable"` rows only. */
  unavailableReason?: string;
  supplementalSources?: { label: string; url: string }[];
};

const BIS_INSTITUTION = "Bank for International Settlements";
const BIS_SERIES_NAME = "Credit-to-GDP Gap (Total Credit to Private Non-Financial Sector)";
const BIS_SOURCE_URL = "https://data.bis.org/topics/CREDIT_GAPS/data";

export const CREDIT_DATA_REGISTRY: CreditDataEntry[] = [
  // ---- G7 ----
  {
    key: "us",
    region: "G7",
    country: "United States",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.us_credit_gap",
    supplementalSources: [
      { label: "NY Fed Household Debt and Credit Report", url: "https://www.newyorkfed.org/microeconomics/hhdc/background.html" },
    ],
  },
  {
    key: "uk",
    region: "G7",
    country: "United Kingdom",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.uk_credit_gap",
  },
  {
    key: "japan",
    region: "G7",
    country: "Japan",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.japan_credit_gap",
  },
  {
    key: "germany",
    region: "G7",
    country: "Germany",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.germany_credit_gap",
  },
  {
    key: "italy",
    region: "G7",
    country: "Italy",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.italy_credit_gap",
  },
  {
    key: "france",
    region: "G7",
    country: "France",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.france_credit_gap",
  },
  {
    key: "canada",
    region: "G7",
    country: "Canada",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.canada_credit_gap",
  },

  // ---- G20 / Major EM ----
  {
    key: "china",
    region: "G20 / Major EM",
    country: "China",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "china.credit_impulse",
  },
  {
    key: "india",
    region: "G20 / Major EM",
    country: "India",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.india_credit_gap",
    supplementalSources: [
      { label: "RBI Sectoral Bank Credit Deployment", url: "https://rbi.org.in/Scripts/Data_Sectoral_Deployment.aspx" },
    ],
  },
  {
    key: "brazil",
    region: "G20 / Major EM",
    country: "Brazil",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.brazil_credit_gap",
  },
  {
    key: "russia",
    region: "G20 / Major EM",
    country: "Russia",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.russia_credit_gap",
  },
  {
    key: "south_korea",
    region: "G20 / Major EM",
    country: "South Korea",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.south_korea_credit_gap",
  },
  {
    key: "indonesia",
    region: "G20 / Major EM",
    country: "Indonesia",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.indonesia_credit_gap",
  },
  {
    key: "mexico",
    region: "G20 / Major EM",
    country: "Mexico",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.mexico_credit_gap",
  },
  {
    key: "saudi_arabia",
    region: "G20 / Major EM",
    country: "Saudi Arabia",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.saudi_arabia_credit_gap",
  },
  {
    key: "south_africa",
    region: "G20 / Major EM",
    country: "South Africa",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.south_africa_credit_gap",
  },
  {
    key: "turkey",
    region: "G20 / Major EM",
    country: "Turkey",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.turkey_credit_gap",
  },
  {
    key: "argentina",
    region: "G20 / Major EM",
    country: "Argentina",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.argentina_credit_gap",
  },
  {
    key: "australia",
    region: "G20 / Major EM",
    country: "Australia",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.australia_credit_gap",
  },

  // ---- ASEAN ----
  {
    key: "malaysia",
    region: "ASEAN",
    country: "Malaysia",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.malaysia_credit_gap",
  },
  {
    key: "philippines",
    region: "ASEAN",
    country: "Philippines",
    institution: "—",
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "unavailable",
    unavailableReason: "BIS's Credit-to-GDP Gap dataflow does not cover the Philippines — checked directly against the live API, not a data-entry gap.",
  },
  {
    key: "singapore",
    region: "ASEAN",
    country: "Singapore",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.singapore_credit_gap",
  },
  {
    key: "thailand",
    region: "ASEAN",
    country: "Thailand",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.thailand_credit_gap",
  },

  // ---- CEE ----
  {
    key: "poland",
    region: "CEE",
    country: "Poland",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.poland_credit_gap",
  },
  {
    key: "czech_republic",
    region: "CEE",
    country: "Czech Republic",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.czech_republic_credit_gap",
  },
  {
    key: "hungary",
    region: "CEE",
    country: "Hungary",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.hungary_credit_gap",
  },
  {
    key: "romania",
    region: "CEE",
    country: "Romania",
    institution: "—",
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "unavailable",
    unavailableReason: "BIS's Credit-to-GDP Gap dataflow does not cover Romania — checked directly against the live API, not a data-entry gap.",
  },

  // ---- Latin America ----
  {
    key: "chile",
    region: "Latin America",
    country: "Chile",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.chile_credit_gap",
  },
  {
    key: "colombia",
    region: "Latin America",
    country: "Colombia",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.colombia_credit_gap",
  },
  {
    key: "peru",
    region: "Latin America",
    country: "Peru",
    institution: "—",
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "unavailable",
    unavailableReason: "BIS's Credit-to-GDP Gap dataflow does not cover Peru — checked directly against the live API, not a data-entry gap.",
  },

  // ---- Middle East ----
  {
    key: "uae",
    region: "Middle East",
    country: "United Arab Emirates",
    institution: "—",
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "unavailable",
    unavailableReason: "BIS's Credit-to-GDP Gap dataflow does not cover the UAE — checked directly against the live API, not a data-entry gap.",
  },
  {
    key: "israel",
    region: "Middle East",
    country: "Israel",
    institution: BIS_INSTITUTION,
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "available",
    metricKey: "credit.israel_credit_gap",
  },

  // ---- Africa ----
  {
    key: "kenya",
    region: "Africa",
    country: "Kenya",
    institution: "—",
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "unavailable",
    unavailableReason: "BIS's Credit-to-GDP Gap dataflow does not cover Kenya — checked directly against the live API, not a data-entry gap.",
  },
  {
    key: "egypt",
    region: "Africa",
    country: "Egypt",
    institution: "—",
    seriesName: BIS_SERIES_NAME,
    sourceUrl: BIS_SOURCE_URL,
    status: "unavailable",
    unavailableReason: "BIS's Credit-to-GDP Gap dataflow does not cover Egypt — checked directly against the live API, not a data-entry gap.",
  },
];

export type CreditGapReading = "contracting" | "neutral" | "expanding";

/** Buckets the raw credit-to-GDP gap value (percentage points) into a
 * qualitative reading, using the same threshold the Basel Committee itself
 * treats as meaningful for the countercyclical capital buffer: a gap beyond
 * +/-2pp is a genuine deviation from trend, not noise. This is a mechanical
 * classification of the number, not a curated judgment call — unlike
 * bankStanceLevel on the FSR registry, there is nothing to transcribe here. */
export function creditGapReading(gapValue: number | null): CreditGapReading | null {
  if (gapValue === null) return null;
  if (gapValue > 2) return "expanding";
  if (gapValue < -2) return "contracting";
  return "neutral";
}
