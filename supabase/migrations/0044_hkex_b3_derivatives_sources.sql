-- ============================================================================
-- Global "Leading Indicators" expansion for the Derivatives & Leverage
-- dashboard (src/app/dashboard/derivatives). See docs/DERIVATIVES_ENGINE.md.
--
-- hkex_derivatives — HKEX (Hong Kong) Daily Trading Activity & Open
--   Positions Summary (DTOP): real Gross OI for HSI/HHI/MHI index futures
--   and a whole-market equity/index options put/call OI ratio. Tier 1
--   official exchange/clearing-house data.
-- b3_derivatives — B3 (Brazil) daily COTAHIST file: real equity-options
--   put/call VOLUME ratio and whole cash-market turnover. Tier 1 official
--   exchange data (note: no open-interest field in this file — see
--   b3Derivatives.ts's doc comment for exactly what this is/isn't).
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('hkex_derivatives', 'HKEX Daily Trading Activity & Open Positions Summary', 'Hong Kong Exchanges and Clearing', 'https://www.hkex.com.hk', 1, 'derivatives', 'active'),
  ('b3_derivatives', 'B3 COTAHIST Daily File', 'B3 S.A. - Brasil, Bolsa, Balcão', 'https://www.b3.com.br', 1, 'derivatives', 'active')
on conflict (key) do nothing;
