-- ============================================================================
-- NYISO MIS Public Data Archive — free, no key, no account, Tier 1 official
-- grid-operator source (New York ISO). Feeds the Energy Systemic Risk
-- engine's Electricity/Grid domain (spec §23-25, §69) with real-time system
-- load and generation-by-fuel-type — see src/lib/sources/nyisoOutlook.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('nyiso_mis', 'NYISO MIS Public Data Archive', 'New York Independent System Operator', 'https://www.nyiso.com/public-data', 1, 'energy', 'active')
on conflict (key) do nothing;
