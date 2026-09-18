-- ============================================================================
-- Central Bank Decision Commentary — LLM-generated analyst commentary
-- (short/medium/long-term impact + probable rate-trajectory) for the Banking
-- tab, generalized from a hand-written BOJ-only writeup to all 7 tracked
-- central banks (see src/lib/engines/centralBankDecisionImpact.ts).
--
-- This is the app's second deliberate LLM-computed, user-facing surface
-- (the first is /dashboard/prediction — see openaiAnalysis.ts) and is
-- disclosed as such on the page itself, never presented as a computed metric
-- the way this app's z-scores/ADF tests/event studies are.
--
-- One row per DETECTED decision (institution + event_date + to_level, from
-- detectRateChangeEvents' persistence-confirmed rate-change algorithm, not a
-- press release) — the (institution, event_date, to_level) unique constraint
-- is the cache key: the LLM is called once per genuinely new decision, not on
-- every page render. Written and read via the service-role client only (this
-- is shared, publicly-displayed analytical content, not user data), but is
-- publicly READABLE like the rest of this app's risk data.
-- ============================================================================

create table if not exists central_bank_decision_commentary (
  id bigserial primary key,
  institution text not null,
  event_date date not null,
  from_level numeric not null,
  to_level numeric not null,
  change_bps numeric not null,
  short_term text not null,
  medium_term text not null,
  long_term text not null,
  trajectory text not null,
  model text not null,
  generated_at timestamptz not null default now(),
  unique (institution, event_date, to_level)
);

alter table central_bank_decision_commentary enable row level security;
create policy "public_read_central_bank_decision_commentary" on central_bank_decision_commentary for select using (true);
