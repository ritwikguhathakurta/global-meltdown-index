-- deribit_options — Deribit public API: BTC/ETH options open interest and put/call OI ratio.
--   Tier 3 (single commercial exchange). See src/lib/sources/deribitOptions.ts.

insert into sources (key, name, institution, url, tier, category, status) values
  ('deribit_options', 'Deribit Options Open Interest (public API)', 'Deribit', 'https://www.deribit.com', 3, 'derivatives', 'active')
on conflict (key) do nothing;
