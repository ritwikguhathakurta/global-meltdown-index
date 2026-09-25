-- szse_options — Shenzhen Stock Exchange ETF options daily overview (the exchange's own public
--   report API): whole-market call/put open interest and put/call ratios. Tier 1 official
--   exchange data. See src/lib/sources/szseOptions.ts.

insert into sources (key, name, institution, url, tier, category, status) values
  ('szse_options', 'SZSE ETF Options Daily Overview', 'Shenzhen Stock Exchange', 'https://www.szse.cn', 1, 'derivatives', 'active')
on conflict (key) do nothing;
