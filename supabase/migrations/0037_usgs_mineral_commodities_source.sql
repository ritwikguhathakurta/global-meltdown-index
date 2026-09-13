-- ============================================================================
-- USGS National Minerals Information Center's Mineral Commodity Summaries
-- bulk data release — world + country-level mine/smelter production for
-- Base Metals, Precious Metals, Critical Minerals, and Fertilizers. See
-- src/lib/sources/usgsMineralCommodities.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('usgs_mcs', 'USGS Mineral Commodity Summaries', 'USGS National Minerals Information Center', 'https://www.sciencebase.gov/catalog/item/69837e43b66b01367d7ec7c7', 1, 'commodities', 'active')
on conflict (key) do nothing;
