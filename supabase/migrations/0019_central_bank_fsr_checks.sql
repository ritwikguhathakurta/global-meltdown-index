-- ============================================================================
-- Central Bank Financial Stability Report (FSR) Verification — automated
-- freshness tracking for the nine-country registry surfaced on
-- /dashboard/banking#central-bank-fsr-verification (see
-- src/lib/data/centralBankFsrRegistry.ts for the curated institution/report/
-- stance metadata, which stays in code since it requires reading and
-- classifying each report's own content — a human judgment, not something
-- to auto-extract reliably). This table holds only the MECHANICAL freshness
-- check the pipeline runs automatically on every cron run: for the three
-- institutions with an already-integrated press RSS feed (Fed, BoE, RBI —
-- see centralBankRss.ts/central_bank_events), whether a newer
-- "Financial Stability Report"-titled item has appeared since the currently
-- stored publishedDate; for the other six (BOJ, Bundesbank, Banca d'Italia,
-- Banque de France, Bank of Canada, PBOC), whether their own publications
-- listing page still contains the previously-verified date/title string.
--
-- This does NOT auto-update publishedDate/stance in centralBankFsrRegistry.ts
-- — it flags "needs_review" so a human (re-)verifies the new edition's actual
-- content before the registry file is edited, same discipline as every other
-- source in this app (verify before wiring in, disclose rather than guess).
-- ============================================================================

create table if not exists central_bank_fsr_checks (
  key text primary key,
  last_checked_at timestamptz,
  check_status text not null default 'unchecked',
  note text
);

alter table central_bank_fsr_checks enable row level security;
create policy "public_read_central_bank_fsr_checks" on central_bank_fsr_checks for select using (true);
