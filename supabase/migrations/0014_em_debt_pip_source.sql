-- ============================================================================
-- EM Debt engine extension — foreign-holdings-of-debt-securities data (IMF
-- Portfolio Investment Positions by Counterpart Economy, formerly CPIS) and
-- corporate FX debt (BIS International Debt Securities). "bis" is already
-- registered (added earlier for the Credit tab's credit-to-GDP gaps) and is
-- reused as-is for the new BIS series — only imf_pip is new here. See
-- src/lib/sources/imfForeignHoldings.ts and bisCorporateFxDebt.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('imf_pip', 'Portfolio Investment Positions by Counterpart Economy (PIP, formerly CPIS)', 'International Monetary Fund', 'https://data.imf.org/en/Resource-Pages/IMF-API', 1, 'em_debt', 'active')
on conflict (key) do nothing;
