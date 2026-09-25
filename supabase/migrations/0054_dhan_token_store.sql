-- Single-row store for the DhanHQ access token so the pipeline can renew it automatically
-- (Dhan tokens last 24h; the renewal call returns a fresh one). Read/written only by the
-- service-role client in src/lib/sources/dhanToken.ts — RLS is enabled with NO policies, so the
-- anon/authenticated keys cannot read the token.

create table if not exists dhan_token (
  id int primary key default 1 check (id = 1),
  access_token text not null,
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table dhan_token enable row level security;
