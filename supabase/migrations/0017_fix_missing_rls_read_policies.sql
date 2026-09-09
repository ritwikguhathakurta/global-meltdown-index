-- ============================================================================
-- Root-cause fix: metric_series, sources and pipeline_runs were created in
-- 0001_init.sql but never given a public-read RLS policy the way
-- risk_engine_scores/gfmi_scores/india_regime/central_bank_events were.
--
-- At the time, nothing read these three tables directly from the anon-key
-- browser-facing client — only service-role backend code (ingestion) wrote
-- to metric_series/sources, and pipeline_runs was purely an internal log.
-- Since then, several dashboard pages started reading metric_series
-- directly at render time for their own live per-country breakdowns:
-- EM Debt (emDebtRegime.ts), G7 Debt (g7DebtRegime.ts), Credit
-- (creditRegime.ts), Central-Bank Liquidity (liquidityRegime.ts) all call
-- fetchLatestForKeys/fetchSeries against metric_series using the normal
-- (anon-key, RLS-governed) server client — and the Sources page
-- (getSourceRegistry) reads `sources` the same way.
--
-- Verified directly: querying metric_series/sources/pipeline_runs with the
-- project's own anon key returns an empty array even for rows that exist
-- and are correctly populated (confirmed via the service-role key, which
-- bypasses RLS) — RLS was silently filtering out every row for anon/
-- authenticated because no policy ever granted them read access. This is
-- why EM Debt, G7 Debt (and likely Credit's per-country table and the
-- Sources page) rendered "INSUFFICIENT DATA" / "0% coverage" on the live
-- site for every country despite the pipeline successfully ingesting real
-- data the whole time — the ingest path (service role) was never affected,
-- only the browser-facing read path was blocked.
--
-- Fix: same public-read pattern already used for the other four tables.
-- These three hold no user-specific or sensitive data (market/economic
-- data and an ingestion log), so a public SELECT policy is the correct,
-- consistent choice — not a narrower authenticated-only one.
-- ============================================================================

alter table metric_series enable row level security;
alter table sources enable row level security;
alter table pipeline_runs enable row level security;

create policy "public_read_metric_series" on metric_series for select using (true);
create policy "public_read_sources" on sources for select using (true);
create policy "public_read_pipeline_runs" on pipeline_runs for select using (true);
