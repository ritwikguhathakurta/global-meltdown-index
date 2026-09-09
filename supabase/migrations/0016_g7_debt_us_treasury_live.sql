-- ============================================================================
-- G7 Sovereign Debt engine — live US Treasury data: debt-to-the-penny,
-- 10Y/30Y auction results, and the NY Fed's own SOMA Treasury holdings.
-- See src/lib/sources/usTreasuryDebt.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('treasury_fiscal_data', 'Fiscal Data (Debt to the Penny, Auction Results)', 'U.S. Department of the Treasury', 'https://fiscaldata.treasury.gov/', 1, 'g7_debt', 'active'),
  ('ny_fed_soma', 'System Open Market Account (SOMA) Holdings', 'Federal Reserve Bank of New York', 'https://markets.newyorkfed.org/', 1, 'g7_debt', 'active')
on conflict (key) do nothing;
