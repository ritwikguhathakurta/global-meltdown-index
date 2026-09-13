-- ============================================================================
-- MPOB mirror (palmoileconomics.com) for Malaysia CPO/total palm oil stock
-- history back to 2000. See src/lib/sources/mpobMirrorStocks.ts for the
-- live cross-check against an independent MPOB news write-up and the
-- per-indicator coverage check that limited this to cpo_stock/total_po_stock.
-- Kept as its own tier-3 source, distinct from the tier-1 mpob_malaysia
-- (MPOB's own site) added in migration 0032.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('mpob_mirror', 'MPOB Monthly Data (via palmoileconomics.com mirror)', 'Malaysian Palm Oil Board (MPOB), mirrored', 'https://palmoileconomics.com/data/mpob', 3, 'commodities', 'active')
on conflict (key) do nothing;
