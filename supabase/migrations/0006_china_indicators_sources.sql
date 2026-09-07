-- ============================================================================
-- Four previously-UNAVAILABLE China indicators (property sales, credit
-- impulse, PMI new orders, LGFV debt) now have real free sources:
--   - gov_cn_statistics: NBS's own monthly press releases, reached via the
--     State Council's English portal (english.www.gov.cn) rather than
--     stats.gov.cn directly, which actively blocks non-browser clients.
--     See src/lib/sources/govCnStatistics.ts.
--   - bis: Bank for International Settlements Credit-to-GDP Gap statistics
--     (China credit-impulse proxy). See src/lib/sources/bisCreditGap.ts.
--   - imf_article_iv: IMF China Article IV Consultation staff report's
--     "Augmented Debt" (incl. LGFVs) estimate — manually-refreshed annual
--     figure, not a live feed. See src/lib/sources/imfAugmentedDebt.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('gov_cn_statistics', 'NBS Monthly Statistical Releases (via State Council English portal)', 'National Bureau of Statistics of China', 'https://english.www.gov.cn/archive/statistics/', 1, 'china_macro', 'active'),
  ('bis', 'BIS Credit-to-GDP Gap Statistics', 'Bank for International Settlements', 'https://stats.bis.org', 1, 'china_macro', 'active'),
  ('imf_article_iv', 'IMF Article IV Consultation Staff Reports', 'International Monetary Fund', 'https://www.imf.org/en/publications/cr', 1, 'china_macro', 'active')
on conflict (key) do nothing;
