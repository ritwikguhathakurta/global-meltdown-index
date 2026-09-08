-- ============================================================================
-- EM Debt Systemic Risk Engine rebuild — structural sovereign-vulnerability
-- data (World Bank Open Data API: debt/GDP, external debt, rollover, reserve
-- adequacy, current account, fiscal balance) and a sovereign CDS snapshot
-- (Damodaran/NYU Stern's free annual "Country Risk Premiums" workbook, used
-- because no free live CDS feed exists — ICE/Markit-licensed). See
-- src/lib/sources/worldBankEmDebt.ts and sovereignRiskPremium.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('world_bank', 'World Bank Open Data API (WDI / International Debt Statistics)', 'World Bank', 'https://api.worldbank.org/v2', 1, 'em_debt', 'active'),
  ('damodaran_nyu', 'Country Risk Premiums (10-Year Sovereign CDS Spreads)', 'Aswath Damodaran, NYU Stern School of Business', 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ctryprem.html', 2, 'em_debt', 'active')
on conflict (key) do nothing;
