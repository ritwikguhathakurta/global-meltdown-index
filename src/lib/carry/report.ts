/**
 * Funding Decision Report + audit snapshot + RFQ sheet. Every number in the report comes from the same
 * deterministic run that the screen shows; the JSON export contains everything needed to reproduce it.
 */
import type { CarryInputs, Ccy } from "./types";
import type { Analysis, RouteResult } from "./analyze";
import type { Reverse } from "./reverse";
import { RULE_PACKS, activeRules } from "./regulatory";
import { MODEL_VERSION } from "./defaults";
import { BP, CRORE, fmtBp, fmtPct, isNum } from "./units";
import { benchmarkName } from "./currencies";

const esc = (s: string | number | null | undefined) => {
  const v = s === null || s === undefined ? "" : String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export function radarRows(a: Analysis, inp: CarryInputs) {
  return a.routes.map((r) => ({
    route: r.label,
    status: r.status,
    tags: r.tags.join(" | "),
    tenorYears: inp.deal.tenorYears,
    fcyRate: r.fcyRate,
    hedgeCost: r.explain?.hedgeCost ?? null,
    effectiveMid: r.mid?.effective ?? null,
    effectiveExecutable: r.exec?.effective ?? null,
    slippage: r.slippage,
    inrAlternative: r.exec?.inrAlt ?? a.inrAltIrr,
    advantageExecutable: r.exec?.arbitrage ?? null,
    headroom: r.exec?.headroom ?? null,
    annualSavingInr: r.exec?.annualSaving ?? null,
    maxLenderSpread: r.maxSpread,
    maxHedgeCost: r.maxHedgeCost,
    liquidity: r.liquidityScore,
    regulatory: r.regulatory,
    confidence: r.confidence.overall,
    execution: r.quality.execLabel,
    missing: r.missing.join("; "),
  }));
}

export function toCsv(a: Analysis, inp: CarryInputs): string {
  const rows = radarRows(a, inp);
  if (!rows.length) return "";
  const head = Object.keys(rows[0]);
  return [head.join(","), ...rows.map((r) => head.map((h) => esc((r as Record<string, string | number | null>)[h])).join(","))].join("\n");
}

export function ledgerCsv(r: RouteResult): string {
  const ev = r.evalExec;
  if (!ev) return "";
  const head = ["ledger", "date", "t_years", "currency", "instrument", "description", "borrower_inflow", "borrower_outflow", "net_cash_flow", "kind", "tag", "modelled"];
  const lines = ev.entries.map((e) => [e.ledger, e.date, e.t.toFixed(4), e.ccy, e.instrument, e.desc, e.amount > 0 ? e.amount.toFixed(6) : "", e.amount < 0 ? (-e.amount).toFixed(6) : "", e.amount.toFixed(6), e.kind, e.tag ?? "", e.modelled ? "yes" : ""].map(esc).join(","));
  return [head.join(","), ...lines].join("\n");
}

export function toJson(inp: CarryInputs, a: Analysis, selected: RouteResult | null, reverse: Reverse | null): string {
  const packs = RULE_PACKS.map((p) => ({ folder: p.folder, label: p.label, rules: p.rules.map((r) => ({ rule_id: r.rule_id, rule_version: r.rule_version, effective_from: r.effective_from, effective_to: r.effective_to, provenance: r.provenance, source_name: r.source_name, source_url: r.source_url })) }));
  const audit = {
    timestamp: a.asOf,
    model_version: MODEL_VERSION,
    mode: a.modeLabel,
    regulatory_versions: activeRules(inp.reg.drawdownDate).map((r) => ({ rule_id: r.rule_id, rule_version: r.rule_version, provenance: inp.reg.userConfirmedRules.includes(r.rule_id) ? "USER_PROVIDED" : r.provenance })),
    rule_packs: packs,
    market_snapshot_and_user_inputs: inp,
    calculation_parameters: { irr: "annual-effective IRR of borrower cash flows", time_axis: "t = k / payment frequency", sign_convention: "borrower: + received, - paid", attribution: "PV-share of the effective rate (exact)", spread_passthrough: "1:1 at rate level" },
    result_summary: radarRows(a, inp),
    selected_route: selected ? { label: selected.label, status: selected.status, gates: selected.gates, validators: selected.validators, confidence: selected.confidence, explain: selected.explain, ledger: selected.evalExec?.entries ?? [] } : null,
    reverse,
  };
  return JSON.stringify(audit, null, 2);
}

const pct = (x: number | null | undefined, dp = 2) => fmtPct(x, dp);
const bp = (x: number | null | undefined, dp = 0) => fmtBp(x, dp);

export function toMarkdown(inp: CarryInputs, a: Analysis, selected: RouteResult | null, reverse: Reverse | null): string {
  const L: string[] = [];
  const cr = (inp.deal.requirementInr / CRORE).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  L.push(`# Funding Decision Report`, ``, `*${a.modeLabel} · generated ${a.asOf} · model ${MODEL_VERSION} · ANALYSIS ONLY — nothing in this report has been executed*`, ``);
  L.push(`## 1. Executive summary`);
  if (selected?.exec) {
    L.push(`Recommended structure: **${selected.label}** — status **${selected.status}** (${selected.quality.execLabel}). Effective INR cost **${pct(selected.exec.effective)}** vs INR alternative **${pct(selected.exec.inrAlt)}** → advantage **${bp(selected.exec.arbitrage)}** (headroom ${bp(selected.exec.headroom)} over the ${bp(inp.deal.minSaving)} minimum), annual saving **₹${(selected.exec.annualSaving / CRORE).toFixed(2)} Cr**. Confidence ${selected.confidence.overall}.`);
    for (const t of selected.tags) L.push(`- ⚠ ${t}`);
    for (const r of selected.reasons) L.push(`- ${r}`);
  } else L.push(`No complete route yet — enter the missing quotes.`);
  L.push(``, `## 2. Funding requirement`, `₹${cr} Cr · ${inp.deal.tenorYears}Y · ${inp.deal.amortisation}${inp.deal.amortisation === "equal" ? ` (grace ${inp.deal.graceYears}y)` : ""} · ${inp.deal.paymentFreq}x p.a. · ${inp.deal.dayCount} · hedge ratio ${(inp.deal.hedgeRatio * 100).toFixed(0)}% · INR comparator ${inp.inrAlt.label}`);
  L.push(``, `## 3. Market snapshot (user / dealer inputs are tagged; nothing is fabricated)`);
  L.push(`| Pair | Bid | Ask | Source | Quality | As of |`, `|---|---|---|---|---|---|`);
  for (const s of inp.spots.filter((x) => isNum(x.bid) || isNum(x.ask))) L.push(`| ${s.base}/${s.quote} (${s.quote} per ${s.base}) | ${s.bid ?? "—"} | ${s.ask ?? "—"} | ${s.meta.source} | ${s.meta.quality} | ${s.meta.asOf ?? "—"} |`);
  L.push(``, `## 4. Currency comparison`);
  L.push(`| Route | Status | FCY rate | Hedge | Effective (exec) | Advantage | Headroom | Max spread | Regulatory | Confidence |`, `|---|---|---|---|---|---|---|---|---|---|`);
  for (const r of a.routes.filter((x) => x.exec)) L.push(`| ${r.label} | ${r.status} | ${pct(r.fcyRate)} | ${pct(r.explain?.hedgeCost)} | ${pct(r.exec?.effective)} | ${bp(r.exec?.arbitrage)} | ${bp(r.exec?.headroom)} | ${r.maxSpread === null ? "—" : `${benchmarkName(r.start)} + ${(((r.maxSpread as number)) / BP).toFixed(0)} bp`} | ${r.regulatory} | ${r.confidence.overall} |`);
  L.push(``, `## 5. Effective INR costs (mid vs executable)`);
  for (const r of a.routes.filter((x) => x.exec && x.mid)) L.push(`- ${r.label}: mid ${pct(r.mid?.effective)} · executable ${pct(r.exec?.effective)} · slippage ${bp(r.slippage, 1)}`);
  L.push(``, `## 6. Hedge economics`);
  if (selected?.explain) {
    const e = selected.explain;
    L.push(`Why this structure: FCY funding ${pct(e.fcyFundingCost)} · hedge ${pct(e.hedgeCost)} · basis ${e.basis === null ? "n/a (enter INR term swap rate)" : bp(e.basis)} · fees ${pct(e.fees)} · tax ${pct(e.tax)} · RBI benefit ${e.rbiBenefit === null ? "n/a" : bp(e.rbiBenefit)} → effective ${pct(e.effective)}; INR alternative ${pct(e.inrAlt)}; arbitrage ${bp(e.arbitrage)}; headroom ${bp(e.headroom)}.`);
    for (const l of e.lines) L.push(`- ${l.key}: ${pct(l.cost, 3)}`);
  }
  L.push(``, `## 7. Reverse-rate thresholds`);
  if (reverse?.ok) {
    if (reverse.maxSpread) L.push(`- Maximum lender spread: ${benchmarkName(selected?.start ?? "")} + ${(reverse.maxSpread.max / BP).toFixed(1)} bp (all-in FCY ${pct(reverse.maxSpread.benchmarkPlusSpread)})`);
    if (reverse.maxHedgeCost) L.push(`- Maximum total hedge cost: ${pct(reverse.maxHedgeCost.max)} (today ${pct(reverse.maxHedgeCost.current)}; tolerate ${bp(reverse.maxHedgeCost.headroom)} more)`);
    for (const e of reverse.edges) L.push(`- Maximum ${e.label} quote: ${pct(e.max)} (today ${pct(e.current)})`);
    if (reverse.breakEvenInrZero !== null) L.push(`- Arbitrage disappears if the INR alternative falls to ${pct(reverse.breakEvenInrZero)}`);
    if (reverse.breakEvenTenor !== null) L.push(`- Break-even tenor (today's quotes held constant): ${reverse.breakEvenTenor.toFixed(1)}y`);
  } else L.push(`Not available for the selected route.`);
  L.push(``, `## 8. Stress tests`, `See the Stress tab; every stress re-runs the full cash-flow model.`);
  L.push(``, `## 9. Regulatory eligibility`);
  L.push(`ECB framework: **${a.ecb.status}**`);
  for (const c of a.ecb.checks) L.push(`- [${c.outcome}] ${c.label}: ${c.detail}`);
  if (a.swap) {
    L.push(`RBI concessional swap: **${a.swap.status}**`);
    for (const c of a.swap.checks) L.push(`- [${c.outcome}] ${c.label}: ${c.detail}`);
  }
  L.push(`Rule provenance is DERIVED from secondary summaries unless you confirmed otherwise — this is not legal advice; confirm with your AD Category-I bank.`);
  L.push(``, `## 10. Risks`);
  if (selected?.fxRisk) L.push(`- Residual FX exposure ₹${(selected.fxRisk.exposureInr / CRORE).toFixed(2)} Cr; FX VaR ${selected.fxRisk.var === null ? "n/a (enter FX vol)" : `₹${(selected.fxRisk.var / CRORE).toFixed(2)} Cr`}`);
  if (selected) for (const w of selected.warnings) L.push(`- ${w}`);
  L.push(``, `## 11. Sensitivities`, `See the Sensitivity tab (spread × hedge cost, INR rate, basis, tenor).`);
  L.push(``, `## 12. Audit trail`, `Timestamp ${a.asOf}; model ${MODEL_VERSION}; regulatory versions: ${activeRules(inp.reg.drawdownDate).map((r) => `${r.rule_id}@${r.rule_version}`).join(", ") || "none"}. The JSON export contains all inputs and the full ledger so the result can be reproduced exactly.`);
  return L.join("\n");
}

/** What to ask each bank for — so a layman can collect exactly the quotes the model needs. */
export function rfqText(inp: CarryInputs, ccys: Ccy[]): string {
  const cr = (inp.deal.requirementInr / CRORE).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const t = inp.deal.tenorYears;
  const L = [
    `REQUEST FOR INDICATIVE / FIRM QUOTES — ${new Date(inp.nowIso).toDateString()}`,
    `Requirement: INR ${cr} crore equivalent · tenor ${t} years · ${inp.deal.amortisation}${inp.deal.amortisation === "equal" ? ` with ${inp.deal.graceYears}y grace` : ""} · payments ${inp.deal.paymentFreq}x per year · ${inp.deal.dayCount}`,
    `Please quote TWO-WAY (bid / offer) where indicated, with the time of the quote and whether it is FIRM or INDICATIVE. All quotes are for comparison only.`,
    ``,
    `A. Spot (both sides, at the same time as the hedge quotes):`,
    ...ccys.map((c) => `   - ${c}/INR (INR per ${c}) bid / ask${c === "USD" ? "" : `; and ${c}/USD or USD/${c} cross bid / ask`}`),
    ``,
    `B. Lender pricing per currency (${t}Y): benchmark (${ccys.map(benchmarkName).join(" / ")}) term swap rate, credit spread (bp over benchmark), upfront/arrangement fee (%), agency/commitment fee (bp p.a.), floating or fixed, day count, any call/put, make-whole, prepayment and break costs, withholding-tax gross-up clause.`,
    ``,
    `C. Cross-currency swap quotes (${t}Y, principal exchanged at initial and final spot, floating leg received flat, spread passed through):`,
    ...ccys.map((c) => `   - ${c} floating (flat) received  ↔  INR FIXED rate paid: bid / offer  (also: dealer initial-exchange margin in bp, and any collateral/CSA charge in bp p.a.)`),
    `   - For synthetic-USD routes: ${ccys.filter((c) => c !== "USD").join(", ")} floating (flat) received ↔ USD FIXED rate paid: bid / offer`,
    ``,
    `D. Alternative hedge (if you prefer forwards): USD/INR and other FCY/INR forward premium (% p.a.) at each annual date, bid / offer.`,
    ``,
    `E. Documentation and costs: ISDA/CSA legal cost, legal opinion, registration, agency/custody, any stamp duty.`,
    ``,
    `F. Regulatory: confirm the borrower's ECB eligibility, LRN (Form ECB 1) timeline before drawdown, and whether the concessional RBI swap facility applies to this borrower (it is limited to eligible PSU ECBs / AD bank OFCBs).`,
  ];
  return L.join("\n");
}
