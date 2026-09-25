-- ice_futures_europe_cot — ICE Futures Europe Commitments of Traders (public yearly CSV):
--   Managed Money net positioning in Brent, Gasoil, Robusta, Cocoa, White Sugar, London Wheat.
--   Tier 1 official exchange data. See src/lib/sources/iceFuturesEuropeCot.ts.

insert into sources (key, name, institution, url, tier, category, status) values
  ('ice_futures_europe_cot', 'ICE Futures Europe Commitments of Traders', 'ICE Futures Europe', 'https://www.ice.com', 1, 'derivatives', 'active')
on conflict (key) do nothing;
