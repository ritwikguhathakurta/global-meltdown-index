/**
 * Central Bank Financial Stability Report (FSR) Verification Registry.
 *
 * Covers G7 + G20/major-EM + ASEAN + CEE + Latin America + Middle East +
 * Africa (see `region` on each entry) — every central bank confirmed to
 * publish a genuine, publicly accessible periodic assessment of the
 * soundness/resilience of its financial system (an internationally
 * recognized "Financial Stability Report"/"Review"/"Financial System
 * Report" type document, not a monetary-policy statement or generic annual
 * report). The original 9 (US, UK, Japan, Germany, France, Italy, Canada,
 * China, India — the same universe as bankingSystemicRisk.ts's
 * BANKING_COUNTRIES) were extended to 34 in one pass; every entry's URL and
 * publication date was independently verified against the institution's own
 * site (or, where noted in a comment, a specific news report that states
 * the fact directly) before being added — never guessed or interpolated.
 *
 * Checked and deliberately NOT added, because no genuine free/public
 * standalone FSR-type report could be verified: Vietnam (State Bank of
 * Vietnam publishes no such report), Qatar (Qatar Central Bank's legacy
 * publications page is broken/bot-gated with no working primary-source URL
 * found), Nigeria (the CBN's FSR PDF is real and publicly hosted, but every
 * recent edition is itself headed "Classified as Confidential" — an
 * inconsistent, anomalous case not treated as equivalent to the other clean
 * entries here).
 *
 * The qualitative fields below (institution, report name, stance,
 * bankStanceLevel) are CURATED and MANUALLY VERIFIED — reading and
 * classifying a report's own content is a human judgment, not something to
 * auto-extract reliably (same discipline as everywhere else in this app).
 * They change only when someone updates this file after reading a new
 * edition, not automatically.
 *
 * The FRESHNESS of that curation IS auto-checked on every pipeline run for
 * every entry whose checkMethod is "rss" or "html" — see
 * centralBankFsrCheck.ts and the central_bank_fsr_checks table (migration
 * 0019). This was not theoretical: building and testing this check is what
 * caught France's and Canada's original-9 rows already being one edition
 * behind (see git history). For the 25-country expansion, several
 * institutions' listing pages turned out to be JavaScript-rendered or
 * bot-walled and returned no static text a regex could reliably anchor to
 * (verified by fetching each candidate page directly, not assumed) — those
 * entries use checkMethod "manual": the registry entry, hyperlink and
 * stance comparison are still fully real and useful, but there is no
 * automated freshness check for them yet, and the dashboard says so
 * explicitly rather than showing a false "Verified" badge.
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
 * the report's own publication date — disclosed, not simulated). Note the
 * banking engine's own country-level composite score only exists for the
 * original 9 countries (BANKING_COUNTRIES) — the 25 newly added countries
 * show a real report/hyperlink/stance but no "Our Composite"/"Δ" comparison,
 * since this app has no free-data-backed banking engine coverage for them.
 */

export type BankStanceLevel = "calm" | "moderate" | "elevated";

export type FsrRegion = "G7" | "G20 / Major EM" | "ASEAN" | "CEE" | "Latin America" | "Middle East" | "Africa";

/** Canonical display order, shared by the Banking FSR table and the Credit
 * Data Verification table (creditDataRegistry.ts) so both render the same
 * 34-country universe in the same grouping. */
export const FSR_REGION_ORDER: readonly FsrRegion[] = ["G7", "G20 / Major EM", "ASEAN", "CEE", "Latin America", "Middle East", "Africa"];

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
 *    entity-decoded text. Compare the captured group at `checkMatchPosition`
 *    ("first" — the default, for institutions that list newest-first — or
 *    "last", for the rare ascending-order listing, e.g. Kenya's) to
 *    `checkExpected` — a mismatch (or no match at all) means the listing no
 *    longer matches what this registry has on file, so a newer edition has
 *    likely been published and this row needs a human re-verification pass.
 *    Regexes are anchored to each institution's own real list-row wording,
 *    tested against an actual fetch of that page before being added — never
 *    a generic date scan, which would also match nav/breadcrumb text or
 *    older archived rows that never disappear from these listing pages.
 *  - "manual": no automated check exists yet for this entry (its listing
 *    page was verified to be JavaScript-rendered, bot-walled, or otherwise
 *    not statically fetchable/regex-able when checked) — the dashboard
 *    shows this status honestly rather than faking a check. */
export type FsrCheckMethod = "rss" | "html" | "manual";

export type CentralBankFsrEntry = {
  key: string; // unique slug; matches BANKING_COUNTRIES key for the original 9
  region: FsrRegion;
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
  /** html only: RegExp source with one capture group, tested against a real
   * fetch of the page. */
  checkRegex?: string;
  /** html only: which occurrence of checkRegex to read — "first" (default)
   * or "last" for an ascending-order listing. */
  checkMatchPosition?: "first" | "last";
  /** html only: the expected value of the selected match's capture group. */
  checkExpected?: string;
};

export const CENTRAL_BANK_FSR_REGISTRY: CentralBankFsrEntry[] = [
  {
    key: "us",
    region: "G7",
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
    region: "G7",
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
    region: "G7",
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
    region: "G7",
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
    region: "G7",
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
    region: "G7",
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
    region: "G7",
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
    region: "G20 / Major EM",
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
    region: "G20 / Major EM",
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

  // ---- G20 / Major EM (beyond the original G7 + China + India) ----
  {
    key: "brazil",
    region: "G20 / Major EM",
    country: "Brazil",
    institution: "Banco Central do Brasil",
    reportName: "Relatório de Estabilidade Financeira, Vol. 25 No. 1",
    reportUrl: "https://www.bcb.gov.br/content/publicacoes/ref/202605/RELESTAB202605-refPub.pdf",
    // Date sourced from press coverage quoting the report (ADVFN), not
    // extracted directly from BCB's own site text — bcb.gov.br is a
    // JavaScript SPA that returns only an empty shell to a plain fetch.
    publishedDate: "2026-05-25",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (~May / November)",
    stance:
      "The National Financial System is stated to remain solid, with comfortable capitalization and liquidity and no material risk to system stability, though the report explicitly flags growing household/corporate indebtedness and rising delinquency.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // bcb.gov.br is a JS SPA; no static listing text found
  },
  {
    key: "russia",
    region: "G20 / Major EM",
    country: "Russia",
    institution: "Bank of Russia",
    reportName: "Financial Stability Review, Q4 2025 – Q1 2026",
    reportUrl: "https://www.cbr.ru/eng/analytics/finstab/ofs/4q_2025_1q_2026/",
    publishedDate: "2026-06-01",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (~January / June)",
    stance:
      "The financial sector is stated to remain highly resilient and to continue properly performing its main function; corporate credit risk, household debt burden and housing-market imbalances are described as relevant but not critical.",
    bankStanceLevel: "moderate",
    checkMethod: "html",
    checkUrl: "https://www.cbr.ru/eng/finstab/review/",
    checkRegex: "Financial Stability Review.{0,40}?(Q\\d 20\\d{2}-Q\\d 20\\d{2})",
    checkExpected: "Q4 2025-Q1 2026",
  },
  {
    key: "south_korea",
    region: "G20 / Major EM",
    country: "South Korea",
    institution: "Bank of Korea",
    reportName: "Financial Stability Report (June 2026)",
    reportUrl: "https://www.bok.or.kr/eng/bbs/E0000737/view.do?nttId=11064322&menuNo=400219",
    publishedDate: "2026-06-24",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (June / December)",
    stance:
      "The financial system is described as generally stable despite internal/external uncertainties, with special caution flagged on capital-region housing prices, leveraged ETF activity and rising vulnerable-borrower default risk.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // bok.or.kr's listing page is a JS-rendered shell
  },
  {
    key: "indonesia",
    region: "G20 / Major EM",
    country: "Indonesia",
    institution: "Bank Indonesia",
    reportName: "Kajian Stabilitas Keuangan No. 47 (Agustus 2026)",
    reportUrl: "https://www.bi.go.id/id/publikasi/laporan/Pages/KSK_4726.aspx",
    publishedDate: "2026-08-31",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (~February / August)",
    stance:
      "Indonesia's financial system stability in H1 2026 is stated to remain maintained amid rising global uncertainty, citing banking resilience, non-bank financial industry soundness and solid corporate performance.",
    bankStanceLevel: "calm",
    checkMethod: "html",
    checkUrl: "https://www.bi.go.id/id/publikasi/laporan/default.aspx?kategori=kajian+stabilitas+keuangan&periode=",
    checkRegex: "Kajian Stabilitas Keuangan No\\. (\\d+ Agustus \\d{4})",
    checkExpected: "47 Agustus 2026",
  },
  {
    key: "mexico",
    region: "G20 / Major EM",
    country: "Mexico",
    institution: "Banco de México",
    reportName: "Reporte de Estabilidad Financiera — Junio 2026",
    reportUrl:
      "https://www.banxico.org.mx/publicaciones-y-prensa/reportes-sobre-el-sistema-financiero/%7BD944A021-26D6-5523-883C-9F3B4201AE83%7D.pdf",
    publishedDate: "2026-06-10",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (June / December)",
    stance:
      "Banxico states the financial system maintains a solid and resilient position against international challenges, but the report's own Index of Macrofinancial Vulnerabilities increased versus the prior edition into an intermediate zone.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // listing page (anterior.banxico.org.mx) 404s; site restructured since verification
  },
  {
    key: "saudi_arabia",
    region: "G20 / Major EM",
    country: "Saudi Arabia",
    institution: "Saudi Central Bank (SAMA)",
    reportName: "Financial Stability Report (2025)",
    reportUrl:
      "https://www.sama.gov.sa/en-US/Publications/FinanceReports/Financial%20Stability%20Report/Financial_Stability_Report_2025_En.pdf",
    publishedDate: "2025-12-26",
    cadenceDays: 365,
    cadenceLabel: "Annual (cadence has drifted month-to-month — Sept 2024, Dec 2025)",
    stance:
      "The Saudi banking sector is stated to remain well-capitalized (capital adequacy ~19.6%) and resilient despite global turbulence, with non-performing loans at their lowest level since 2016.",
    bankStanceLevel: "calm",
    checkMethod: "manual", // listing page is a SharePoint/ASP shell with no static content
  },
  {
    key: "south_africa",
    region: "G20 / Major EM",
    country: "South Africa",
    institution: "South African Reserve Bank",
    reportName: "Financial Stability Review, First Edition 2026",
    reportUrl:
      "https://www.resbank.co.za/en/home/publications/publication-detail-pages/reviews/finstab-review/2026/first-edition",
    publishedDate: "2026-06-10",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (~June / November)",
    stance:
      "Vulnerability is stated to have increased across several risk categories versus the November 2025 edition (geopolitical conflict, policy uncertainty), but the system is judged to remain resilient overall with well-capitalised, liquid systemically important institutions.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // listing page is a JS-rendered filter/search template
  },
  {
    key: "turkey",
    region: "G20 / Major EM",
    country: "Turkey",
    institution: "Central Bank of the Republic of Türkiye (CBRT)",
    reportName: "Financial Stability Report — May 2026, Volume 42",
    reportUrl:
      "https://www.tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Main+Menu/Publications/Reports/Financial+Stability+Report/2026/Volume+42",
    publishedDate: "2026-05-22",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (May / November)",
    stance:
      "The financial system is stated to have maintained its resilient structure despite heightened global geopolitical risk and elevated inflation, with tight financial conditions supporting disinflation and a shift toward TL-denominated credit.",
    bankStanceLevel: "moderate",
    checkMethod: "html",
    checkUrl: "https://www.tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Main+Menu/Publications/Reports/Financial+Stability+Report/",
    checkRegex: "Financial Stability Report - (\\w+ \\d{4}, Volume \\d+)",
    checkExpected: "May 2026, Volume 42",
  },
  {
    key: "argentina",
    region: "G20 / Major EM",
    country: "Argentina",
    institution: "Banco Central de la República Argentina",
    reportName: "Informe de Estabilidad Financiera, Primer Semestre 2026",
    reportUrl: "https://www.bcra.gob.ar/en/publications/financial-stability-report-first-half-2026/",
    publishedDate: "2026-07-08",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (January / July)",
    stance:
      "The financial system is stated to have continued operating in an orderly manner, maintaining a high degree of resilience supported by large coverage margins through forecasts and capital, while noting the external context remains vulnerable.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // BCRA's listing page renders its list via JavaScript
  },
  {
    key: "australia",
    region: "G20 / Major EM",
    country: "Australia",
    institution: "Reserve Bank of Australia",
    reportName: "Financial Stability Review – March 2026",
    reportUrl: "https://www.rba.gov.au/publications/fsr/2026/mar/pdf/financial-stability-review-2026-03.pdf",
    publishedDate: "2026-03-19",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (March / October)",
    stance:
      "Australia's financial system is described as well placed to handle a challenging and uncertain global environment, with banks in a strong position to keep supporting the economy — but the Review explicitly states risks to the global financial system have increased.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // listing page text ("Last published 19 March 2026") verified but not yet wired to a tested regex
  },

  // ---- ASEAN ----
  {
    key: "malaysia",
    region: "ASEAN",
    country: "Malaysia",
    institution: "Bank Negara Malaysia",
    reportName: "Financial Stability Review – Second Half 2025",
    reportUrl: "https://www.bnm.gov.my/documents/20124/21185035/fsr2025h2_en_book.pdf",
    publishedDate: "2026-03-31",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (~March / October)",
    stance:
      "The well-capitalised banking sector, deep financial markets and diverse investor base are stated to continue underpinning orderly market functioning and resilience; system-wide LCR cited at 154.8%.",
    bankStanceLevel: "calm",
    checkMethod: "html",
    checkUrl: "https://www.bnm.gov.my/publications/fsr/index",
    checkRegex: "Financial Stability Review - ((?:Second|First) Half \\d{4})",
    checkExpected: "Second Half 2025",
  },
  {
    key: "philippines",
    region: "ASEAN",
    country: "Philippines",
    institution: "Bangko Sentral ng Pilipinas / Financial Stability Coordination Council",
    reportName: "2025 Financial Stability Report",
    reportUrl: "https://www.bsp.gov.ph/Media_And_Research/FSR/FSR2025.pdf",
    publishedDate: "2026-06-09",
    cadenceDays: 365,
    cadenceLabel: "Annual",
    stance:
      "The Philippine economy and financial system are described as remaining resilient, supported by manageable borrowing, though the FSCC explicitly flags domestic credit dynamics, real-estate imbalances and concentrated unsecured-consumer and conglomerate exposures as risks that could intensify.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // listing page returns HTTP 403 to automated fetches
  },
  {
    key: "singapore",
    region: "ASEAN",
    country: "Singapore",
    institution: "Monetary Authority of Singapore",
    reportName: "Financial Stability Review 2025",
    reportUrl: "https://www.mas.gov.sg/-/media/mas-media-library/publications/financial-stability-review/2025/financial-stability-review-2025.pdf",
    // Exact day not confirmed directly from MAS's own site (mas.gov.sg
    // returned a maintenance/JS shell on every fetch attempt); "2026-11-08"
    // is the date of the first substantive news coverage (Caproasia),
    // closely following the actual November 2025 release.
    publishedDate: "2025-11-08",
    cadenceDays: 365,
    cadenceLabel: "Annual (November)",
    stance:
      "Global financial stability risks are described as elevated, but Singapore corporates, households and banks are said to have remained resilient (small pockets of vulnerability among highly leveraged households/corporates); the 2025 industry-wide stress test affirmed banks/insurers can withstand severe shocks.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // mas.gov.sg listing page is JS-rendered; returned no static text
  },
  {
    key: "thailand",
    region: "ASEAN",
    country: "Thailand",
    institution: "Bank of Thailand",
    reportName: "Financial Stability Review 2025",
    reportUrl: "https://www.bot.or.th/content/dam/bot/documents/en/research-and-publications/reports/financial-stability-report/FS_Review_2025e.pdf",
    // Search summaries gave conflicting claims (April 2025, December 2025);
    // the PDF's own server Last-Modified header (independently verified
    // twice) reads 12 January 2026 — used here as the best available,
    // directly-observed fact rather than an unconfirmed search snippet.
    publishedDate: "2026-01-12",
    cadenceDays: 365,
    cadenceLabel: "Annual",
    stance:
      "The commercial banking system is stated to remain sound and stable with high capital, loan-loss reserves and liquidity, while the report separately flags tight financial conditions/credit contraction, SME credit risk, real-estate developer rollover risk and household debt as active risk areas.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // listing page is bot/JS-gated
  },

  // ---- CEE ----
  {
    key: "poland",
    region: "CEE",
    country: "Poland",
    institution: "Narodowy Bank Polski",
    reportName: "Financial Stability Report, December 2025",
    reportUrl: "https://nbp.pl/en/financial-stability-report-december-2025/",
    publishedDate: "2025-12-19",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (June / December)",
    stance:
      "Systemic risk in the domestic financial system is stated to remain limited and cyclical risk is at a moderate level not threatening financial stability, though legal/regulatory uncertainty around zloty-loan consumer-protection rulings is flagged as an ongoing challenge.",
    bankStanceLevel: "calm",
    checkMethod: "manual", // nbp.pl returns a Cloudflare-style bot challenge to automated fetches
  },
  {
    key: "czech_republic",
    region: "CEE",
    country: "Czech Republic",
    institution: "Czech National Bank",
    reportName: "Financial Stability Report — Spring 2026",
    reportUrl:
      "https://www.cnb.cz/en/financial-stability/publications-on-financial-stability/Financial-Stability-Report-Spring-2026-00001/",
    publishedDate: "2026-06-04",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (Spring/June, Autumn/December)",
    stance:
      "The financial sector is stated to be stable and resilient to potential adverse effects; cyclical risk in the banking sector's balance sheet rose slightly but in line with expectations, and the sector passed stress testing under an adverse scenario.",
    bankStanceLevel: "calm",
    checkMethod: "manual", // listing page is a JS/dropdown-filter template, no static list text
  },
  {
    key: "hungary",
    region: "CEE",
    country: "Hungary",
    institution: "Magyar Nemzeti Bank",
    reportName: "Financial Stability Report (June 2026)",
    reportUrl: "https://www.mnb.hu/letoltes/financial-stability-report-june-2026.pdf",
    publishedDate: "2026-06-15",
    cadenceDays: 182,
    cadenceLabel: "Nominally May / November, though timing has drifted",
    stance:
      "The Hungarian banking system is described as continuing to show high profitability, ample liquidity and a strong capital position, with the NPL ratio declining further to a historically low level.",
    bankStanceLevel: "calm",
    checkMethod: "html",
    checkUrl: "https://www.mnb.hu/en/publications/reports/financial-stability-report",
    checkRegex: "Financial Stability Report \\((\\w+ \\d{4})\\)",
    checkExpected: "June 2026",
  },
  {
    key: "romania",
    region: "CEE",
    country: "Romania",
    institution: "National Bank of Romania",
    reportName: "Financial Stability Report, December 2025 (No. 19/29, New Series)",
    reportUrl: "https://www.bnr.ro/uploads/2025-12-09raportasuprastabilit%C4%83%C8%9Biifinanciare-decembrie2025_documentpdf_545_1765374127.pdf",
    publishedDate: "2025-12-09",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (June / December)",
    stance:
      "The banking sector's performance is stated to be similar to or above the EU average for most prudential indicators, though the report flags profitability well below the real sector's and Romania's low bank-assets-to-GDP ratio (49.7% vs. EU average 210.4%) as structural vulnerabilities.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // bnr.ro listing pages returned only navigation-menu HTML, no static list text
  },

  // ---- Latin America (beyond Brazil, Mexico, Argentina above) ----
  {
    key: "chile",
    region: "Latin America",
    country: "Chile",
    institution: "Banco Central de Chile",
    reportName: "Informe de Estabilidad Financiera, Primer Semestre 2026",
    reportUrl:
      "https://www.bcentral.cl/documents/33528/8335323/Informe+de+Estabilidad+Financiera+Primer+Semestre+2026.pdf",
    publishedDate: "2026-05-19",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (~May / November)",
    stance:
      "Domestic banks are stated to have profitability, capital and liquidity levels sufficient to remain solvent in a severe stress scenario, while risks to global financial stability are flagged as high due to Middle East tensions and the potential for abrupt tightening in external financing conditions.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // listing page not fetchable; RSS exists but is served behind an Incapsula bot-challenge
  },
  {
    key: "colombia",
    region: "Latin America",
    country: "Colombia",
    institution: "Banco de la República",
    reportName: "Reporte de Estabilidad Financiera, Primer Semestre 2026",
    reportUrl: "https://www.banrep.gov.co/en/publications-research/financial-stability-report/first-half-2026",
    publishedDate: "2026-06-09",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (~June / December)",
    stance:
      "The Colombian financial system is stated to remain solid despite high international uncertainty, more restrictive local financial conditions and fiscal challenges; credit institutions have sound capital/liquidity levels and improved profitability.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // banrep.gov.co is behind Radware/ShieldSquare bot protection
  },
  {
    key: "peru",
    region: "Latin America",
    country: "Peru",
    institution: "Banco Central de Reserva del Perú",
    reportName: "Reporte de Estabilidad Financiera, Mayo 2026",
    reportUrl: "https://www.bcrp.gob.pe/docs/Publicaciones/Reporte-Estabilidad-Financiera/2026/mayo/ref-mayo-2026.pdf",
    // Only month-level precision could be confirmed (scanned/embedded-stream
    // PDF, no day-level date found in the document or news coverage) — day
    // set to the 1st as a placeholder; do not treat as day-exact.
    publishedDate: "2026-05-01",
    cadenceDays: 182,
    cadenceLabel: "Semiannual (May / November)",
    stance:
      "The financial system is stated to register high levels of solvency and liquidity, giving favourable initial conditions to face potential external shocks, while funding-cost increases, capital outflows and currency volatility are flagged as material transmission risks.",
    bankStanceLevel: "moderate",
    checkMethod: "manual", // RSS exists but is served behind an Incapsula/Distil bot-challenge
  },

  // ---- Middle East ----
  {
    key: "uae",
    region: "Middle East",
    country: "United Arab Emirates",
    institution: "Central Bank of the UAE",
    reportName: "Financial Stability Report 2025",
    reportUrl: "https://www.centralbank.ae/media/44ianby2/financial-stability-report-en-2025.pdf",
    publishedDate: "2026-08-17",
    cadenceDays: 365,
    cadenceLabel: "Annual (issued the following year — e.g. the 2025 report issued August 2026)",
    stance:
      "The report affirms the strength and resilience of the UAE financial system, citing a capital adequacy ratio of 17.0%, a declining NPL ratio (3.3% vs 4.7% in 2024) and resilience to severe economic/financial shocks under stress testing.",
    bankStanceLevel: "calm",
    checkMethod: "manual", // HTML landing page for this edition returned 404; only the direct PDF URL confirmed live
  },
  {
    key: "israel",
    region: "Middle East",
    country: "Israel",
    institution: "Bank of Israel",
    reportName: "Financial Stability Report for the Second Half of 2024",
    reportUrl:
      "https://www.boi.org.il/en/communication-and-publications/regular-publications/financial-stability/financial-stability-report-for-the-second-half-of-2024/",
    publishedDate: "2025-02-11",
    cadenceDays: 182,
    cadenceLabel: "Nominally semiannual, though no newer edition than H2-2024 was found as of verification",
    stance:
      "The resilience of major financial institutions is stated to have remained high, with improved capital ratios for both banks and insurance companies (already high), showing high resilience despite ongoing military conflict and geopolitical uncertainty.",
    bankStanceLevel: "calm",
    checkMethod: "manual", // RSS exists but is served behind Radware bot-protection
  },

  // ---- Africa ----
  {
    key: "kenya",
    region: "Africa",
    country: "Kenya",
    institution: "Central Bank of Kenya (with the Financial Sector Regulators' forum)",
    reportName: "Kenya Financial Sector Stability Report 2024",
    reportUrl: "https://www.centralbank.go.ke/2025/09/05/kenya-financial-sector-stability-report-2024/",
    publishedDate: "2025-09-05",
    cadenceDays: 365,
    cadenceLabel: "Annual (typically Q3/Q4)",
    stance:
      "Kenya's financial sector is stated to remain stable and resilient despite elevated credit and cyber risks, amid GDP growth slowing to 4.7% in 2024 from 5.6% in 2023 on global headwinds and tight fiscal conditions.",
    bankStanceLevel: "moderate",
    checkMethod: "html",
    checkUrl: "https://www.centralbank.go.ke/reports/financial-sector-stability-reports/",
    checkRegex: "Kenya Financial Sector Stability Report (\\d{4}) \\d{2}/\\d{2}/\\d{4}",
    checkMatchPosition: "last",
    checkExpected: "2024",
  },
  {
    key: "egypt",
    region: "Africa",
    country: "Egypt",
    institution: "Central Bank of Egypt",
    reportName: "Financial Stability Report — March 2025",
    reportUrl: "https://www.cbe.org.eg/-/media/project/cbe/page-content/rich-text/financial-stability/english/financial-stability-report-march-2025-eng.pdf",
    // "March 2025" is the report's own reference-period name; CBE's own
    // announcement page URL confirms it was actually published/announced on
    // 2025-11-04 (https://www.cbe.org.eg/en/news-publications/news/2025/11/04/...).
    publishedDate: "2025-11-04",
    cadenceDays: 365,
    cadenceLabel: "Roughly annual, publication lags its own reference period by several months",
    stance:
      "Egypt's financial system is stated to have remained stable, supported by a stronger banking sector, higher foreign reserves and improved investor sentiment; stress tests show the system facing only low-to-moderate solvency/liquidity risk even under adverse scenarios.",
    bankStanceLevel: "calm",
    checkMethod: "manual", // cbe.org.eg is behind an Akamai bot-wall ("Request Rejected") for automated fetches
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
