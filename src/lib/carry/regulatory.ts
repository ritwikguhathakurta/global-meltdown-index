/**
 * Date-versioned regulatory rule packs (RBI). Rules are DATA, never logic: each carries its source,
 * effective dates and provenance. The engine distinguishes
 *   CONFIRMED_PRIMARY  - read from the primary RBI/Gazette text
 *   DERIVED            - taken from a secondary summary (law firm / advisory note); NOT confirmed law
 *   USER_PROVIDED      - verified by the user against the primary text in this session
 *   NEEDS_CONFIRMATION - reported but contradictory / incomplete
 * An inferred interpretation is never presented as confirmed law: "ELIGIBLE" requires every rule that
 * the checks relied on to be CONFIRMED_PRIMARY or USER_PROVIDED; otherwise the best possible answer is
 * POTENTIALLY_ELIGIBLE.
 *
 * Rule text below was retrieved on 2026-09-21 from the secondary sources listed on each rule; the RBI
 * Master Direction page confirms that the old ECB Parts 1-12 were deleted by A.P. (DIR Series) Circular
 * No. 22 of 16 Feb 2026. No primary PDF was parsed, hence provenance = DERIVED.
 */
import type { CarryInputs } from "./types";
import type { Period } from "./schedule";
import { averageMaturity } from "./schedule";
import { midRate } from "./fx";
import { buildFxTable } from "./fx";
import { INR, USD } from "./currencies";
import { isNum } from "./units";

export type Provenance = "CONFIRMED_PRIMARY" | "DERIVED" | "USER_PROVIDED" | "NEEDS_CONFIRMATION";
export type RegStatus = "ELIGIBLE" | "POTENTIALLY_ELIGIBLE" | "NOT_ELIGIBLE" | "INSUFFICIENT_INFORMATION";

export interface RegRule {
  rule_id: string;
  title: string;
  effective_from: string;
  effective_to: string | null;
  source_name: string;
  source_url: string;
  document_date: string;
  rule_version: string;
  applicability: string;
  borrower_type: string;
  currency: string;
  minimum_maturity: string | null;
  maximum_amount: string | null;
  end_use: string;
  hedging_requirement: string;
  swap_eligibility: string;
  reporting_requirement: string;
  status: "IN_FORCE" | "SUPERSEDED" | "FUTURE";
  provenance: Provenance;
  secondary_sources: { name: string; url: string }[];
  notes: string;
}

const RBI_MD_ECB = "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=11510";
const EY_ECB = "https://www.ey.com/en_in/technical/alerts-hub/2026/03/rbi-has-revised-the-borrowing-and-lending-framework";
const NRF_ECB = "https://www.nortonrosefulbright.com/en-in/knowledge/publications/fd942bb1/external-commercial-borrowings-in-india-key-requirements-under-the-foreign-exchange-management";
const EY_SWAP = "https://www.ey.com/en_in/technical/alerts-hub/2026/06/rbi-introduces-us-dollar-rupee-forex-swap-facility-for-external-commercial-borrowings";

const ecbBase = {
  effective_from: "2026-02-16",
  effective_to: null,
  source_name: "FEMA (Borrowing and Lending) (First Amendment) Regulations, 2026; A.P. (DIR Series) Circular No. 22 dated 16 Feb 2026",
  source_url: RBI_MD_ECB,
  document_date: "2026-02-16",
  rule_version: "2026-02-16",
  status: "IN_FORCE" as const,
  provenance: "DERIVED" as Provenance,
  secondary_sources: [
    { name: "EY India alert (Mar 2026)", url: EY_ECB },
    { name: "Norton Rose Fulbright India", url: NRF_ECB },
  ],
  currency: "FCY or INR",
};

export const RULE_PACKS: { folder: string; label: string; rules: RegRule[] }[] = [
  {
    folder: "2026-02-16",
    label: "RBI ECB framework — First Amendment Regulations 2026 (replaces old Master Direction Parts 1-12)",
    rules: [
      { ...ecbBase, rule_id: "ECB-BORROWER", title: "Eligible borrowers", applicability: "ECB", borrower_type: "Any resident person other than an individual, incorporated/established/registered under a Central or State Act, incl. LLPs; trusts are not eligible", minimum_maturity: null, maximum_amount: null, end_use: "-", hedging_requirement: "-", swap_eligibility: "-", reporting_requirement: "-", notes: "Entities under CIRP/restructuring only if the approved plan permits." },
      { ...ecbBase, rule_id: "ECB-LENDER", title: "Recognised lenders", applicability: "ECB", borrower_type: "-", minimum_maturity: null, maximum_amount: null, end_use: "-", hedging_requirement: "-", swap_eligibility: "-", reporting_requirement: "-", notes: "Any person resident outside India (incl. individuals), foreign branches of RBI-regulated entities, IFSC institutions. Summaries differ on FATF/IOSCO wording — confirm with AD bank." },
      { ...ecbBase, rule_id: "ECB-MAMP", title: "Minimum average maturity period (MAMP)", applicability: "ECB", borrower_type: "All (manufacturing exception)", minimum_maturity: "3 years standard; 1-3 years for manufacturing borrowers up to USD 150m", maximum_amount: null, end_use: "-", hedging_requirement: "-", swap_eligibility: "-", reporting_requirement: "-", notes: "Call/put cannot be exercised before MAMP. Average maturity of an amortising loan is shorter than its final maturity." },
      { ...ecbBase, rule_id: "ECB-COST", title: "Cost of borrowing", applicability: "ECB", borrower_type: "-", minimum_maturity: null, maximum_amount: null, end_use: "-", hedging_requirement: "-", swap_eligibility: "-", reporting_requirement: "-", provenance: "NEEDS_CONFIRMATION", notes: "Summaries say the hard all-in-cost ceiling was removed: pricing 'as per prevailing market conditions', arm's length for related parties. One summary says ECB under 3 years MAMP follow trade-credit ceilings and that swap-converted fixed-rate loans cannot exceed the ceiling — CONFIRM WITH AD BANK. Cost includes interest, fees, expenses, charges, guarantee fees." },
      { ...ecbBase, rule_id: "ECB-LIMIT", title: "Borrowing limit", applicability: "ECB", borrower_type: "Non-financial-sector borrowers", minimum_maturity: null, maximum_amount: "Higher of USD 1 billion outstanding or 300% of net worth (standalone)", end_use: "-", hedging_requirement: "-", swap_eligibility: "-", reporting_requirement: "-", notes: "Not applicable to borrowers regulated by financial-sector regulators." },
      { ...ecbBase, rule_id: "ECB-ENDUSE", title: "End-use restrictions", applicability: "ECB", borrower_type: "-", minimum_maturity: null, maximum_amount: null, end_use: "Prohibited: chit funds, Nidhi companies, real-estate business (carve-outs), agriculture/plantations (carve-outs), TDR trading, securities trading (except strategic M&A), repayment of restricted-use INR loans / NPAs, on-lending for prohibited activities", hedging_requirement: "-", swap_eligibility: "-", reporting_requirement: "-", notes: "Carve-outs exist; the list here is a screening aid, not legal advice." },
      { ...ecbBase, rule_id: "ECB-HEDGE", title: "Hedging requirement", applicability: "ECB", borrower_type: "-", minimum_maturity: null, maximum_amount: null, end_use: "-", hedging_requirement: "No mandatory hedging reported in the summaries (the earlier 70% infrastructure hedge was removed). Board/treasury policy and lender covenants may still require hedging.", swap_eligibility: "-", reporting_requirement: "-", notes: "Do not treat 'no mandatory hedge' as 'no exposure'." },
      { ...ecbBase, rule_id: "ECB-REPORT", title: "Registration & reporting", applicability: "ECB", borrower_type: "-", minimum_maturity: null, maximum_amount: null, end_use: "-", hedging_requirement: "-", swap_eligibility: "-", reporting_requirement: "Loan Registration Number (LRN) via Form ECB 1 through an AD Category-I bank BEFORE drawdown; Form ECB 2 event-based within 7 days of month-end; untraceable-borrower reporting after 4 missed quarters", notes: "Loan agreements need not be filed with RBI." },
      { ...ecbBase, rule_id: "ECB-ROUTE", title: "Route", applicability: "ECB", borrower_type: "-", minimum_maturity: null, maximum_amount: null, end_use: "-", hedging_requirement: "-", swap_eligibility: "-", reporting_requirement: "-", notes: "Automatic route if all parameters are met; otherwise approval route via Form ECB 1 through the AD bank." },
    ],
  },
  {
    folder: "2026-06-08",
    label: "RBI USD-INR forex swap facility for eligible ECBs / OFCBs (circular of 8 June 2026)",
    rules: [
      {
        rule_id: "RBI-SWAP-2026",
        title: "USD/INR concessional forex swap facility",
        effective_from: "2026-06-08",
        effective_to: "2027-01-15",
        source_name: "RBI Circular No. RBI/2026-27/100 FMOD.MAOG.No.S-57/01.06.016/2026-27 dated 8 June 2026",
        source_url: "",
        document_date: "2026-06-08",
        rule_version: "2026-06-08",
        applicability: "ECB drawn by eligible PSUs (avg maturity >= 3y, drawn 8 Jun 2026 - 31 Dec 2026) and OFCB raised by AD Category-I banks (min maturity 3y). Facility open until 15 Jan 2027.",
        borrower_type: "PSU (ECB) / AD Category-I bank (OFCB) ONLY — not private corporates",
        currency: "Underlying borrowing in any currency; the swap itself is USD only",
        minimum_maturity: "3 years",
        maximum_amount: "Weekly cap = ECB/OFCB inflows of preceding week(s); USD 1m multiples",
        end_use: "-",
        hedging_requirement: "-",
        swap_eligibility: "Banks sell USD to RBI at the FBIL reference rate (spot) and repurchase at maturity at a fixed 1.5% p.a. compounded semi-annually; max swap tenor = repayment schedule, capped at 5 years; Mumbai working days",
        reporting_requirement: "Bank declaration that the facility hedges eligible ECB/OFCB flows; no ISDA required",
        status: "IN_FORCE",
        provenance: "DERIVED",
        secondary_sources: [{ name: "EY India alert (Jun 2026)", url: EY_SWAP }],
        notes: "The summary does NOT say whether the borrower or the AD bank bears the 1.5% swap cost, nor whether interest flows are covered (the facility swaps principal inflows). The model treats it as principal-only and lets you hedge interest at market quotes. Obtain the circular text and confirm with your AD bank.",
      },
    ],
  },
  { folder: "future", label: "Placeholder for rules announced but not yet effective", rules: [] },
];

export function activeRules(dateIso: string): RegRule[] {
  const out: RegRule[] = [];
  for (const p of RULE_PACKS)
    for (const r of p.rules) {
      if (r.effective_from <= dateIso && (r.effective_to === null || dateIso <= r.effective_to)) out.push(r);
    }
  return out;
}

export interface CheckResult {
  rule_id: string;
  label: string;
  outcome: "PASS" | "FAIL" | "UNKNOWN" | "INFO";
  detail: string;
}

export interface RegAssessment {
  status: RegStatus;
  rulesUsed: { rule_id: string; provenance: Provenance; rule_version: string }[];
  checks: CheckResult[];
  route: "AUTOMATIC" | "APPROVAL" | "UNKNOWN";
}

const PROHIBITED_END_USES = [
  "Chit funds / Nidhi company",
  "Real-estate business (speculative)",
  "Agriculture / plantation (non-exempt)",
  "TDR trading",
  "Securities trading (non-strategic)",
  "Repayment of restricted-use INR loans / NPAs",
  "On-lending for prohibited activities",
];
export const END_USE_OPTIONS = ["General corporate / capex (permitted)", "Infrastructure (permitted)", "Refinancing (permitted)", "Strategic M&A (permitted)", ...PROHIBITED_END_USES];

function effectiveProvenance(r: RegRule, confirmed: string[]): Provenance {
  return confirmed.includes(r.rule_id) ? "USER_PROVIDED" : r.provenance;
}

function finalStatus(checks: CheckResult[], used: { provenance: Provenance }[]): RegStatus {
  if (checks.some((c) => c.outcome === "FAIL")) return "NOT_ELIGIBLE";
  if (checks.some((c) => c.outcome === "UNKNOWN")) return "INSUFFICIENT_INFORMATION";
  const allConfirmed = used.length > 0 && used.every((u) => u.provenance === "CONFIRMED_PRIMARY" || u.provenance === "USER_PROVIDED");
  return allConfirmed ? "ELIGIBLE" : "POTENTIALLY_ELIGIBLE";
}

function usdAmount(inp: CarryInputs): number | null {
  const fx = buildFxTable(inp.spots, "exec");
  const r = midRate(fx, USD, INR);
  return isNum(r) && r > 0 ? inp.deal.requirementInr / r : null;
}

/** ECB checks against the rule version in force on the drawdown date. */
export function assessEcb(inp: CarryInputs, sched: Period[]): RegAssessment {
  const date = inp.reg.drawdownDate;
  const rules = activeRules(date).filter((r) => r.rule_id.startsWith("ECB-"));
  const used = rules.map((r) => ({ rule_id: r.rule_id, provenance: effectiveProvenance(r, inp.reg.userConfirmedRules), rule_version: r.rule_version }));
  const checks: CheckResult[] = [];
  if (rules.length === 0) {
    checks.push({ rule_id: "-", label: "Rule version", outcome: "UNKNOWN", detail: `No ECB rule pack is in force on ${date}` });
    return { status: "INSUFFICIENT_INFORMATION", rulesUsed: used, checks, route: "UNKNOWN" };
  }
  const bt = inp.reg.borrowerType;
  checks.push(
    bt === "OTHER"
      ? { rule_id: "ECB-BORROWER", label: "Borrower eligibility", outcome: "UNKNOWN", detail: "Borrower type 'Other' — confirm the entity is a non-individual, non-trust resident person" }
      : { rule_id: "ECB-BORROWER", label: "Borrower eligibility", outcome: "PASS", detail: `${bt.replace(/_/g, " ").toLowerCase()} is a non-individual resident entity` }
  );
  const nr = inp.reg.lenderNonResident;
  checks.push({ rule_id: "ECB-LENDER", label: "Recognised lender", outcome: nr === null ? "UNKNOWN" : nr ? "PASS" : "FAIL", detail: nr === null ? "Confirm the lender is resident outside India (or an IFSC / foreign-branch lender)" : nr ? "Lender is non-resident" : "Lender is resident in India — not an ECB lender" });
  const wal = averageMaturity(sched);
  const usd = usdAmount(inp);
  if (wal >= 3) checks.push({ rule_id: "ECB-MAMP", label: "Minimum average maturity", outcome: "PASS", detail: `Average maturity ${wal.toFixed(2)}y >= 3y` });
  else if (inp.reg.manufacturing && usd !== null && usd <= 150e6 && wal >= 1) checks.push({ rule_id: "ECB-MAMP", label: "Minimum average maturity", outcome: "PASS", detail: `Average maturity ${wal.toFixed(2)}y within the manufacturing 1-3y exception (<= USD 150m)` });
  else checks.push({ rule_id: "ECB-MAMP", label: "Minimum average maturity", outcome: "FAIL", detail: `Average maturity ${wal.toFixed(2)}y is below 3y — lengthen the tenor / grace period or check the manufacturing exception` });
  if (bt === "NBFC_FI" || bt === "AD_BANK") checks.push({ rule_id: "ECB-LIMIT", label: "Borrowing limit", outcome: "INFO", detail: "Limit does not apply to borrowers regulated by financial-sector regulators" });
  else if (usd === null) checks.push({ rule_id: "ECB-LIMIT", label: "Borrowing limit", outcome: "UNKNOWN", detail: "Enter a USD/INR spot to compute the USD equivalent" });
  else if (usd <= 1e9) checks.push({ rule_id: "ECB-LIMIT", label: "Borrowing limit", outcome: "PASS", detail: `USD ${(usd / 1e6).toFixed(1)}m <= USD 1bn (this ECB alone; existing ECB outstanding must be added)` });
  else if (isNum(inp.reg.netWorthInr)) {
    const fx = buildFxTable(inp.spots, "exec");
    const r = midRate(fx, USD, INR) as number;
    const lim = Math.max(1e9, (3 * inp.reg.netWorthInr) / r);
    checks.push({ rule_id: "ECB-LIMIT", label: "Borrowing limit", outcome: usd <= lim ? "PASS" : "FAIL", detail: `USD ${(usd / 1e6).toFixed(0)}m vs limit USD ${(lim / 1e6).toFixed(0)}m (higher of USD 1bn / 300% of net worth), before existing ECB outstanding` });
  } else checks.push({ rule_id: "ECB-LIMIT", label: "Borrowing limit", outcome: "UNKNOWN", detail: "Above USD 1bn: enter net worth to test the 300% limit" });
  const prohibited = PROHIBITED_END_USES.includes(inp.reg.endUse);
  checks.push({ rule_id: "ECB-ENDUSE", label: "End-use", outcome: prohibited ? "FAIL" : "PASS", detail: prohibited ? `"${inp.reg.endUse}" is on the prohibited list (carve-outs may exist — take legal advice)` : `"${inp.reg.endUse}" is not on the prohibited list` });
  checks.push({ rule_id: "ECB-COST", label: "All-in cost", outcome: "INFO", detail: inp.reg.relatedParty ? "Related-party lender: pricing must be arm's length" : "Reported as market-priced (no hard ceiling) — confirm any swap-related cap with your AD bank" });
  checks.push({ rule_id: "ECB-HEDGE", label: "Hedging", outcome: "INFO", detail: "No mandatory hedge reported; unhedged share is shown as residual FX exposure" });
  checks.push({ rule_id: "ECB-REPORT", label: "Registration & reporting", outcome: "INFO", detail: "Obtain LRN (Form ECB 1) via your AD Category-I bank BEFORE drawdown; file Form ECB 2 event-based" });
  const failing = checks.some((c) => c.outcome === "FAIL");
  const unknown = checks.some((c) => c.outcome === "UNKNOWN");
  return { status: finalStatus(checks, used), rulesUsed: used, checks, route: failing ? "APPROVAL" : unknown ? "UNKNOWN" : "AUTOMATIC" };
}

/** RBI concessional swap: never assumed — only PSU ECBs and AD-bank OFCBs qualify under the 8 Jun 2026 circular. */
export function assessRbiSwap(inp: CarryInputs, sched: Period[]): RegAssessment {
  const date = inp.reg.drawdownDate;
  const rules = activeRules(date).filter((r) => r.rule_id === "RBI-SWAP-2026");
  const used = rules.map((r) => ({ rule_id: r.rule_id, provenance: effectiveProvenance(r, inp.reg.userConfirmedRules), rule_version: r.rule_version }));
  const checks: CheckResult[] = [];
  if (rules.length === 0) {
    checks.push({ rule_id: "RBI-SWAP-2026", label: "Facility in force", outcome: "FAIL", detail: `The facility is not in force on ${date} (window 8 Jun 2026 - 15 Jan 2027)` });
    return { status: "NOT_ELIGIBLE", rulesUsed: used, checks, route: "UNKNOWN" };
  }
  const bt = inp.reg.borrowerType;
  if (bt === "PSU" || bt === "AD_BANK") checks.push({ rule_id: "RBI-SWAP-2026", label: "Borrower class", outcome: "PASS", detail: bt === "PSU" ? "Eligible PSU raising an ECB" : "AD Category-I bank raising an OFCB" });
  else if (bt === "OTHER") checks.push({ rule_id: "RBI-SWAP-2026", label: "Borrower class", outcome: "UNKNOWN", detail: "Select PSU or AD bank to test eligibility" });
  else checks.push({ rule_id: "RBI-SWAP-2026", label: "Borrower class", outcome: "FAIL", detail: "Only eligible PSUs (ECB) and AD Category-I banks (OFCB) can use this facility — a private corporate cannot" });
  const wal = averageMaturity(sched);
  checks.push({ rule_id: "RBI-SWAP-2026", label: "Maturity >= 3 years", outcome: wal >= 3 ? "PASS" : "FAIL", detail: `Average maturity ${wal.toFixed(2)}y, tenor ${inp.deal.tenorYears}y` });
  checks.push({ rule_id: "RBI-SWAP-2026", label: "Swap tenor <= 5 years", outcome: inp.deal.tenorYears <= inp.rbi.maxTenorYears ? "PASS" : "FAIL", detail: `Swap tenor is coterminous with the repayment schedule, capped at ${inp.rbi.maxTenorYears}y; deal tenor ${inp.deal.tenorYears}y` });
  const inWin = date >= inp.rbi.drawdownFrom && date <= inp.rbi.drawdownTo;
  checks.push({ rule_id: "RBI-SWAP-2026", label: "Drawdown window", outcome: inWin ? "PASS" : "FAIL", detail: `Drawdown ${date}; eligible window ${inp.rbi.drawdownFrom} to ${inp.rbi.drawdownTo}` });
  checks.push({ rule_id: "RBI-SWAP-2026", label: "Facility open", outcome: inp.nowIso.slice(0, 10) <= inp.rbi.windowOpenUntil ? "PASS" : "FAIL", detail: `Facility open until ${inp.rbi.windowOpenUntil}` });
  checks.push({ rule_id: "RBI-SWAP-2026", label: "USD only", outcome: "INFO", detail: "The swap is USD-only: non-USD borrowings must first be converted to USD (that is what the FCY → USD → INR route models)" });
  checks.push({ rule_id: "RBI-SWAP-2026", label: "Who bears the 1.5%?", outcome: "INFO", detail: "The reported summary does not say whether the borrower or the AD bank bears the swap cost — confirm with your AD bank before relying on the benefit" });
  return { status: finalStatus(checks, used), rulesUsed: used, checks, route: "UNKNOWN" };
}
