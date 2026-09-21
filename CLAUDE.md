# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Global Meltdown Index (globalmeltdownindex.net) — a systemic-risk terminal built against an internal
"V3" spec: 24 risk engines (Global Liquidity, Credit, Equity Fragility, Treasury/Sovereign, Banking,
Property, EM Debt, Energy, Geopolitical, AI Financial engines, etc.) feed a composite **GFMI** score,
plus a large, separately-scoped **commodities intelligence** section (oilseeds, chemicals, grains,
metals, econometrics reports). See `README.md` for the full feature list, country-coverage detail,
and per-engine data-source rationale — it is extensive and mostly append-only; read it before assuming
a data gap or limitation isn't already documented there.

Every number is real, sourced from a free/official API and computed deterministically — nothing is
faked, estimated, or backfilled. When a free source doesn't exist for something, the UI shows
`UNAVAILABLE`/`STALE` rather than substituting a guess. Preserve this discipline in any new code.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build (next build) — run before committing anything nontrivial
npm run lint     # eslint
npx tsc --noEmit -p .   # typecheck — there is no separate `npm run typecheck` script
```

There is no test suite (no test runner is installed). Verification for this repo is: `npx tsc --noEmit -p .`
+ `npx eslint <changed files>` + a manual check against real data (see "Data honesty" below) — treat a
clean typecheck/lint as necessary but not sufficient.

To exercise a single engine/connector during development without waiting for the daily cron, sign in
as admin and use `/admin` → "Run pipeline now", or hit `/api/cron/pipeline` directly with
`Authorization: Bearer $CRON_SECRET`.

**Migrations are applied manually, not via a CLI.** There is no linked/authenticated Supabase CLI and no
direct Postgres connection string in this environment (`npx supabase` works but isn't logged in, and
`.env.local` has no `DATABASE_URL`) — `supabase/migrations/*.sql` files are reference copies the human
operator pastes into the Supabase Studio SQL Editor themselves (see `README.md`'s setup section). After
adding a migration, tell the user which file to run rather than assuming it's already live; a new table
or column won't exist in production until they do, and code that reads/writes it should fail gracefully
(return `null`/empty, never throw) until then — see `centralBankDecisionCommentary.ts` for the pattern.

## Architecture

### The `metric_series` table is the entire data layer

One Postgres table (`metric_series`, indexed on `(metric_key, observed_at)`) holds every time series in
the app — macro indicators, commodity prices, everything — instead of per-domain tables. Read/write
through `src/lib/metrics/store.ts` only:
- `upsertMetrics(db, points: MetricPoint[])` — write path. Each `MetricPoint.source_key` must already
  exist as a row in the `sources` table (looked up via a cached `resolveSourceId`); if it doesn't, the
  row silently gets `source_id: null` rather than failing loudly, so **adding a new source connector
  always requires a matching `supabase/migrations/NNNN_*.sql` that inserts into `sources`** (see
  `0039_massive_futures_source.sql` for the minimal shape). Migrations in this repo are additive/registry
  inserts, not schema rewrites — there hasn't been a breaking schema change since `0001_init.sql`.
- `fetchSeries` / `fetchLatest` / `fetchLatestForKeys` — read path, used by every engine.

### Two different meanings of "engine" live in `src/lib/engines/` (75 files)

1. **The 24 registered risk engines** (`src/lib/engines/registry.ts`, `ENGINE_REGISTRY`) — each has a
   `run*Engine(db, asOf)` returning `EngineResult` (see `types.ts`) for short/medium/long horizons
   (`horizon.ts` — the z-score window and indicator weighting genuinely differ per horizon, not just the
   label), and a `gfmiWeight` folded into the composite GFMI score (`gfmi.ts`). These are computed once
   a day by `runComputePipeline` (`src/lib/pipeline/compute.ts`) and persisted to `risk_engine_scores`.
2. **Everything else** (~49 files) — commodity/domain-specific engines (oilseeds cointegration,
   individual mean-reversion diagnostics, crush margins, oleochemicals, energy trade networks, India
   seasonality, etc.) that are **not** part of the GFMI registry. These are plain functions
   (`get<Thing>(db): Promise<Result | null>`) called on-demand from Server Components — nothing cron-
   driven about them individually; they just read whatever `metric_series` rows the daily pipeline (or a
   live on-demand fetch, see below) already wrote.

Never assume a file under `src/lib/engines/` feeds the GFMI score — check `registry.ts` first.

### The daily pipeline (`/api/cron/pipeline`, `vercel.json` → 21:30 UTC)

`runIngestionPipeline` (`src/lib/pipeline/ingest.ts`, ~1700 lines) fans out to every connector in
`src/lib/sources/` (68 files, one per external API/feed) and `upsertMetrics`s the results; then
`runComputePipeline` runs the registry engines and writes `risk_engine_scores` + the GFMI rows. The
whole thing is one Vercel serverless function with a **hard 300s ceiling** — if any single stage runs
long, Vercel kills the *entire* function, silently dropping every other concurrently-running stage's
data too. Two independent guards exist against this (both documented in-file, read before touching
either):
- `src/lib/pipeline/timeBudget.ts` — sequential per-item loops (looping over ~14 EM countries, G7
  economies, etc., because the upstream API rate-limits concurrent bursts) check a shared deadline and
  stop early rather than run long.
- `withStageTimeout` in `ingest.ts` — races every stage against a generous per-stage timeout so one
  stuck stage can't take the whole pipeline down; a timed-out stage still gets a real `pipeline_runs` row
  instead of vanishing silently.

Every stage logs to `pipeline_runs` (status `ok`/`warning`/`failed` + detail) — check that table (or
`/admin`) first when a metric looks stale, before assuming the connector code is broken.

**The generic daily lookback window is short — deep-history features need their own stage.**
`src/lib/metrics/lookback.ts`'s `lookbackDaysFor("daily")` is 400 days, sized only to give
`zScore()` (`stats.ts`) its 20-observation minimum, and most `ingestFred`-style stages reuse it
uncritically. This silently starves anything that needs multi-year history to find real historical
events — verified live in production: `rate.fed_funds_effective` only ever carried ~13 months of
history, so `centralBankDecisionImpact.ts`'s hike/cut event study had zero sampled Fed hikes despite
the real 2022–2023 tightening cycle existing, simply because it predated the window. The fix is a
dedicated stage with its own explicit `sinceIso`, same pattern as `ingestEnergyBacktestSeries` (WTI
back to 1946), `ingestWorldBankCommodities` (back to 1960), and `ingestCentralBankRateHistory` (Fed/ECB
back to 2000) — before assuming a thin sample or "0 in sample" is a genuine data gap, check whether the
series' own lookback window is the actual cause.

### Adding a new data source connector

1. `src/lib/sources/<name>.ts` — export a `fetch<Thing>(...): Promise<MetricPoint[]>`. Verify the
   endpoint live (real, current data, not a stale/delisted symbol) before wiring it in — this project's
   convention (see any file's doc comment) is to document exactly what was checked and rejected, not
   just what was used.
2. `supabase/migrations/NNNN_<name>_source.sql` — insert the matching `sources` row (`key`, `tier`
   1-3, `category`, `status`). Tier 1 = official primary (FRED, central banks, SEC EDGAR); Tier 2 =
   multilateral/academic; Tier 3 = licensed/unofficial aggregators (Yahoo Finance, CoinGecko) — used only
   when no Tier-1/2 source exists.
3. Wire the fetch call into `runIngestionPipeline` in `ingest.ts`, wrapped in `withStageTimeout`.
4. If it's a commodity/domain metric, add a `get<Thing>()` wrapper in `src/lib/api/engineData.ts` (see
   below) so dashboard pages can consume it.

### `src/lib/api/engineData.ts` — the wrapper layer between engines and pages

One large file (~64 exported functions) wraps every engine/compute function in the same pattern:

```ts
export async function getSoyPalmPairsSpread(): Promise<CointegratedPairSpread | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const db = await createServerSupabase();
    return await computeSoyPalmPairsSpread(db);
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}
```

Dashboard Server Components call these `get*` functions directly (not the raw engine functions), always
tolerating `null`/misconfiguration gracefully rather than throwing. Follow this exact pattern for any new
engine exposed to a page. The registry-engine API routes (`/api/gfmi`, `/api/credit`, etc.) instead go
through `src/lib/api/engineRoute.ts` (`engineRouteHandler(engineKey)`) + `respond.ts`.

### Auth / route protection

Next.js 16 renamed `middleware.ts` → `proxy.ts` (`src/proxy.ts`, same behavior) — **do not** re-add a
`middleware.ts`, and don't assume training-data Next.js docs apply as-is; check
`node_modules/next/dist/docs/` when a Next.js API looks unfamiliar (see `AGENTS.md`). Route protection
logic lives in `src/lib/supabase/middleware.ts`'s `updateSession`: `/admin/*` requires `role = 'admin'`
in `profiles` (checked via `createAdminClient()`, the service-role client — the user-scoped client
can't read `profiles` itself because its own admin RLS policy recursively queries `profiles`, causing
Postgres error 42P17); `/dashboard/*` requires any signed-in user. Both fail closed (redirect to
`/login`) if Supabase is unreachable.

### Live vs. batch-computed prices

Most prices come from the once-daily pipeline into `metric_series` and are what every engine's z-score/
ADF/cointegration math is built on — swapping a live tick into that math mid-series would corrupt the
statistics, so don't. Where a page needs to show a genuinely current headline price (see
`src/lib/sources/liveCommodityQuotes.ts` and `yahooLiveQuote.ts`), fetch it fresh, on-demand, from
Yahoo Finance's public chart endpoint, and display it as a clearly labeled overlay ("Live"/"Latest
Close") alongside — never instead of — the settled price the statistics use.

### World News feed (`src/lib/sources/newsFeeds.ts`)

Fetched live per request (no DB, no pipeline stage) from ~55 publisher RSS feeds in `NEWS_SOURCES`, each
verified live before listing; dead/blocked ones are documented in that file's header rather than listed.
It deliberately does **not** read X/Twitter (no free read API, no credentials here) even though the spec
that motivated it (`News_Engine.pdf`) is X-handle-based — don't "add X support" without an API key.
Reuters/AP/Bloomberg/IMF/OECD/etc. come via Google News RSS restricted to the publisher's own domain
(`sourceMatch` drops results whose publisher differs). Nothing is LLM-written: summaries are the feed's own
text, priority/tags are keyword rules. Gotcha when editing regexes via shell one-liners: doubled
backslashes can arrive collapsed (`\\b` becomes a literal backspace character) — write the file with the
Write/Edit tools, and grep for control characters if a regex mysteriously never matches.

### Commodities taxonomy

`src/lib/commodities/taxonomy.ts` (`COMMODITIES`) is the master list mapping each commodity to its
World Bank Pink Sheet column, unit, etc. — most of `worldBankCommodities.ts`'s single connector feeds
Energy/Metals/Grains/Oilseeds/Softs/Livestock/Fertilizers off this one table. Related taxonomies:
`chemicalsTaxonomy.ts`, `oilseedsTaxonomy.ts`, `balanceTaxonomy.ts`.

### The two places an LLM computes something user-facing

Every score/number elsewhere in the app is a deterministic function of stored data
(`src/lib/metrics/stats.ts`) — these two are the deliberate, disclosed exceptions. Don't extend
LLM-computed content to any other dashboard page without calling that out explicitly and disclosing it
in the UI, since it breaks an invariant the rest of the app (and its credibility framing) depends on.

1. `src/lib/prediction/` (`openaiAnalysis.ts` using `gpt-4.1-mini`, `geminiAnalysis.ts`) — a commodity
   backtest/analysis for `/dashboard/prediction`, user-triggered per commodity (a button click, via
   `/api/prediction/analyze`), not run automatically on page load.
2. `src/lib/prediction/centralBankCommentary.ts` + `src/lib/engines/centralBankDecisionCommentary.ts` —
   short/medium/long-term impact + probable-trajectory commentary for the Banking tab's central-bank
   decision cards, generated automatically the first time a bank's detected rate move has no cached
   commentary, then cached in `central_bank_decision_commentary` (migration `0040`, keyed on
   `institution, event_date, to_level`) so the LLM runs once per real decision, not on every render.
   Bounded with a 15s per-request timeout (`AbortSignal.timeout`) and the page's own
   `export const maxDuration = 30`, so a slow/hung OpenAI response degrades to "the box doesn't show"
   rather than risking the page — this one runs inline in a Server Component, unlike #1's
   button-triggered flow, so it can't be allowed to hang.

### Known gotchas (each caused a real production incident)

- **Supabase/PostgREST's default 1000-row cap silently truncates unpaginated queries.** Any
  `.select()` against `metric_series` (or any table) that could return more than 1000 rows must page
  through with `.range(offset, offset + PAGE_SIZE - 1)` — without it, Postgres/PostgREST just returns
  the first 1000 rows with no error, no warning, nothing to indicate truncation happened. This silently
  broke `fetchSeries`/`fetchLatestForKeys` in production for every daily series with >1000 rows (BoE:
  cut off in 2003; BOJ, BoC similarly affected) — a live user report ("this event looks 20 years stale")
  is what surfaced it, not a test. Both functions in `src/lib/metrics/store.ts` now paginate correctly;
  copy that pattern for any new direct query against a long series, and don't trust a query "worked in
  testing" against a short series as proof it handles a long one.
- **`pdf-parse` / `pdfjs-dist` crash Vercel's Node serverless runtime** with
  `ReferenceError: DOMMatrix is not defined` during module evaluation — a real production outage on
  `/dashboard/banking` (the whole page 500'd, not just the PDF feature), because `pdfjs-dist` references
  browser-only globals that a bare `node`/`tsx` test script never exercises the same way Next.js's actual
  SSR bundle does, so it can look fine locally and still take the page down. Use `unpdf` instead (built
  for edge/serverless, no canvas/DOM dependency for plain text extraction — see
  `src/lib/sources/bojAnnouncementText.ts`), and load it via a **dynamic** `await import("unpdf")` inside
  a `try/catch`, not a static top-level `import` — a static import's module-evaluation error crashes the
  page before any `try/catch` can run; a dynamic import's rejection is catchable. Before shipping any
  library with native/WASM/browser-API dependencies into a Server Component, verify with an actual
  `next build && next start` + real HTTP request against the compiled server, not just a standalone
  script — that's the only thing that would have caught this before it shipped.

### Data freshness badges

`src/lib/quality/freshness.ts` (`freshnessFor`) classifies every value LIVE/RECENT/STALE/UNAVAILABLE
against per-frequency thresholds (daily/weekly/monthly/quarterly/annual — annual series get a much
longer "still current" window, since e.g. a debt/GDP ratio genuinely only updates once a year). A STALE
badge on an annual/international series is very often correct, not a bug — check the source's actual
publication cadence before "fixing" it.
