-- mx_options — Montréal Exchange (TMX) daily equity options summary workbook: whole-market
--   call/put open interest and put/call ratios. Tier 1 official exchange data.
--   See src/lib/sources/mxOptions.ts.

insert into sources (key, name, institution, url, tier, category, status) values
  ('mx_options', 'Montréal Exchange Daily Options Summary', 'Bourse de Montréal (TMX Group)', 'https://www.m-x.ca', 1, 'derivatives', 'active')
on conflict (key) do nothing;
