-- jpx_open_interest — JPX (Japan Exchange Group / Osaka Exchange) daily derivatives open
--   interest workbook: Nikkei 225/TOPIX futures (incl. mini/micro) and options put/call OI.
--   Tier 1 official exchange data. Corrects an earlier "JPX requires a paid contract"
--   disclosure -- see src/lib/sources/jpxOpenInterest.ts.

insert into sources (key, name, institution, url, tier, category, status) values
  ('jpx_open_interest', 'JPX Derivatives Open Interest', 'Japan Exchange Group', 'https://www.jpx.co.jp', 1, 'derivatives', 'active')
on conflict (key) do nothing;
