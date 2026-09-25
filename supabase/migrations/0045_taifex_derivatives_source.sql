-- taifex_derivatives — TAIFEX (Taiwan Futures Exchange) official Open API:
--   TAIEX futures open interest and TAIEX options put/call OI ratio. Tier 1
--   official exchange data. See src/lib/sources/taifexDerivatives.ts.

insert into sources (key, name, institution, url, tier, category, status) values
  ('taifex_derivatives', 'TAIFEX Daily Market Report (Open API)', 'Taiwan Futures Exchange', 'https://openapi.taifex.com.tw', 1, 'derivatives', 'active')
on conflict (key) do nothing;
