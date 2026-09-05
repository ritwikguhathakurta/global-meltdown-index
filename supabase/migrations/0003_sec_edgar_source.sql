-- ============================================================================
-- PHASE 3 SOURCE REGISTRY — the 3 AI-related engines built on real company
-- financials (Financial Sustainability, Credit/Financing, Debt Maturity Wall)
-- plus AI Valuation, which reuses SEC EDGAR EPS data alongside Yahoo prices.
-- No schema changes needed (see 0001_init.sql design note) — this just
-- registers the new data provider.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('sec_edgar', 'SEC EDGAR XBRL Company Facts', 'U.S. Securities and Exchange Commission', 'https://www.sec.gov/edgar', 1, 'company_financials', 'active')
on conflict (key) do nothing;
