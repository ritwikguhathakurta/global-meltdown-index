-- ============================================================================
-- IMF PortWatch — Daily Chokepoint Transit Calls and Trade Volume Estimates.
-- Free, official (IMF), Tier 2. Feeds the Energy Systemic Risk engine's
-- Shipping/Chokepoint domain (energySystemicRisk.ts) with real per-chokepoint
-- vessel-transit and capacity data for all 28 tracked global chokepoints —
-- see src/lib/sources/imfPortwatch.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('imf_portwatch', 'Daily Chokepoint Transit Calls and Trade Volume Estimates', 'International Monetary Fund (PortWatch)', 'https://portwatch.imf.org/pages/data-and-methodology', 2, 'energy', 'active')
on conflict (key) do nothing;
