-- ============================================================================
-- Direct-from-central-bank daily government bond yields for Germany, the UK
-- and Canada, replacing the OECD/FRED monthly proxy those three used to
-- share with the rest of the G7 (structurally lags 2-4 months). See
-- src/lib/sources/govBondYields.ts for the fetchers.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('bundesbank', 'Bundesbank Securities Statistics (BBSIS)', 'Deutsche Bundesbank', 'https://api.statistiken.bundesbank.de', 1, 'sovereign_yields', 'active'),
  ('boe', 'Bank of England Interactive Statistical Database', 'Bank of England', 'https://www.bankofengland.co.uk/boeapps/database/', 1, 'sovereign_yields', 'active'),
  ('boc', 'Bank of Canada Valet API', 'Bank of Canada', 'https://www.bankofcanada.ca/valet/', 1, 'sovereign_yields', 'active')
on conflict (key) do nothing;
