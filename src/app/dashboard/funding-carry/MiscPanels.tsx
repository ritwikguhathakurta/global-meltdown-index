"use client";

import { useMemo, useState } from "react";
import type { ResultProps } from "./ResultPanels";
import { selectedRoute } from "./ResultPanels";
import { Btn, Card, Field, NumInput, Note, Select, Table, Tag, Td, Th, download } from "./ui";
import { pct } from "./fmt";
import { exampleInputs, MODEL_VERSION } from "@/lib/carry/defaults";
import { CURRENCIES, FUNDING_CCYS } from "@/lib/carry/currencies";
import { END_USE_OPTIONS, RULE_PACKS, activeRules } from "@/lib/carry/regulatory";
import { ledgerCsv, radarRows, rfqText, toCsv, toJson, toMarkdown } from "@/lib/carry/report";
import { applyCooldown, deriveSignals, takeSnapshot } from "@/lib/carry/signals";
import { detectRegime, spotConflicts } from "@/lib/carry/marketData";
import { reverseFor } from "@/lib/carry/reverse";
import { BP, isNum } from "@/lib/carry/units";
import { clearState, freshState } from "./state";
import type { BorrowerType } from "@/lib/carry/types";

const BORROWERS: { value: BorrowerType; label: string }[] = [
  { value: "PRIVATE_CORPORATE", label: "Private corporate" },
  { value: "PSU", label: "Public sector undertaking (PSU)" },
  { value: "AD_BANK", label: "AD Category-I bank" },
  { value: "LLP", label: "LLP" },
  { value: "NBFC_FI", label: "NBFC / financial-sector entity" },
  { value: "OTHER", label: "Other / not sure" },
];

/* -------------------------------- regulatory -------------------------------- */

export function RegulatoryPanel(p: ResultProps) {
  const { st, up, a, eff } = p;
  const r = eff.reg;
  const inForce = activeRules(r.drawdownDate);
  const assess = (title: string, x: NonNullable<typeof a.swap>) => {
    const c = x.status === "ELIGIBLE" ? "#34c085" : x.status === "POTENTIALLY_ELIGIBLE" ? "#e0b93d" : x.status === "NOT_ELIGIBLE" ? "#e05a4d" : "#8b96a8";
    return (
      <Card title={title} right={<span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ color: c, border: `1px solid ${c}66`, background: `${c}22` }}>{x.status.replace(/_/g, " ")}</span>}>
        <Table>
          <thead><tr><Th>Check</Th><Th>Result</Th><Th>Detail</Th></tr></thead>
          <tbody>
            {x.checks.map((k, i) => (
              <tr key={i} className="border-t border-border/40">
                <Td>{k.label} <span className="text-[9px] text-text-dim">{k.rule_id}</span></Td>
                <Td><span style={{ color: k.outcome === "PASS" ? "#34c085" : k.outcome === "FAIL" ? "#e05a4d" : k.outcome === "UNKNOWN" ? "#e0b93d" : "#8b96a8" }}>{k.outcome === "PASS" ? "✓ PASS" : k.outcome === "FAIL" ? "✗ FAIL" : k.outcome === "UNKNOWN" ? "? UNKNOWN" : "i INFO"}</span></Td>
                <Td><span className="text-text-dim">{k.detail}</span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="mt-2 text-[11px] text-text-dim">Rule versions used: {x.rulesUsed.map((u) => `${u.rule_id}@${u.rule_version} (${u.provenance})`).join(", ") || "none"}. Route: {x.route}.</div>
      </Card>
    );
  };
  return (
    <>
      <Note tone="warn">
        <b>Not legal advice.</b> The rules below were read from law-firm / advisory summaries of the RBI documents (the RBI Master Direction page itself confirms the old ECB Parts 1-12 were deleted on 16 Feb 2026). Until you tick “verified against the primary RBI text” a rule stays <b>DERIVED</b> and the best possible answer is <b>POTENTIALLY ELIGIBLE</b> — the app never presents an inferred interpretation as confirmed law. Regulatory rules are date-versioned: the version in force on your drawdown date is used.
      </Note>

      <Card title="About the borrower and the loan">
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <Field label="Borrower type" hint="The RBI concessional swap only covers eligible PSUs (ECB) and AD Category-I banks (OFCB) — a private company does not qualify.">
            <Select value={r.borrowerType} width="w-64" onChange={(v) => up((s) => (s.inputs.reg.borrowerType = v))} options={BORROWERS} />
          </Field>
          <Field label="End-use of the funds">
            <Select value={r.endUse} width="w-72" onChange={(v) => up((s) => (s.inputs.reg.endUse = v))} options={END_USE_OPTIONS.map((x) => ({ value: x, label: x }))} />
          </Field>
          <Field label="Drawdown date" hint="Picks the rule versions in force.">
            <input type="date" className="rounded border border-border bg-bg px-2 py-1 text-xs text-text" value={r.drawdownDate} onChange={(e) => e.target.value && up((s) => (s.inputs.reg.drawdownDate = e.target.value))} />
          </Field>
          <Field label="Net worth (₹ Cr, optional)" hint="Needed only if the loan exceeds USD 1 bn.">
            <NumInput value={r.netWorthInr} unit="cr" width="w-28" min={0} onChange={(v) => up((s) => (s.inputs.reg.netWorthInr = v))} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-6 text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" checked={r.lenderNonResident === true} onChange={(e) => up((s) => (s.inputs.reg.lenderNonResident = e.target.checked))} /> The lender is resident outside India (or an IFSC / foreign-branch lender) <span className="text-[10px] text-text-dim">— assumed for an ECB; untick if not</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={r.manufacturing} onChange={(e) => up((s) => (s.inputs.reg.manufacturing = e.target.checked))} /> Manufacturing borrower</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={r.relatedParty} onChange={(e) => up((s) => (s.inputs.reg.relatedParty = e.target.checked))} /> Lender is a related party</label>
        </div>
      </Card>

      {assess("ECB framework checks", a.ecb)}

      <Card title="RBI concessional USD/INR swap facility (June 2026)" right={<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={st.inputs.rbi.apply} onChange={(e) => up((s) => (s.inputs.rbi.apply = e.target.checked))} /> Include RBI-swap routes in the comparison</label>}>
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <Field label="Swap rate (fixed, p.a.)" hint="Reported as 1.5% compounded semi-annually — confirm in the circular."><NumInput value={st.inputs.rbi.swapRate} unit="pct" suffix="%" onChange={(v) => v !== null && up((s) => (s.inputs.rbi.swapRate = v))} /></Field>
          <Field label="Compounding per year"><NumInput value={st.inputs.rbi.compoundingPerYear} width="w-14" min={1} max={12} onChange={(v) => v && up((s) => (s.inputs.rbi.compoundingPerYear = Math.round(v)))} /></Field>
          <Field label="Max swap tenor (years)"><NumInput value={st.inputs.rbi.maxTenorYears} width="w-14" onChange={(v) => v && up((s) => (s.inputs.rbi.maxTenorYears = v))} /></Field>
          <Field label="FBIL reference USD/INR (optional)" hint="If empty, the mid of your USD/INR quote is used."><NumInput value={st.inputs.rbi.fbilRef} width="w-24" onChange={(v) => up((s) => (s.inputs.rbi.fbilRef = v))} /></Field>
          <Field label="Eligible drawdown from"><input type="date" className="rounded border border-border bg-bg px-2 py-1 text-xs text-text" value={st.inputs.rbi.drawdownFrom} onChange={(e) => e.target.value && up((s) => (s.inputs.rbi.drawdownFrom = e.target.value))} /></Field>
          <Field label="Eligible drawdown to"><input type="date" className="rounded border border-border bg-bg px-2 py-1 text-xs text-text" value={st.inputs.rbi.drawdownTo} onChange={(e) => e.target.value && up((s) => (s.inputs.rbi.drawdownTo = e.target.value))} /></Field>
          <Field label="Facility open until"><input type="date" className="rounded border border-border bg-bg px-2 py-1 text-xs text-text" value={st.inputs.rbi.windowOpenUntil} onChange={(e) => e.target.value && up((s) => (s.inputs.rbi.windowOpenUntil = e.target.value))} /></Field>
        </div>
        <div className="mt-2 text-[11px] text-text-dim">Modelled as a <b>principal-only</b> swap: the bank sells USD to RBI at the FBIL reference rate and buys it back at maturity at a fixed rate compounded semi-annually. Interest is hedged at your market forward quote (add a USD → INR “FX forward” row in Step 2 · C) or left unhedged and flagged. Market arbitrage and regulatory arbitrage are different things — the RBI benefit is always shown separately.</div>
      </Card>
      {a.swap ? assess("RBI swap eligibility", a.swap) : <Note>Tick “Include RBI-swap routes” above to test eligibility and see the benefit versus market hedging.</Note>}

      <Card title="Rule library (date-versioned — never hard-coded)">
        {RULE_PACKS.map((pack) => (
          <div key={pack.folder} className="mb-4">
            <div className="mb-1 text-xs font-semibold">rbi_rules/{pack.folder}/ <span className="font-normal text-text-dim">— {pack.label}</span></div>
            {!pack.rules.length ? <div className="text-[11px] text-text-dim">No rules yet.</div> : pack.rules.map((rule) => {
              const inF = inForce.some((x) => x.rule_id === rule.rule_id);
              const confirmed = r.userConfirmedRules.includes(rule.rule_id);
              return (
                <details key={rule.rule_id} className="mb-1 rounded border border-border p-2 text-xs">
                  <summary className="cursor-pointer"><b>{rule.rule_id}</b> · {rule.title} <Tag tone={inF ? "good" : "info"}>{inF ? "in force on drawdown date" : "not in force on drawdown date"}</Tag> <Tag tone={confirmed ? "good" : "warn"}>{confirmed ? "USER_PROVIDED" : rule.provenance}</Tag></summary>
                  <div className="mt-2 grid gap-1 text-[11px] text-text-dim md:grid-cols-2">
                    <div>effective_from: <b className="text-text">{rule.effective_from}</b> · effective_to: <b className="text-text">{rule.effective_to ?? "open"}</b> · document_date: {rule.document_date} · rule_version: {rule.rule_version}</div>
                    <div>source: {rule.source_name}{rule.source_url ? <> · <a className="text-accent underline" href={rule.source_url} target="_blank" rel="noreferrer">primary page</a></> : " · primary URL not captured — obtain the circular text"}</div>
                    <div>applicability: {rule.applicability}</div><div>borrower_type: {rule.borrower_type}</div>
                    <div>currency: {rule.currency}</div><div>minimum_maturity: {rule.minimum_maturity ?? "—"}</div>
                    <div>maximum_amount: {rule.maximum_amount ?? "—"}</div><div>end_use: {rule.end_use}</div>
                    <div>hedging_requirement: {rule.hedging_requirement}</div><div>swap_eligibility: {rule.swap_eligibility}</div>
                    <div className="md:col-span-2">reporting_requirement: {rule.reporting_requirement}</div>
                    <div className="md:col-span-2">notes: {rule.notes}</div>
                    <div className="md:col-span-2">secondary sources: {rule.secondary_sources.map((s) => <a key={s.url} className="mr-2 text-accent underline" href={s.url} target="_blank" rel="noreferrer">{s.name}</a>)}</div>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-[11px]"><input type="checkbox" checked={confirmed} onChange={(e) => up((s) => { const l = s.inputs.reg.userConfirmedRules; const i = l.indexOf(rule.rule_id); if (e.target.checked && i < 0) l.push(rule.rule_id); if (!e.target.checked && i >= 0) l.splice(i, 1); })} /> I have verified this rule against the primary RBI text (this changes its status to USER_PROVIDED and can lift “potentially eligible” to “eligible”)</label>
                </details>
              );
            })}
          </div>
        ))}
      </Card>

      <Card title="Distinctions the application keeps explicit">
        <ul className="list-disc space-y-1 pl-5 text-xs text-text-dim">
          <li><b className="text-text">Interest-rate differential ≠ economic carry.</b> After hedging, the rate gap is offset by the hedge cost; what is left is credit spread, basis, margin, fees and tax.</li>
          <li><b className="text-text">FX forward premium ≠ actual hedge cost.</b> The hedge cost is the cash-flow effect of the real hedge including bid/offer, collateral and compounding.</li>
          <li><b className="text-text">Theoretical CCS ≠ executable dealer CCS.</b> Without a firm dealer quote a route is labelled “theoretical arbitrage only — dealer quote required”.</li>
          <li><b className="text-text">RBI eligibility assumption ≠ confirmed eligibility.</b> See statuses above.</li>
          <li><b className="text-text">Market arbitrage ≠ regulatory arbitrage.</b> The RBI benefit is shown on its own line, never blended into market economics.</li>
        </ul>
      </Card>
    </>
  );
}

/* -------------------------------- settings -------------------------------- */

export function SettingsPanel(p: ResultProps) {
  const { st, up, live } = p;
  const rk = st.inputs.risk;
  const regime = useMemo(() => detectRegime(live), [live]);
  return (
    <>
      <Card title="Risk assumptions (used for VaR / ES / penalties and ranking — never for the funding economics)">
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-4">
          <Field label="Confidence"><Select value={rk.confidence} width="w-24" onChange={(v) => up((s) => (s.inputs.risk.confidence = Number(v) as 0.95 | 0.99))} options={[{ value: 0.95, label: "95%" }, { value: 0.99, label: "99%" }]} /></Field>
          <Field label="Horizon (days)"><Select value={rk.horizonDays} width="w-28" onChange={(v) => up((s) => (s.inputs.risk.horizonDays = v))} options={[{ value: 1, label: "1 day" }, { value: 10, label: "10 days" }, { value: 21, label: "1 month" }, { value: 63, label: "3 months" }, { value: 252, label: "1 year" }]} /></Field>
          <Field label="Rate vol (bp/yr)"><NumInput value={rk.rateVolBp * BP} unit="bp" width="w-16" onChange={(v) => v !== null && up((s) => (s.inputs.risk.rateVolBp = v / BP))} /></Field>
          <Field label="Basis vol (bp/yr)"><NumInput value={rk.basisVolBp * BP} unit="bp" width="w-16" onChange={(v) => v !== null && up((s) => (s.inputs.risk.basisVolBp = v / BP))} /></Field>
          <Field label="Spread vol (bp/yr)"><NumInput value={rk.spreadVolBp * BP} unit="bp" width="w-16" onChange={(v) => v !== null && up((s) => (s.inputs.risk.spreadVolBp = v / BP))} /></Field>
          <Field label="Risk aversion"><NumInput value={rk.riskAversion} width="w-16" min={0} onChange={(v) => v !== null && up((s) => (s.inputs.risk.riskAversion = v))} /></Field>
        </div>
        <Table>
          <thead><tr><Th>Currency</Th><Th right>FX vol vs INR (annual)</Th><Th right>Live 1y realised vol</Th><Th right>Liquidity score (1 high · 0.5 medium · 0.2 low)</Th></tr></thead>
          <tbody>
            {CURRENCIES.map((c) => (
              <tr key={c.code} className="border-t border-border/40">
                <Td mono>{c.code}</Td>
                <Td right><NumInput value={rk.fxVol[c.code] ?? null} unit="pct" suffix="%" width="w-16" min={0} onChange={(v) => up((s) => (s.inputs.risk.fxVol[c.code] = v))} /></Td>
                <Td right mono>{live && isNum(live.realizedVol[c.code]) ? <>{pct(live.realizedVol[c.code])} <button className="ml-1 text-[10px] text-accent underline" onClick={() => up((s) => (s.inputs.risk.fxVol[c.code] = live.realizedVol[c.code] as number))}>use</button></> : "—"}</Td>
                <Td right><NumInput value={rk.liquidity[c.code] ?? 0.5} width="w-14" min={0} max={1} onChange={(v) => v !== null && up((s) => (s.inputs.risk.liquidity[c.code] = v))} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-2 text-[10px] text-text-dim">Realised vol is computed from the ECB daily reference series this site already stores (last ~1 year) — a model estimate, not an implied vol from a dealer. Liquidity scores are model assumptions you can override.</p>
        <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={st.applyRegimeVol} onChange={(e) => up((s) => (s.applyRegimeVol = e.target.checked))} /> Scale FX-vol assumptions by the detected regime multiplier (×{regime.volMultiplier.toFixed(2)}: {regime.labels.join(", ")})</label>
      </Card>
      <Card title="Limits & labels">
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <Field label="Max share in one currency"><NumInput value={rk.maxSingleCurrencyShare} unit="pct" suffix="%" width="w-16" onChange={(v) => v !== null && up((s) => (s.inputs.risk.maxSingleCurrencyShare = v))} /></Field>
          <Field label="Max unhedged share"><NumInput value={rk.maxUnhedgedShare} unit="pct" suffix="%" width="w-16" onChange={(v) => v !== null && up((s) => (s.inputs.risk.maxUnhedgedShare = v))} /></Field>
          <Field label="Min liquidity score"><NumInput value={rk.minLiquidityScore} width="w-16" onChange={(v) => v !== null && up((s) => (s.inputs.risk.minLiquidityScore = v))} /></Field>
          <Field label="Max FX expected shortfall (% of notional)"><NumInput value={rk.maxFxEsPctOfNotional} unit="pct" suffix="%" width="w-16" onChange={(v) => v !== null && up((s) => (s.inputs.risk.maxFxEsPctOfNotional = v))} /></Field>
          <Field label="'Very strong' above"><NumInput value={st.inputs.bands.veryStrong} unit="bp" suffix="bp" width="w-16" onChange={(v) => v !== null && up((s) => (s.inputs.bands.veryStrong = v))} /></Field>
          <Field label="'Strong' from"><NumInput value={st.inputs.bands.strong} unit="bp" suffix="bp" width="w-16" onChange={(v) => v !== null && up((s) => (s.inputs.bands.strong = v))} /></Field>
          <Field label="'Marginal' from"><NumInput value={st.inputs.bands.marginal} unit="bp" suffix="bp" width="w-16" onChange={(v) => v !== null && up((s) => (s.inputs.bands.marginal = v))} /></Field>
        </div>
        <p className="mt-2 text-[10px] text-text-dim">Labels are descriptive only (no “best investment” claims): above the first threshold = very strong, then strong, marginal, weak (0 to marginal) and no arbitrage (below 0).</p>
      </Card>
      <Card title="Live reference data available to this page">
        {!live ? <div className="text-xs text-text-dim">Live reference data is unavailable right now. The page works without it.</div> : (
          <>
            <div className="text-[11px] text-text-dim">Fetched {live.fetchedAt}. These are official / ECB reference values stored by the daily pipeline — <b>never dealer prices</b>. CCS, forward and credit-spread quotes are not available from free sources and must be entered by you.</div>
            <Table>
              <thead><tr><Th>Rate</Th><Th>Currency</Th><Th right>Value</Th><Th right>90-day change</Th><Th>As of</Th></tr></thead>
              <tbody>{live.rates.map((x) => <tr key={x.key} className="border-t border-border/40"><Td>{x.label}</Td><Td mono>{x.ccy}</Td><Td right mono>{x.value.toFixed(2)}%</Td><Td right mono>{x.change90d === null ? "—" : `${x.change90d >= 0 ? "+" : ""}${x.change90d.toFixed(2)} pp`}</Td><Td>{x.asOf.slice(0, 10)}</Td></tr>)}</tbody>
            </Table>
          </>
        )}
      </Card>
    </>
  );
}

/* --------------------------------- audit --------------------------------- */

function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
  const out: string[] = [];
  let inTable = false;
  let inList = false;
  for (const line of md.split("\n")) {
    if (/^\|/.test(line)) {
      if (/^\|[-| ]+\|$/.test(line)) continue;
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (!inTable) {
        out.push("<table>");
        inTable = true;
        out.push("<tr>" + cells.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr>");
      } else out.push("<tr>" + cells.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
      continue;
    }
    if (inTable) { out.push("</table>"); inTable = false; }
    if (/^- /.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    if (/^## /.test(line)) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (/^# /.test(line)) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (inTable) out.push("</table>");
  if (inList) out.push("</ul>");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Funding Decision Report</title><style>body{font:12px/1.5 system-ui,sans-serif;margin:24px;color:#111}h1{font-size:20px}h2{font-size:14px;margin-top:18px;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #bbb;padding:3px 6px;text-align:left;font-size:11px}th{background:#eee}</style></head><body>${out.join("\n")}</body></html>`;
}

async function exportXlsx(rows: Record<string, unknown>[], ledger: Record<string, unknown>[], name: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Funding radar");
  if (ledger.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ledger), "Cash flows");
  XLSX.writeFile(wb, name);
}

export function AuditPanel(p: ResultProps) {
  const { st, up, a, eff, now, live } = p;
  const r = selectedRoute(a, p.selectedId);
  const conflicts = useMemo(() => spotConflicts(st.inputs, live), [st.inputs, live]);
  const signals = useMemo(() => deriveSignals(eff, a, st.prevSnapshot, conflicts.length), [eff, a, st.prevSnapshot, conflicts.length]);
  const cool = useMemo(() => applyCooldown(st.signalRecords, signals, now), [st.signalRecords, signals, now]);
  const [label, setLabel] = useState("");
  const rv = useMemo(() => (r?.exec ? reverseFor(eff, r.route) : null), [eff, r]);
  const md = () => toMarkdown(eff, a, r, rv);
  const ledgerRows = (r?.evalExec?.entries ?? []).map((e) => ({ ledger: e.ledger, date: e.date, t_years: e.t, currency: e.ccy, instrument: e.instrument, description: e.desc, amount: e.amount, kind: e.kind, tag: e.tag ?? "", modelled: e.modelled ? "yes" : "" }));
  const printPdf = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(mdToHtml(md()));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };
  return (
    <>
      <Card title="Signals (derived from your current quotes; no signal because a currency merely has the lowest headline rate)" right={<Btn kind="primary" onClick={() => up((s) => { s.signalRecords = cool.records; s.prevSnapshot = takeSnapshot(a); s.history.unshift({ ts: now, label: label || "Snapshot", best: a.best?.label ?? null, advantageBp: a.best?.exec ? a.best.exec.arbitrage / BP : null, effective: a.best?.exec?.effective ?? null, status: a.best?.status ?? null }); s.history = s.history.slice(0, 50); })}>Save snapshot & update alert log</Btn>}>
        {!signals.length ? <div className="text-xs text-text-dim">No signals: enter quotes, or the market is quiet.</div> : (
          <Table>
            <thead><tr><Th>Signal</Th><Th>Message</Th><Th>Alert?</Th></tr></thead>
            <tbody>
              {signals.map((s) => {
                const alert = cool.alerts.some((x) => x.id === s.id);
                return <tr key={s.id} className="border-t border-border/40"><Td><Tag tone={s.type.includes("STALE") || s.type.includes("CONFLICT") || s.type.includes("FALSE") || s.type.includes("FAILED") ? "bad" : s.type.includes("CLOSED") || s.type.includes("WEAK") ? "warn" : "good"}>{s.type}</Tag></Td><Td>{s.message}</Td><Td>{alert ? <b>NEW / materially changed</b> : <span className="text-text-dim">suppressed (cooldown)</span>}</Td></tr>;
              })}
            </tbody>
          </Table>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><input className="w-56 rounded border border-border bg-bg px-2 py-1 text-xs text-text" placeholder="Snapshot label (e.g. 10:30 quotes)" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div className="mt-2 text-[10px] text-text-dim">Alert cooldown: a signal only re-alerts when its value moves by at least 5 (bp) or it is new; the log keeps signal_id, first_seen, last_seen, threshold, previous/current value and notification status. Alerts are shown here on the dashboard. Telegram / e-mail / webhook alerts are not built: your quotes live only in this browser, so nothing could trigger them while the page is closed (see limitations).</div>
        {st.signalRecords.length > 0 && (
          <details className="mt-2 text-[11px]"><summary className="cursor-pointer text-text-dim">Alert log ({st.signalRecords.length})</summary>
            <Table><thead><tr><Th>signal_id</Th><Th>first_seen</Th><Th>last_seen</Th><Th right>threshold</Th><Th right>previous</Th><Th right>current</Th><Th>status</Th></tr></thead>
              <tbody>{st.signalRecords.map((x) => <tr key={x.signal_id} className="border-t border-border/40"><Td>{x.signal_id}</Td><Td>{x.first_seen.slice(0, 19)}</Td><Td>{x.last_seen.slice(0, 19)}</Td><Td right mono>{x.threshold}</Td><Td right mono>{x.previous_value ?? "—"}</Td><Td right mono>{x.current_value ?? "—"}</Td><Td>{x.notification_status}</Td></tr>)}</tbody></Table>
          </details>
        )}
      </Card>

      <Card title="Funding decision report — export">
        <div className="flex flex-wrap gap-2">
          <Btn kind="primary" onClick={printPdf} title="Opens a printable report; choose Save as PDF in the print dialog">PDF (print)</Btn>
          <Btn onClick={() => void exportXlsx(radarRows(a, eff) as unknown as Record<string, unknown>[], ledgerRows, `funding-carry-${now.slice(0, 10)}.xlsx`)}>Excel (.xlsx)</Btn>
          <Btn onClick={() => download(`funding-carry-radar-${now.slice(0, 10)}.csv`, "text/csv", toCsv(a, eff))}>CSV — radar</Btn>
          <Btn disabled={!r} onClick={() => r && download(`funding-carry-ledger-${now.slice(0, 10)}.csv`, "text/csv", ledgerCsv(r))}>CSV — cash flows</Btn>
          <Btn onClick={() => download(`funding-carry-audit-${now.slice(0, 10)}.json`, "application/json", toJson(eff, a, r, rv))}>JSON — full audit snapshot</Btn>
          <Btn onClick={() => download(`funding-decision-report-${now.slice(0, 10)}.md`, "text/markdown", md())}>Markdown</Btn>
          <Btn onClick={() => download(`quote-request-${now.slice(0, 10)}.txt`, "text/plain", rfqText(eff, FUNDING_CCYS))}>Quote-request sheet for banks</Btn>
        </div>
        <div className="mt-2 text-[11px] text-text-dim">The JSON contains the timestamp, model version, regulatory versions, every input (market snapshot and your quotes with their source, quality and time), the calculation parameters, the results and the full ledger — enough to reproduce the recommendation exactly. Report sections: executive summary · requirement · market snapshot · currency comparison · effective INR costs · hedge economics · reverse thresholds · stress · regulatory eligibility · risks · sensitivities · audit trail.</div>
      </Card>

      <Card title="Saved snapshots (this browser)">
        {!st.history.length ? <div className="text-xs text-text-dim">None yet.</div> : (
          <Table><thead><tr><Th>Time</Th><Th>Label</Th><Th>Best route</Th><Th right>Effective</Th><Th right>Advantage</Th><Th>Status</Th></tr></thead>
            <tbody>{st.history.map((h, i) => <tr key={i} className="border-t border-border/40"><Td mono>{h.ts.slice(0, 19)}</Td><Td>{h.label}</Td><Td mono>{h.best ?? "—"}</Td><Td right mono>{pct(h.effective)}</Td><Td right mono>{h.advantageBp === null ? "—" : `${h.advantageBp >= 0 ? "+" : ""}${h.advantageBp.toFixed(0)} bp`}</Td><Td>{h.status ?? "—"}</Td></tr>)}</tbody></Table>
        )}
      </Card>

      <Card title="Model governance">
        <Table><tbody>
          {[["model_name", "Deterministic funding carry engine (cash-flow IRR, CCS/forward/RBI-swap ledgers)"], ["version", MODEL_VERSION], ["release_date", "2026-09-21"], ["training / validation / OOS periods", "not applicable — no statistical model is fitted; every number is a deterministic function of your inputs"], ["features", "user quotes, deal terms, tax and regulatory inputs"], ["hyperparameters", "none (risk penalty scale factors are listed on the Stress tab)"], ["performance", "45+ automated checks: golden case, sign, cancellation, path consistency, zero-cost synthetic, reverse solve round-trip, regulatory gating"], ["limitations", "see the list below"], ["ML / RL", "NOT deployed. ML forecasting (FX vol, basis, spreads, hedge cost, arbitrage persistence) and RL need years of point-in-time dealer CCS / basis / quote history that no free source provides; fitting them to CIP-implied numbers would create model artefacts. The deterministic engine is therefore the only source of funding economics (as the spec requires: ML must never be a dependency). MODEL_DEGRADED fallback is moot."]].map(([k, v]) => <tr key={k} className="border-t border-border/40"><Td><b>{k}</b></Td><Td><span className="text-text-dim">{v}</span></Td></tr>)}
        </tbody></Table>
      </Card>

      <Card title="Assumptions & limitations (read before relying on any number)">
        <ul className="list-decimal space-y-1.5 pl-5 text-xs text-text-dim">
          <li><b className="text-text">Effective rate</b> = annual-effective IRR of the borrower&apos;s cash flows (time axis = period / frequency; coupons accrue by your day count). The rupee alternative is modelled the same way (own frequency, fees, tax shield), so the comparison is like-for-like.</li>
          <li><b className="text-text">Floating loans</b>: the benchmark is taken at today&apos;s term swap rate (flat). In a CCS route the floating leg received from the bank equals the loan coupon, so it cancels exactly and no forecast is needed. Reset frequency is recorded but does not change the maths. On forward-strip routes the floating coupon only moves in the rate stress.</li>
          <li><b className="text-text">Credit spread and fees through a CCS</b> pass through 1:1 at rate level (a spread of X bp on the foreign notional is paid as X bp on the destination notional); one-off fees are converted at inception spot. Real dealers may price the spread conversion slightly differently — get it in the CCS quote.</li>
          <li><b className="text-text">Bid/offer</b>: spot conversions use the adverse side by direction; two-way hedge quotes use the side you pay; single-sided inputs (lender spread, fees) are taken as entered. Liquidity stress widens two-way quotes around mid.</li>
          <li><b className="text-text">Dates</b>: payment dates move to the next weekday (modified following); no public-holiday calendars are bundled; accrual uses unadjusted dates.</li>
          <li><b className="text-text">Not priced</b>: call/put options, make-whole, prepayment and break costs, dynamic hedging, option/collar pay-offs (only a premium p.a. is used), CSA margin flows (only a bp charge you enter) and OIS/CSA discounting curves (NPV and MTM are discounted at the effective rate). Hedge MTM in stress is an approximation (outstanding × shock).</li>
          <li><b className="text-text">Tax</b> is limited to what you enter: withholding-tax gross-up, GST on fees, stamp duty, guarantee fee and a flat interest tax shield applied equally to both alternatives. No rate is built in.</li>
          <li><b className="text-text">Regulation</b> is DERIVED from secondary summaries and needs confirmation with your AD Category-I bank; the app cannot know your borrower-specific facts.</li>
          <li><b className="text-text">Live data</b> here means official reference series already stored by this site (ECB daily fixings, policy/interbank rates, VIX). They are for sanity checks and prefills only — SGD/HKD spots, CCS, forward points and credit spreads are not available from free sources, so those are always entered by you.</li>
          <li><b className="text-text">Persistence</b>: your inputs are kept in this browser only (nothing is uploaded, nothing is written to the shared database). The audit JSON is your record. The 25-table PostgreSQL/TimescaleDB schema, Redis, a separate FastAPI/Streamlit stack, historical walk-forward backtesting on point-in-time dealer data and Telegram/e-mail/webhook delivery are not part of this build — see the summary in the conversation for why and what it would take.</li>
          <li><b className="text-text">Decision support only.</b> Default state is ANALYSIS ONLY: the app never places a loan, enters a derivative, sends an order or executes a hedge.</li>
        </ul>
      </Card>

      <Card title="Data conflicts & danger zone">
        {!conflicts.length ? <div className="text-xs text-text-dim">No material differences between your dealer spot quotes and the live reference.</div> : (
          <Table><thead><tr><Th>Pair</Th><Th>Source A</Th><Th>Source B</Th><Th right>Difference</Th></tr></thead><tbody>{conflicts.map((c) => <tr key={c.pair} className="border-t border-border/40"><Td mono>{c.pair}</Td><Td>{c.a.label}: {c.a.mid.toFixed(4)}</Td><Td>{c.b.label}: {c.b.mid.toFixed(4)}</Td><Td right mono>{c.diffPct.toFixed(2)}% — DATA_CONFLICT</Td></tr>)}</tbody></Table>
        )}
        <div className="mt-3 flex gap-2">
          <Btn kind="danger" onClick={() => { if (window.confirm("Erase every quote, setting, bank quote and snapshot stored in this browser?")) { clearState(); up((s) => Object.assign(s, freshState(now))); } }}>Erase all my data in this browser</Btn>
        </div>
      </Card>
    </>
  );
}

/* ---------------------------------- guide ---------------------------------- */

export function GuidePanel(p: ResultProps) {
  const { st, up, now, goto } = p;
  const inp = st.inputs;
  const rfq = rfqText(inp, FUNDING_CCYS.slice(0, 5));
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Note tone="warn"><b>Decision support only.</b> This tool never contacts a bank and never executes anything. It turns the quotes <i>you</i> collect from banks into a transparent comparison. Every number can be traced to a cash flow (Why tab).</Note>
      <Card title="Start here — how to use this in 6 steps">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li><b>Say what you need</b> (<button className="text-accent underline" onClick={() => goto("deal")}>1 · Deal</button>): amount, tenor, the rupee rate you would otherwise pay, and the minimum saving that makes the exercise worthwhile.</li>
          <li><b>Ask 2–3 banks for quotes</b> using the request sheet below: spot rates, the foreign loan margin, and the hedge (usually a cross-currency swap to rupees).</li>
          <li><b>Type the quotes in</b> (<button className="text-accent underline" onClick={() => goto("quotes")}>2 · OTC quotes</button>) exactly as given — both bid and offer where two prices are quoted. Empty boxes stay empty: the app will say what is missing.</li>
          <li><b>Read the answer</b> (<button className="text-accent underline" onClick={() => goto("radar")}>3 · Radar</button>): the cheapest route, what you save per year, and whether it is EXECUTE / WATCH / AVOID — and <i>why</i>.</li>
          <li><b>Check the limits</b> (<button className="text-accent underline" onClick={() => goto("reverse")}>Reverse</button>): the maximum lender margin and hedge cost you can accept — this is your negotiating range. Use <button className="text-accent underline" onClick={() => goto("bank")}>Banks</button> to compare quotes and set a target.</li>
          <li><b>Confirm the rules</b> (<button className="text-accent underline" onClick={() => goto("reg")}>Regulatory</button>) with your bank before acting; keep the audit file (Audit tab).</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn kind="primary" onClick={() => { up((s) => { const ex = exampleInputs(now); s.inputs = ex; s.editTenor = 5; }); goto("radar"); }} title="Loads the master-prompt style example (₹500 Cr, 5Y, 7.10%). Every number is ILLUSTRATIVE and can never signal EXECUTE.">Load the worked example (illustrative numbers)</Btn>
          <Btn onClick={() => { if (window.confirm("Reset all inputs to blank?")) up((s) => Object.assign(s, freshState(now))); }}>Start blank</Btn>
        </div>
      </Card>

      <Card title="Quote-request sheet — copy into an email to your banks" right={<Btn onClick={() => { void navigator.clipboard.writeText(rfq).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>{copied ? "Copied ✓" : "Copy"}</Btn>}>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-border bg-bg p-3 text-[11px] text-text-dim">{rfq}</pre>
      </Card>

      <Card title="Plain-language glossary">
        <dl className="grid gap-x-8 gap-y-2 text-xs md:grid-cols-2">
          {[
            ["Carry / funding arbitrage", "Borrowing in a currency where money is cheap and ending up with rupees for less than a domestic loan would cost — after every cost of converting and hedging."],
            ["Effective INR cost", "The single yearly rate (IRR) that equates the rupees you receive with all the rupees you pay over the life of the deal, including hedge, fees and tax."],
            ["Cross-currency swap (CCS)", "A contract with a bank: you swap your foreign loan payments for rupee payments at agreed rates. It removes the currency risk. You pay a fixed rupee rate; the bank pays your foreign floating rate."],
            ["Hedge cost", "How much extra per year the rupee leg costs versus the foreign rate — the price of removing currency risk."],
            ["Basis", "The part of the hedge cost beyond the pure interest-rate difference between the two currencies (supply/demand for dollars, dealer margin)."],
            ["Benchmark term swap rate", "The market rate for the loan's benchmark (SOFR, TONAR, €STR…) over the whole tenor, before the lender adds its margin."],
            ["Lender spread", "The margin the foreign lender adds over the benchmark, in basis points (1 bp = 0.01%)."],
            ["Bid / offer (ask)", "A dealer's two prices. You always deal at the worse one for you; the app does this automatically."],
            ["Executable vs theoretical", "Executable = a firm dealer quote you can act on. Theoretical = a number from a model or an old/indicative quote."],
            ["Headroom", "How much better the route is than the minimum saving you asked for. Negative headroom = it does not meet your bar."],
            ["Synthetic USD", "Borrow another currency (e.g. yen) and swap it into dollars so that you effectively owe dollars."],
            ["Hedge ratio", "Share of the foreign loan whose currency risk you remove. 100% = none left."],
          ].map(([k, v]) => <div key={k}><dt className="font-semibold text-text">{k}</dt><dd className="text-text-dim">{v}</dd></div>)}
        </dl>
      </Card>

      <Card title="Common mistakes this tool protects you from">
        <ul className="list-disc space-y-1 pl-5 text-xs text-text-dim">
          <li>Picking the currency with the lowest headline interest rate — the hedge usually erases most of that gap.</li>
          <li>Comparing at mid-market prices — the app also shows the executable cost and the slippage.</li>
          <li>Using stale quotes — anything older than the limits on the Quotes tab cannot be EXECUTE.</li>
          <li>Assuming a concession applies to you — the RBI swap is limited to eligible PSU ECBs and AD-bank OFCBs.</li>
          <li>Leaving currency exposure open by accident — any share below 100% hedged is reported as residual exposure.</li>
        </ul>
      </Card>
    </>
  );
}

