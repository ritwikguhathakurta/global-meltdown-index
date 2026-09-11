-- ============================================================================
-- NBFI Monitoring Registry — automated freshness tracking for the single
-- FSB "Global Monitoring Report on Nonbank Financial Intermediation" entry
-- surfaced on /dashboard/liquidity#nbfi-monitoring (see
-- src/lib/data/nbfiRegistry.ts for the curated report/stance metadata, which
-- stays in code since it requires reading and classifying the report's own
-- content — a human judgment, not something to auto-extract reliably). This
-- table holds only the MECHANICAL freshness check the pipeline runs
-- automatically on every cron run, same pattern as central_bank_fsr_checks
-- (migration 0019) but for the NBFI registry.
-- ============================================================================

create table if not exists nbfi_checks (
  key text primary key,
  last_checked_at timestamptz,
  check_status text not null default 'unchecked',
  note text
);

alter table nbfi_checks enable row level security;
create policy "public_read_nbfi_checks" on nbfi_checks for select using (true);
