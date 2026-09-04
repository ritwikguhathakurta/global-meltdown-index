-- Global Meltdown Index — initial schema (Phase 1)
-- Target: Supabase Postgres. TimescaleDB is not available on Supabase, so time-series
-- data uses a single indexed metric_series table (keyed by metric_key + observed_at)
-- instead of the ~20 rigid per-domain tables in the original spec. Same normalized
-- shape, far less schema churn as engines are added; filter by metric_key prefix
-- (e.g. 'fx.', 'yield.', 'yenengine.').

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists pgcrypto;

-- ============================================================================
-- AUTH / USERS
-- Supabase Auth owns auth.users. We extend with a profile + role.
-- ============================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  user_id uuid primary key references profiles(id) on delete cascade,
  tier text not null default 'FREE' check (tier in ('FREE','PRO','PREMIUM','INSTITUTIONAL')),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled','grace_period')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  billing_provider text,
  billing_ref text,
  updated_at timestamptz not null default now()
);

create table if not exists entitlements (
  user_id uuid not null references profiles(id) on delete cascade,
  feature text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (user_id, feature)
);

-- ============================================================================
-- SOURCE REGISTRY  (V3 §13/§45/§46)
-- ============================================================================
create table if not exists sources (
  id serial primary key,
  key text unique not null,               -- e.g. 'fred', 'stooq', 'cftc_cot', 'boj_rss'
  name text not null,
  institution text,
  url text,
  tier int not null check (tier between 1 and 5),  -- 1=official primary ... 5=verified social
  category text,
  status text not null default 'active' check (status in ('active','degraded','disabled')),
  created_at timestamptz not null default now()
);

create table if not exists source_health (
  id bigserial primary key,
  source_id int not null references sources(id),
  checked_at timestamptz not null default now(),
  status text not null check (status in ('LIVE','RECENT','STALE','UNAVAILABLE','CONFLICTING')),
  latency_ms int,
  error text
);
create index if not exists idx_source_health_source_time on source_health(source_id, checked_at desc);

-- ============================================================================
-- TIME SERIES  (replaces market_prices/bond_yields/fx_prices/volatility/... )
-- ============================================================================
create table if not exists metric_series (
  id bigserial primary key,
  metric_key text not null,
  observed_at timestamptz not null,
  value double precision not null,
  unit text,
  source_id int references sources(id),
  source_tier int,
  quality_grade text check (quality_grade in ('A','B','C','D','F')),
  frequency text,                          -- 'daily','weekly','monthly','quarterly'
  raw jsonb,
  ingested_at timestamptz not null default now(),
  unique (metric_key, observed_at, source_id)
);
create index if not exists idx_metric_series_key_time on metric_series(metric_key, observed_at desc);

-- ============================================================================
-- RISK ENGINE OUTPUT  (V3 §4, 24 engines x 3 horizons)
-- ============================================================================
create table if not exists risk_engine_scores (
  id bigserial primary key,
  engine_key text not null,
  as_of date not null,
  horizon text not null check (horizon in ('short','medium','long')),
  score numeric check (score between 0 and 100),
  direction text check (direction in ('improving','deteriorating','stable','unknown')),
  regime text,
  confidence numeric check (confidence between 0 and 1),
  top_drivers jsonb,
  leading_indicators jsonb,
  coincident_indicators jsonb,
  lagging_indicators jsonb,
  contradictory_evidence jsonb,
  not_yet_happened jsonb,
  trigger_desc text,
  amplifiers jsonb,
  transmission_mechanism text,
  invalidation_conditions jsonb,
  confirmation_conditions jsonb,
  methodology_version text not null default 'v0.1',
  data_completeness numeric,               -- fraction of expected inputs actually available
  computed_at timestamptz not null default now(),
  unique (engine_key, as_of, horizon)
);
create index if not exists idx_res_engine_time on risk_engine_scores(engine_key, as_of desc);

-- ============================================================================
-- GFMI COMPOSITE  (V3 §2)
-- ============================================================================
create table if not exists gfmi_scores (
  as_of date primary key,
  score numeric check (score between 0 and 100),
  regime text,
  confidence numeric,
  components jsonb,          -- {engine_key: {score, weight, contribution}}
  amplifier_applied numeric, -- multiplicative bump from simultaneous deterioration
  override_triggered text,   -- e.g. 'GLOBAL_DELEVERAGING_REGIME' / 'SYSTEMIC_CRISIS_REGIME' / null
  methodology_version text not null default 'v0.1',
  computed_at timestamptz not null default now()
);

-- ============================================================================
-- INDIA REGIME  (V3 §40)
-- ============================================================================
create table if not exists india_regime (
  as_of date not null,
  horizon text not null check (horizon in ('short','medium','long')),
  score numeric check (score between 0 and 100),
  classification text check (classification in ('BEARISH','SLIGHTLY_BEARISH','NEUTRAL','BULLISH','STRONGLY_BULLISH')),
  confidence numeric,
  top_positive jsonb,
  top_negative jsonb,
  invalidation_conditions jsonb,
  next_catalysts jsonb,
  methodology_version text not null default 'v0.1',
  computed_at timestamptz not null default now(),
  primary key (as_of, horizon)
);

-- ============================================================================
-- CENTRAL BANK INTELLIGENCE  (V3 §6-§12)
-- ============================================================================
create table if not exists central_bank_events (
  id bigserial primary key,
  institution text not null,
  official text,
  role text,
  event_date date not null,
  event_type text,                 -- speech/minutes/statement/testimony/report
  title text not null,
  source_url text not null,
  raw_text text,
  hawkishness numeric,             -- null until NLP scoring pass runs
  dovishness numeric,
  uncertainty numeric,
  stance_change text check (stance_change in (
    'MORE_HAWKISH','LESS_HAWKISH','MORE_DOVISH','LESS_DOVISH','UNCHANGED',
    'NEW_RISK','RISK_REMOVED','NEW_CONDITION','GUIDANCE_REVISION',
    'POLICY_REACTION_FUNCTION_CHANGE', null
  )),
  summary jsonb,
  source_tier int not null default 1,
  ingested_at timestamptz not null default now(),
  unique (institution, source_url)
);
create index if not exists idx_cbe_inst_date on central_bank_events(institution, event_date desc);

-- ============================================================================
-- HISTORICAL CRISIS LIBRARY  (V3 §34-35)
-- ============================================================================
create table if not exists historical_crises (
  id serial primary key,
  name text unique not null,
  start_date date,
  end_date date,
  trigger_desc text,
  characteristics jsonb
);

create table if not exists lead_lag_results (
  id bigserial primary key,
  indicator_key text not null,
  event_key text not null,
  indicator_date date,
  event_date date,
  lead_days int,
  direction text,
  regime text,
  success boolean,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- EVENTS / ALERTS
-- ============================================================================
create table if not exists events_calendar (
  id bigserial primary key,
  event_type text not null,
  title text not null,
  event_time timestamptz not null,
  importance text check (importance in ('low','medium','high','critical')),
  institution text,
  source_url text,
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id bigserial primary key,
  alert_type text not null check (alert_type in ('WATCH','EARLY_WARNING','HIGH_ALERT','CRISIS','SYSTEMIC')),
  engine_key text,
  title text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- PIPELINE / DATA QUALITY  (V3 §43-48, §63, §74)
-- ============================================================================
create table if not exists pipeline_runs (
  id bigserial primary key,
  run_date date not null,
  stage text not null,
  status text not null check (status in ('ok','warning','failed')),
  detail jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists data_quality (
  metric_key text not null,
  as_of date not null,
  status text not null check (status in ('LIVE','RECENT','STALE','UNAVAILABLE','CONFLICTING')),
  grade text check (grade in ('A','B','C','D','F')),
  checked_at timestamptz not null default now(),
  primary key (metric_key, as_of)
);

create table if not exists audit_logs (
  id bigserial primary key,
  user_id uuid,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- RLS
-- ============================================================================
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table entitlements enable row level security;
alter table audit_logs enable row level security;

create policy "profiles_self_select" on profiles for select using (auth.uid() = id);
create policy "profiles_self_update" on profiles for update using (auth.uid() = id);
create policy "subscriptions_self_select" on subscriptions for select using (auth.uid() = user_id);
create policy "entitlements_self_select" on entitlements for select using (auth.uid() = user_id);

-- Admin bypass: a profile with role='admin' can select/update everything.
create policy "profiles_admin_all" on profiles for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "subscriptions_admin_all" on subscriptions for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Public read tables (risk data is the product; gate premium detail in the app layer, not RLS,
-- since "free preview vs paid depth" is a business rule, not a security boundary).
alter table risk_engine_scores enable row level security;
alter table gfmi_scores enable row level security;
alter table india_regime enable row level security;
alter table central_bank_events enable row level security;
create policy "public_read_risk_engine_scores" on risk_engine_scores for select using (true);
create policy "public_read_gfmi_scores" on gfmi_scores for select using (true);
create policy "public_read_india_regime" on india_regime for select using (true);
create policy "public_read_central_bank_events" on central_bank_events for select using (true);

-- New-user hook: auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user');
  insert into public.subscriptions (user_id, tier, status, trial_ends_at)
  values (new.id, 'FREE', 'trialing', now() + interval '90 days');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seed source registry (Phase 1 free sources)
insert into sources (key, name, institution, url, tier, category, status) values
  ('fred', 'FRED', 'Federal Reserve Bank of St. Louis', 'https://fred.stlouisfed.org', 1, 'macro', 'active'),
  ('yahoo_finance', 'Yahoo Finance (chart API)', 'Yahoo Finance', 'https://finance.yahoo.com', 3, 'market_data', 'active'),
  ('cftc_cot', 'CFTC Commitments of Traders', 'CFTC', 'https://www.cftc.gov/MarketReports/CommitmentsofTraders', 1, 'positioning', 'active'),
  ('frankfurter', 'Frankfurter FX', 'European Central Bank (reference rates)', 'https://api.frankfurter.dev', 1, 'fx', 'active'),
  ('fed_press', 'Federal Reserve Press Releases', 'Federal Reserve', 'https://www.federalreserve.gov/feeds/press_all.xml', 1, 'central_bank', 'active'),
  ('ecb_press', 'ECB Press', 'European Central Bank', 'https://www.ecb.europa.eu/rss/press.html', 1, 'central_bank', 'active'),
  ('boe_press', 'Bank of England News', 'Bank of England', 'https://www.bankofengland.co.uk/rss/news', 1, 'central_bank', 'active'),
  ('rbi_press', 'RBI Press Releases', 'Reserve Bank of India', 'https://www.rbi.org.in/pressreleases_rss.xml', 1, 'central_bank', 'active')
on conflict (key) do nothing;

-- Seed historical crisis library (dates/characteristics to be enriched over time)
insert into historical_crises (name, start_date, end_date, trigger_desc) values
  ('1929 Crash / Great Depression', '1929-09-01', '1932-06-30', 'Equity valuation excess, margin leverage, banking panics'),
  ('1973-74 Oil Shock / Bear Market', '1973-10-01', '1974-12-31', 'OPEC oil embargo, stagflation'),
  ('1987 Black Monday', '1987-08-01', '1987-12-31', 'Portfolio insurance, program-trading feedback loop'),
  ('1997 Asian Financial Crisis', '1997-07-01', '1998-12-31', 'FX pegs, short-term dollar debt, current-account deficits'),
  ('1998 LTCM / Russia Default', '1998-08-01', '1998-10-31', 'Russia default, leveraged relative-value unwind'),
  ('2000 Dot-com Crash', '2000-03-01', '2002-10-31', 'Tech valuation excess, capex boom collapse'),
  ('2001 9/11 Shock', '2001-09-11', '2001-10-31', 'Geopolitical shock, risk-off'),
  ('2008 Global Financial Crisis', '2007-08-01', '2009-06-30', 'Subprime mortgage leverage, shadow banking, Lehman collapse'),
  ('2010-12 European Sovereign Debt Crisis', '2010-01-01', '2012-12-31', 'Peripheral sovereign debt, banking-sovereign doom loop'),
  ('2015 China Deval / Global Growth Scare', '2015-06-01', '2016-02-29', 'CNY devaluation, China growth slowdown'),
  ('2018 Vol-mageddon / Q4 selloff', '2018-01-01', '2018-12-31', 'Short-vol unwind, Fed tightening'),
  ('2020 COVID Crash', '2020-02-01', '2020-04-30', 'Pandemic shock, liquidity freeze'),
  ('2022 Rate-Hike Bear Market', '2022-01-01', '2022-12-31', 'Inflation shock, aggressive central-bank tightening'),
  ('2023 Regional Banking Stress (SVB)', '2023-03-01', '2023-05-31', 'Duration mismatch, uninsured deposit flight'),
  ('2024 Yen Carry Unwind (Aug)', '2024-07-01', '2024-08-31', 'BOJ hike + weak US jobs data, carry-trade deleveraging')
on conflict (name) do nothing;
