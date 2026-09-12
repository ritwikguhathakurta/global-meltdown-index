-- ============================================================================
-- CAISO "Today's Outlook" — free, no key, Tier 1 official grid-operator
-- source (California ISO). Feeds the Energy Systemic Risk engine's
-- Electricity/Grid domain (spec §23-25, §69) with real-time system load and
-- generation-by-fuel-type — see src/lib/sources/caisoOutlook.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('caiso_outlook', 'CAISO Today''s Outlook', 'California Independent System Operator', 'https://www.caiso.com/todays-outlook', 1, 'energy', 'active')
on conflict (key) do nothing;
