-- ============================================================================
-- Security fix: privilege escalation via profiles self-update.
--
-- 0001_init.sql's "profiles_self_update" policy is
--   for update using (auth.uid() = id)
-- with no WITH CHECK and no column restriction, and signup is open — so any
-- signed-in user could PATCH their own profiles row through PostgREST with the
-- public anon key and set role = 'admin', gaining /admin, the pipeline
-- trigger, and the Binance order endpoint. Nothing in src/ updates profiles as
-- a user (every use is a read of `role`), so the safe fix is to remove UPDATE
-- from the API roles entirely. Server code that needs to change a role uses
-- the service-role client, which is unaffected by this revoke.
--
-- Also enables RLS (deny-by-default, no policies) on six tables created in
-- 0001 that never had it and that nothing in src/ reads or writes; without
-- RLS, Supabase's default grants let the anon key read/modify them.
-- ============================================================================

revoke update on public.profiles from anon, authenticated;

alter table if exists public.source_health enable row level security;
alter table if exists public.historical_crises enable row level security;
alter table if exists public.lead_lag_results enable row level security;
alter table if exists public.events_calendar enable row level security;
alter table if exists public.alerts enable row level security;
alter table if exists public.data_quality enable row level security;

-- After running: confirm nobody else is admin.
--   select id, email, role from profiles where role = 'admin';
