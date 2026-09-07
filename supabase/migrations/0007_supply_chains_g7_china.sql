-- ============================================================================
-- Supply Chains engine extended from a single global GSCPI number to
-- per-country G7+China proxies. Five of the new indicators reuse existing
-- sources (fred, gov_cn_statistics); Canada's comes directly from
-- Statistics Canada's own Web Data Service API.
-- See src/lib/sources/statCan.ts, src/lib/sources/fred.ts,
-- src/lib/sources/govCnStatistics.ts, src/lib/engines/supplyChains.ts.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('statcan', 'Statistics Canada Web Data Service', 'Statistics Canada', 'https://www150.statcan.gc.ca/t1/wds/rest', 1, 'supply_chains', 'active')
on conflict (key) do nothing;
