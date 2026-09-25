-- fbil_benchmarks — FBIL (Financial Benchmarks India) official T-Bill, MIBOR OIS and Certificate
--   of Deposit benchmark curves, from the unauthenticated endpoints its public dashboard uses.
--   Tier 1 (official benchmark administrator). See src/lib/sources/fbilBenchmarks.ts.

insert into sources (key, name, institution, url, tier, category, status) values
  ('fbil_benchmarks', 'FBIL T-Bill / MIBOR OIS / CD Benchmark Curves', 'Financial Benchmarks India Pvt Ltd', 'https://www.fbil.org.in', 1, 'rates', 'active')
on conflict (key) do nothing;
