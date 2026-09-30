# Geopolitical Intelligence

Page: `/dashboard/geopolitical` · Pure layer: `src/lib/geopolitical/` · Server wrapper:
`src/lib/api/geopoliticalData.ts` · UI: `src/app/dashboard/geopolitical/` (reuses
`src/app/dashboard/derivatives/ui.tsx`'s `QualityBadge`/`IndexCard`/`Table` primitives directly
rather than duplicating them) · API: `/api/geopolitical`, `/api/geopolitical/ask` · Tests:
`npm run test:geopolitical`.

Built against a 162-section institutional spec ("Global Geopolitical Risk Intelligence Engine").
The spec's own §162 asks for a gap analysis and phased build before implementation — this document
is that gap analysis, kept up to date rather than a one-time planning artifact.

## Two independent things share this one page

1. **The pre-existing registered GFMI engine** — `src/lib/engines/geopolitical.ts`, GFMI weight
   0.6, built on the Caldara-Iacoviello Geopolitical Risk Index (`src/lib/sources/gpr.ts`, monthly
   since 1900, Threats/Acts sub-indices). Untouched by this build; its GFMI weight and composite
   contribution are unchanged.
2. **The page-level analytical layer** — `src/lib/geopolitical/` (Military Buildup, Sanctions
   Intensity, Escalation Reading, Maritime Chokepoint Stress, GEWI). **Not registered in
   `gfmi.ts`'s composite at all** — it exists purely to power this dashboard's own tabs, the exact
   same architectural role `src/lib/derivatives/` plays relative to
   `src/lib/engines/derivativesLeverage.ts` (see `docs/DERIVATIVES_ENGINE.md`).

These are never double-counted, and widening this page-level layer does not change today's GFMI
score.

## Data quality is explicit, everywhere

Every number carries a `DataQuality` tag (`src/lib/geopolitical/types.ts`):

- **REAL** — a genuine observation, or a combination of genuine observations whose own combination
  method is itself meaningful (e.g. Military Buildup's average YoY growth rate across tracked
  countries — every input is real, and the average itself is a real, interpretable quantity).
- **MODEL_ESTIMATE** — a heuristic combination of real inputs into something no free source
  actually publishes (GEWI: no free source publishes a validated geopolitical early-warning index,
  so combining four real composites into one number is this page's own heuristic, not a measured
  quantity — the same treatment `computeCri` gives its heuristic combination in
  `src/lib/derivatives/leverage.ts`).
- **UNAVAILABLE** — shown plainly with an explanation, never silently omitted or guessed.

## New real data sources (verified live before building)

- **`gdeltEvents.ts`** — GDELT's free bulk Event/GKG export files
  (`data.gdeltproject.org/gdeltv2/*.export.CSV.zip`, updated every 15 minutes, no key). Confirmed
  live (2026-09-29): a real ~1,300-event file per 15-minute window, 61 tab-separated columns per
  GDELT's own published 2.0 schema. Distinct from `gdeltNews.ts`, which only calls GDELT's
  headline-only DOC 2.0 API for the World News page. Samples the 6 most recent 15-minute windows
  per pipeline run (not all ~96/day, which would mean ~96 zip downloads per run) and aggregates
  **globally** — `ActionGeo_CountryCode` is FIPS 10-4, not ISO, and building a correct crosswalk to
  this project's other country-keyed metrics was deferred rather than guessed at. The result
  (average Goldstein scale, conflict-event share) is a real but explicitly coarse,
  automated-text-derived escalation proxy, disclosed as such — this is machine event-coding of
  news text, not verified intelligence, the same caveat GDELT's own documentation carries.
- **`sipriMilex.ts`** — SIPRI Military Expenditure Database, direct `.xlsx` download. Confirmed
  live: `sipri.org/sites/default/files/SIPRI-Milex-data-1949-2025_v1.2.xlsx` (the filename's
  version/year suffix is re-discovered from the database's own landing page each run, not
  hardcoded). The full ~77-year back-series is backfilled per country in one run — the whole sheet
  is already parsed, so keeping every published year instead of just the latest costs nothing
  extra and immediately gives real deep history for z-scoring (the same "fetch it once, keep
  everything" choice CLAUDE.md documents for `ingestWorldBankCommodities`/
  `ingestEnergyBacktestSeries`).
- **`worldBankMilitary.ts`** — World Bank API, `MS.MIL.XPND.CD` (military expenditure, current
  USD). Confirmed live JSON, same connector family as `worldBankEmDebt.ts`. Same full-history
  backfill choice as `sipriMilex.ts` (the whole 2015-present range is already fetched in one call).
  Complementary to SIPRI's %-of-GDP ratio, not duplicative.
- **`ofacSanctions.ts`** — US Treasury OFAC Specially Designated Nationals list. Confirmed live
  (2026-09-29): a real 19,000+ row CSV, refreshed whenever the list changes:
  `sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV`. Counts
  currently-listed entities by sanctions-program keyword (Russia, Iran, North Korea, Cuba,
  Venezuela, Syria, Belarus, Ukraine-related, terrorism, weapons proliferation) — a real, sourced
  count, not a fabricated severity score. Verified against live data: Russia-program entries
  (6,427) far exceed every other tracked program, consistent with the post-2022 sanctions expansion.
- **IMF PortWatch, reused** — `energy.chokepoint.*.transits_total` (28 chokepoints, AIS-derived,
  already ingested by `ingestEnergyChokepoints` for the Energy engine) is read directly by
  `geopoliticalData.ts` for the Maritime tab. No new ingestion.

## Needs a decision or registration (flagged, not silently skipped or silently built)

- **`ucdpConflict.ts`** — UCDP (Uppsala Conflict Data Program) Georeferenced Event Dataset. A real,
  free API confirmed to exist (`ucdpapi.pcr.uu.se/api/gedevents/24.1`), but it requires a
  self-service access token (confirmed live: returns HTTP 401 "API token required" without one).
  Gated on `UCDP_ACCESS_TOKEN` exactly like `dhanMcx.ts` is gated on Dhan credentials — the
  connector code is written from UCDP's documented `Result`-array pagination shape, but **not
  verified end-to-end** until a real token is supplied and the pipeline runs with it configured.
- **OpenSanctions** — a free, live-confirmed consolidated CSV bundling OFAC+EU+UN+UK+other
  countries' sanctions lists in one file
  (`data.opensanctions.org/datasets/latest/sanctions/targets.simple.csv`, 73MB, real). **Checked
  and found to require a paid commercial license for a product like this one** — its own site
  (`opensanctions.org/licensing`) separates "Non-commercial use" from "Data licensing / Screening
  license / Reseller-OEM" for commercial products, and this site is a commercial subscription
  product. Not used — the same category as the paid derivatives feeds already declined elsewhere
  in this project. OFAC alone (unambiguously free, official, US-only) is used instead.
- **WTO Timeseries API** (tariffs) — confirmed live to require a subscription key
  (`api.wto.org` returns HTTP 401 "missing subscription key" without one). Whether free
  self-registration exists wasn't confirmed this pass. Not built.
- **UN General Assembly voting data** — no live free API found this pass (the UN Digital Library
  returned an unusable async response for a programmatic query). The well-known academic dataset
  (Voeten et al., Harvard Dataverse) is a static historical file, not a live feed, and would need
  periodic manual refresh unlike everything else in this pipeline. Not built.

## Not built, and why

- **ACLED** (political-violence/protest data) — its EULA was checked live and read end-to-end
  (2026-09-30): §3.3 states "Scraping and crawling the Site is prohibited," and §1.2 states
  "Commercial entities may not access or use the Content and/or Platforms without first obtaining
  a corporate license from Licensor" — the license granted is for non-commercial use only. Even
  ACLED's nominally "free" tier (the Data Export Tool, a myACLED account) requires registration —
  there's no unauthenticated access at all. Same category as OpenSanctions below: a real, live,
  technically reachable dataset declined on its own stated license terms, not a technical gap.
- **AIS/satellite vessel-level tracking** (Kpler, Vortexa, Windward, MarineTraffic, Spire) — all
  paid commercial products. IMF PortWatch's own AIS-derived chokepoint-level aggregates (reused
  above) is the free substitute this project already has.
- **Cyber-attribution feeds** (Mandiant, CrowdStrike, Recorded Future, Google Threat Intelligence)
  — paid. The existing `cyber_infrastructure` GFMI engine's own already-free sources are untouched
  by this build.
- **ML-validated backtesting** (spec §139-140: precision/recall/AUC/Brier score/calibration
  against historical episodes) — no labeled ground-truth dataset exists to validate against; this
  would be exactly the fabricated-looking rigor this project's discipline forbids. Built instead: a
  factual, sourced **Historical Reference table** (`src/lib/geopolitical/historical.ts`,
  `HISTORICAL_GEO_EVENTS`) — dates, mechanism, which of this page's real indices are built from
  data that existed and would plausibly have moved — explicitly not a scored backtest, the same
  pattern as `src/lib/derivatives/historical.ts`'s `HISTORICAL_CRISES` table.
- **A 40+ table relational graph schema** (spec §120/149: `geo_countries`, `geo_actors`,
  `geo_conflicts`, `geo_events`, ...) — this project's entire architecture is one `metric_series`
  table for every time series (see CLAUDE.md's "The `metric_series` table is the entire data
  layer"). A bespoke graph database is a fundamentally different, materially bigger architectural
  change and was not attempted. Every new number here is an ordinary `metric_series` row, exactly
  like every other engine.
- **Full alerting/push-notification infrastructure and an auto-generated 08:00 IST daily brief**
  (spec §134-136) — no alerting infrastructure exists anywhere else in this app; out of scope.
- **Sanctions-evasion/shadow-network anomaly detection** (spec §78) — needs AIS data (paid); not
  built.
- **Scenario Monte Carlo with P5-P95 bands** (spec §144) — no calibrated model exists to simulate
  from honestly; a deterministic, documented sensitivity calculator (the pattern
  `src/lib/derivatives/scenario.ts` uses) would be the honest equivalent if built later, but was
  not prioritized for this pass.

## Tests

`npm run test:geopolitical` (`src/lib/geopolitical/tests/engine.test.ts`) — plain `tsx`, no test
framework, hand-built `Point[]` fixtures, no DB/network. Covers: UNAVAILABLE fallback when inputs
are empty, monotonicity (rising military spend → higher buildup level; a Goldstein decline → higher
escalation level; a chokepoint transit drop → higher stress level), GEWI's UNAVAILABLE-when-all-
unavailable and MODEL_ESTIMATE-averaging behavior, and structural completeness of the historical
reference table.
