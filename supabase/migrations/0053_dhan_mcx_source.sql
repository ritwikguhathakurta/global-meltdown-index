-- dhan_mcx — MCX commodity futures last price / open interest / volume via the DhanHQ market
--   data API (a SEBI-registered broker's licensed relay of MCX data; needs DHAN_CLIENT_ID and
--   DHAN_ACCESS_TOKEN). Tier 3. See src/lib/sources/dhanMcx.ts.

insert into sources (key, name, institution, url, tier, category, status) values
  ('dhan_mcx', 'MCX Futures via DhanHQ Market Data API', 'Multi Commodity Exchange of India (via Dhan)', 'https://dhanhq.co', 3, 'derivatives', 'active')
on conflict (key) do nothing;
