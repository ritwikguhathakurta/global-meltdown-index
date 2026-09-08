-- ============================================================================
-- EM Debt engine — fills World Bank WDI structural-indicator gaps using two
-- more IMF databases (Global Debt Database for govt debt/GDP; World
-- Economic Outlook for fiscal balance) plus World Bank's own separate QEDS
-- product (external debt stock) for the specific countries WDI's own "DT."
-- ratio family has no data for. See src/lib/sources/imfFiscalGaps.ts and
-- qedsExternalDebt.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('imf_gdd', 'Global Debt Database (GDD)', 'International Monetary Fund', 'https://data.imf.org/en/Resource-Pages/IMF-API', 1, 'em_debt', 'active'),
  ('imf_weo', 'World Economic Outlook (WEO) database', 'International Monetary Fund', 'https://data.imf.org/en/Resource-Pages/IMF-API', 1, 'em_debt', 'active'),
  ('world_bank_qeds', 'Quarterly External Debt Statistics (QEDS, SDDS)', 'World Bank', 'https://www.worldbank.org/en/programs/debt-statistics/qeds', 1, 'em_debt', 'active')
on conflict (key) do nothing;
