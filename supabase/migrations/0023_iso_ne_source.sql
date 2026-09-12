-- ============================================================================
-- ISO New England Web Services API — free (registered username/password),
-- Tier 1 official grid-operator source. Feeds the Energy Systemic Risk
-- engine's Electricity/Grid domain (spec §23-25, §69) with real-time New
-- England system load and generation fuel mix — see src/lib/sources/isoNe.ts.
-- First of several US ISOs being added; others follow as registrations
-- complete (PJM/ERCOT need approval, CAISO/MISO/NYISO need no key).
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('iso_ne', 'ISO-NE Web Services API', 'ISO New England', 'https://www.iso-ne.com/participate/support/web-services-data', 1, 'energy', 'active')
on conflict (key) do nothing;
