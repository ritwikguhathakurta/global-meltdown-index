-- cffex_derivatives — CFFEX (China Financial Futures Exchange) official daily
--   data XML: index futures / index options / government-bond futures open
--   interest. Tier 1 official exchange data. See src/lib/sources/cffexDerivatives.ts.

insert into sources (key, name, institution, url, tier, category, status) values
  ('cffex_derivatives', 'CFFEX Daily Trading Data', 'China Financial Futures Exchange', 'http://www.cffex.com.cn', 1, 'derivatives', 'active')
on conflict (key) do nothing;
