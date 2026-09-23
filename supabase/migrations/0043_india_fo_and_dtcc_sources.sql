-- ============================================================================
-- Phase 2 additions to the Derivatives & Leverage dashboard
-- (src/app/dashboard/derivatives). See docs/DERIVATIVES_ENGINE.md.
--
-- nse_fo_bhavcopy — NSE India daily Futures & Options bhavcopy (UDiFF
--   format), Tier 1 official exchange. Corrects an earlier, wrong Phase 1
--   disclosure that no free India exchange-data connector existed.
-- dtcc_swap_data — DTCC public swap-transaction dissemination data,
--   published because CFTC Part 43 / SEC Reg SBSR require public
--   dissemination of most OTC swap trades (Dodd-Frank). Tier 1 official
--   regulatory data, not the full (paid/reporting-party-only) DTCC GTR.
-- ============================================================================

insert into sources (key, name, institution, url, tier, category, status) values
  ('nse_fo_bhavcopy', 'NSE India F&O Bhavcopy', 'National Stock Exchange of India', 'https://www.nseindia.com', 1, 'derivatives', 'active'),
  ('dtcc_swap_data', 'DTCC Swap Data Repository — Public Dissemination', 'Depository Trust & Clearing Corporation', 'https://pddata.dtcc.com', 1, 'derivatives', 'active')
on conflict (key) do nothing;
