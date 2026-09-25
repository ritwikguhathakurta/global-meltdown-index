-- sse_options — Shanghai Stock Exchange ETF options daily statistics (the exchange's own public
--   data API): whole-market call/put open interest and put/call ratios. Tier 1 official exchange
--   data. See src/lib/sources/sseOptions.ts.

insert into sources (key, name, institution, url, tier, category, status) values
  ('sse_options', 'SSE ETF Options Daily Statistics', 'Shanghai Stock Exchange', 'https://www.sse.com.cn', 1, 'derivatives', 'active')
on conflict (key) do nothing;
