"use client";

import { useDeferredValue, useMemo } from "react";
import { selectedRoute, type ResultProps } from "./ResultPanels";
import { Btn, Card, Field, NumInput, Note, Select, StatusPill, Table, Tag, Td, Th } from "./ui";
import { HBars } from "./charts";
import { bpS, cr, pct, spreadText } from "./fmt";
import { assessNewFunding, compareBankQuotes, negotiation, naturalHedge, optimalHedgeRatio, optimizePortfolio, requiredHedgeRatio, tenorCurves, type BankQuote, type ExposureKind, type Objective } from "@/lib/carry/portfolio";
import { FUNDING_CCYS, INR } from "@/lib/carry/currencies";
import { TENORS } from "@/lib/carry/defaults";
import { BP } from "@/lib/carry/units";
import type { HedgeInstrument } from "@/lib/carry/types";

const uid = () => Math.random().toString(36).slice(2, 9);

const INSTRUMENTS: { value: HedgeInstrument; label: string }[] = [
  { value: "CCS", label: "CCS (fixed rate in INR)" },
  { value: "FX_FORWARD", label: "Forward premium p.a." },
  { value: "HEDGE_COST", label: "Hedge cost p.a." },
];

/* ---------------------------- bank quote comparator ---------------------------- */

export function BankPanel(p: ResultProps) {
  const { st, up, eff, now } = p;
  const results = useMemo(() => compareBankQuotes(eff, st.bank, st.compareMetric), [eff, st.bank, st.compareMetric]);
  const neg = useMemo(() => negotiation(results, st.negStepBp ?? 5), [results, st.negStepBp]);
  const set = (i: number, fn: (q: BankQuote) => void) => up((s) => { fn(s.bank[i]); s.bank[i].quotedAt = now; });
  const add = () => up((s) => { s.bank.push({ id: uid(), bank: `Bank ${String.fromCharCode(65 + s.bank.length)}`, ccy: "USD", spread: null, upfrontFeePct: null, ongoingFeeBp: null, hedgeInstrument: "CCS", hedgeBid: null, hedgeOffer: null, quotedAt: now }); });
  return (
    <>
      <Note>
        Enter the <b>actual executable quotes</b> each bank gave you. The app calculates the effective INR cost of each, compares against your rupee alternative and ranks <b>only by the economic metric you choose</b> — never by reputation. If you leave the hedge boxes empty, that currency&apos;s hedge quote from step 2 · C is used. Nothing is sent to any bank; nothing is executed.
      </Note>
      <Card title="Bank quotes" right={<div className="flex gap-2"><Btn onClick={add}>+ Add bank quote</Btn>{st.bank.length > 0 && <Btn kind="danger" onClick={() => up((s) => (s.bank = []))}>Clear</Btn>}</div>}>
        {!st.bank.length ? <div className="text-xs text-text-dim">No bank quotes yet. Click “+ Add bank quote”. Example of what you would enter: Bank A — USD — SOFR + 95 bp; Bank B — SOFR + 82 bp; Bank C — SOFR + 110 bp.</div> : (
          <Table>
            <thead><tr><Th>Bank</Th><Th>Currency</Th><Th right>Lender spread</Th><Th right>Upfront fee</Th><Th right>Ongoing fee</Th><Th>Hedge type</Th><Th right>Hedge bid</Th><Th right>Hedge offer</Th><Th /></tr></thead>
            <tbody>
              {st.bank.map((b, i) => (
                <tr key={b.id} className="border-t border-border/60">
                  <Td><input className="w-28 rounded border border-border bg-bg px-2 py-1 text-xs text-text" value={b.bank} onChange={(e) => set(i, (q) => (q.bank = e.target.value))} /></Td>
                  <Td><Select value={b.ccy} width="w-20" onChange={(v) => set(i, (q) => (q.ccy = v))} options={FUNDING_CCYS.map((c) => ({ value: c, label: c }))} /></Td>
                  <Td right><NumInput value={b.spread} unit="bp" suffix="bp" width="w-16" min={0} onChange={(v) => set(i, (q) => (q.spread = v))} /></Td>
                  <Td right><NumInput value={b.upfrontFeePct} unit="pct" suffix="%" width="w-14" min={0} onChange={(v) => set(i, (q) => (q.upfrontFeePct = v))} /></Td>
                  <Td right><NumInput value={b.ongoingFeeBp !== null ? b.ongoingFeeBp * BP : null} unit="bp" suffix="bp" width="w-14" min={0} onChange={(v) => set(i, (q) => (q.ongoingFeeBp = v === null ? null : v / BP))} /></Td>
                  <Td><Select value={b.hedgeInstrument} width="w-40" onChange={(v) => set(i, (q) => (q.hedgeInstrument = v))} options={INSTRUMENTS} /></Td>
                  <Td right><NumInput value={b.hedgeBid} unit="pct" suffix="%" width="w-16" onChange={(v) => set(i, (q) => (q.hedgeBid = v))} /></Td>
                  <Td right><NumInput value={b.hedgeOffer} unit="pct" suffix="%" width="w-16" onChange={(v) => set(i, (q) => (q.hedgeOffer = v))} /></Td>
                  <Td><button className="text-[10px] text-red-400 hover:underline" onClick={() => up((s) => s.bank.splice(i, 1))}>remove</button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs"><span className="text-text-dim">Rank by:</span><Select value={st.compareMetric} width="w-56" onChange={(v) => up((s) => (s.compareMetric = v))} options={[{ value: "effective", label: "Lowest effective INR cost" }, { value: "saving", label: "Highest saving vs INR alternative" }, { value: "headroom", label: "Most headroom over my minimum" }, { value: "maxSpread", label: "Highest maximum acceptable spread" }]} /></div>
      </Card>

      {results.length > 0 && (
        <Card title="Comparison — economic ranking only">
          <Table>
            <thead><tr><Th>Rank</Th><Th>Bank</Th><Th>Route</Th><Th right>Quote</Th><Th right>Effective INR</Th><Th right>Saving</Th><Th right>Headroom</Th><Th right>Annual saving</Th><Th right>Max acceptable spread</Th><Th right>Room to widen</Th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.quote.id} className="border-t border-border/60">
                  <Td mono>{r.rank ?? "—"}</Td>
                  <Td>{r.quote.bank}</Td>
                  <Td mono>{r.quote.ccy} → INR</Td>
                  <Td right mono>{spreadText(r.quote.ccy, r.quote.spread)}</Td>
                  <Td right mono>{r.ok ? pct(r.effective) : <span className="text-text-dim">need: {r.missing.slice(0, 2).join("; ")}</span>}</Td>
                  <Td right mono>{bpS(r.saving)}</Td>
                  <Td right mono>{bpS(r.headroom)}</Td>
                  <Td right mono>{cr(r.annualSavingInr)}</Td>
                  <Td right mono>{r.maxAcceptableSpread !== null ? spreadText(r.quote.ccy, r.maxAcceptableSpread) : "—"}</Td>
                  <Td right mono>{r.spreadHeadroomBp !== null ? `${r.spreadHeadroomBp >= 0 ? "+" : ""}${r.spreadHeadroomBp.toFixed(0)} bp` : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card title="Negotiation engine">
        {!neg.bestQuote ? <div className="text-xs text-text-dim">{neg.note}</div> : (
          <div className="grid gap-3 text-xs md:grid-cols-4">
            <div><div className="text-[10px] uppercase text-text-dim">Current best executable quote</div><div className="gfew-mono text-base font-semibold">{spreadText(neg.bestQuote.quote.ccy, neg.bestQuote.quote.spread)}</div><div className="text-[10px] text-text-dim">{neg.bestQuote.quote.bank}</div></div>
            <div><div className="text-[10px] uppercase text-text-dim">Maximum acceptable (walk-away)</div><div className="gfew-mono text-base font-semibold">{neg.walkAway !== null ? spreadText(neg.bestQuote.quote.ccy, neg.walkAway) : "—"}</div></div>
            <div><div className="text-[10px] uppercase text-text-dim">Negotiation headroom</div><div className="gfew-mono text-base font-semibold">{neg.headroomBp !== null ? `${neg.headroomBp.toFixed(0)} bp` : "—"}</div></div>
            <div><div className="text-[10px] uppercase text-text-dim">Target lender spread</div><div className="gfew-mono text-base font-semibold">≤ {neg.targetSpread !== null ? spreadText(neg.bestQuote.quote.ccy, neg.targetSpread) : "—"}</div><div className="text-[10px] text-text-dim">beat the best quote by <NumInput value={st.negStepBp * BP} unit="bp" suffix="bp" width="w-12" onChange={(v) => v !== null && up((s) => (s.negStepBp = v / BP))} /></div></div>
          </div>
        )}
        <div className="mt-2 text-[11px] text-text-dim">{neg.note} The application is a decision-support tool: it will never place a loan, enter a derivative, send an order or execute a hedge.</div>
      </Card>
    </>
  );
}

/* --------------------------------- portfolio --------------------------------- */

const KINDS: { value: ExposureKind; label: string }[] = [
  { value: "export_receivable", label: "Export receivable (asset)" },
  { value: "fcy_asset", label: "Foreign-currency asset" },
  { value: "foreign_investment", label: "Foreign investment (asset)" },
  { value: "overseas_subsidiary", label: "Overseas subsidiary (asset)" },
  { value: "import_payable", label: "Import payable (liability)" },
  { value: "existing_fcy_debt", label: "Existing foreign debt (liability)" },
];

export function PortfolioPanel(p: ResultProps) {
  const { st, up, a, eff } = p;
  const r = selectedRoute(a, p.selectedId);
  const dr = useDeferredValue(r);
  const newFunding: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    if (dr?.evalExec?.notionals[0]) out[dr.start] = dr.evalExec.notionals[0].amount;
    return out;
  }, [dr]);
  const nh = useMemo(() => naturalHedge(st.exposures, newFunding, st.exposureHedges), [st.exposures, newFunding, st.exposureHedges]);
  const row = nh.find((x) => x.ccy === dr?.start);
  const needRatio = requiredHedgeRatio(row);
  const hr = useMemo(() => (dr?.exec ? optimalHedgeRatio(eff, dr.route) : null), [eff, dr]);
  const opt = useMemo(() => optimizePortfolio(eff, a, st.objective), [eff, a, st.objective]);
  const tc = useMemo(() => tenorCurves(eff, st.tenorCons), [eff, st.tenorCons]);
  const verdict = useMemo(() => {
    if (!dr?.exec || !st.book.length) return null;
    const hedged = eff.deal.hedgeRatio;
    return assessNewFunding(eff, st.book, { id: "new", label: dr.label, ccy: dr.start, amountInr: eff.deal.requirementInr, effectiveCost: dr.exec.effective, remainingYears: eff.deal.tenorYears, hedgedShare: hedged });
  }, [eff, dr, st.book]);
  const ccyOpts = [...FUNDING_CCYS, INR].map((c) => ({ value: c, label: c }));
  return (
    <>
      <Card title="Asset–liability matching & natural hedge" right={<Btn onClick={() => up((s) => s.exposures.push({ id: uid(), kind: "export_receivable", ccy: "USD", amount: 0 }))}>+ Add exposure</Btn>}>
        <Note>Enter the foreign-currency assets you already have (export receivables, foreign investments, subsidiaries) and existing foreign liabilities. The engine offsets them <b>before</b> deciding how much of the new loan needs a financial hedge — so you never hedge the same exposure twice.</Note>
        {st.exposures.length > 0 && (
          <Table>
            <thead><tr><Th>Type</Th><Th>Currency</Th><Th right>Amount (in that currency, units)</Th><Th /></tr></thead>
            <tbody>
              {st.exposures.map((x, i) => (
                <tr key={x.id} className="border-t border-border/60">
                  <Td><Select value={x.kind} width="w-56" onChange={(v) => up((s) => (s.exposures[i].kind = v))} options={KINDS} /></Td>
                  <Td><Select value={x.ccy} width="w-20" onChange={(v) => up((s) => (s.exposures[i].ccy = v))} options={ccyOpts.filter((c) => c.value !== INR)} /></Td>
                  <Td right><NumInput value={x.amount} width="w-36" min={0} onChange={(v) => up((s) => (s.exposures[i].amount = v ?? 0))} /></Td>
                  <Td><button className="text-[10px] text-red-400 hover:underline" onClick={() => up((s) => s.exposures.splice(i, 1))}>remove</button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {nh.length > 0 && (
          <div className="mt-3">
            <Table>
              <thead><tr><Th>Currency</Th><Th right>Assets</Th><Th right>Existing liabilities</Th><Th right>New funding</Th><Th right>Gross FCY liability</Th><Th right>Natural hedge</Th><Th right>Already hedged (financial)</Th><Th right>Residual hedge requirement</Th><Th right>Net FX exposure</Th></tr></thead>
              <tbody>
                {nh.map((x) => (
                  <tr key={x.ccy} className="border-t border-border/60">
                    <Td mono>{x.ccy}</Td><Td right mono>{x.assets.toLocaleString("en-IN")}</Td><Td right mono>{x.liabilities.toLocaleString("en-IN")}</Td><Td right mono>{x.newFunding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Td><Td right mono>{x.grossLiability.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Td><Td right mono>{x.naturalHedge.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Td>
                    <Td right><NumInput value={x.existingHedges} width="w-28" min={0} onChange={(v) => up((s) => (s.exposureHedges[x.ccy] = v ?? 0))} /></Td>
                    <Td right mono>{x.residualRequirement.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Td><Td right mono>{x.netExposure.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {needRatio !== null && dr && <div className="mt-2 text-xs">The natural hedge means only <b className="gfew-mono">{(needRatio * 100).toFixed(0)}%</b> of the new {dr.start} loan needs a financial hedge. <Btn onClick={() => up((s) => (s.inputs.deal.hedgeRatio = needRatio))}>Use {(needRatio * 100).toFixed(0)}% as my hedge ratio</Btn></div>}
          </div>
        )}
      </Card>

      <Card title={`Optimal hedge ratio — ${dr?.label ?? "select a route"}`}>
        {!hr ? <div className="text-xs text-text-dim">Select a complete route first.</div> : (
          <>
            <Table>
              <thead><tr><Th right>Hedge ratio</Th><Th right>Effective INR cost</Th><Th right>FX expected shortfall (% of notional)</Th><Th right>Risk-adjusted cost</Th><Th>Within your limits?</Th><Th /></tr></thead>
              <tbody>
                {hr.rows.map((x) => (
                  <tr key={x.ratio} className={`border-t border-border/60 ${hr.best?.ratio === x.ratio ? "bg-panel-raised" : ""}`}>
                    <Td right mono>{(x.ratio * 100).toFixed(0)}%</Td><Td right mono>{pct(x.effective, 3)}</Td><Td right mono>{x.esPct === null ? "enter FX vol" : pct(x.esPct, 2)}</Td><Td right mono>{pct(x.rac, 3)}</Td><Td>{x.allowed ? "✓ yes" : "✗ no"}</Td><Td>{hr.best?.ratio === x.ratio ? <Tag tone="good">optimal for your risk aversion</Tag> : null}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-2 text-[11px] text-text-dim">Lower hedge ratios usually look cheaper in expected cost (you skip the hedge cost) but carry open FX risk; the risk-adjusted column prices that risk with your risk-aversion setting. The optimal ratio only considers ratios inside your limits.</div>
          </>
        )}
      </Card>

      <Card title="Existing liabilities — does the new funding improve or worsen the whole book?" right={<Btn onClick={() => up((s) => s.book.push({ id: uid(), label: "Existing loan", ccy: "USD", amountInr: 1e9, effectiveCost: 0.07, remainingYears: 3, hedgedShare: 1 }))}>+ Add liability</Btn>}>
        {st.book.length > 0 && (
          <Table>
            <thead><tr><Th>Label</Th><Th>Currency</Th><Th right>Amount (₹ Cr)</Th><Th right>Effective cost</Th><Th right>Years left</Th><Th right>Hedged</Th><Th /></tr></thead>
            <tbody>
              {st.book.map((l, i) => (
                <tr key={l.id} className="border-t border-border/60">
                  <Td><input className="w-32 rounded border border-border bg-bg px-2 py-1 text-xs text-text" value={l.label} onChange={(e) => up((s) => (s.book[i].label = e.target.value))} /></Td>
                  <Td><Select value={l.ccy} width="w-20" onChange={(v) => up((s) => (s.book[i].ccy = v))} options={ccyOpts} /></Td>
                  <Td right><NumInput value={l.amountInr} unit="cr" width="w-24" min={0} onChange={(v) => up((s) => (s.book[i].amountInr = v ?? 0))} /></Td>
                  <Td right><NumInput value={l.effectiveCost} unit="pct" suffix="%" width="w-16" onChange={(v) => up((s) => (s.book[i].effectiveCost = v ?? 0))} /></Td>
                  <Td right><NumInput value={l.remainingYears} suffix="y" width="w-14" min={0} onChange={(v) => up((s) => (s.book[i].remainingYears = v ?? 0))} /></Td>
                  <Td right><NumInput value={l.hedgedShare} unit="pct" suffix="%" width="w-14" min={0} max={100} onChange={(v) => up((s) => (s.book[i].hedgedShare = v ?? 0))} /></Td>
                  <Td><button className="text-[10px] text-red-400 hover:underline" onClick={() => up((s) => s.book.splice(i, 1))}>remove</button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {verdict ? (
          <div className="mt-3">
            <div className="mb-1 text-xs">Adding <b>{dr?.label}</b> ({cr(eff.deal.requirementInr)}): <b style={{ color: verdict.improves ? "#34c085" : "#e0b93d" }}>{verdict.improves === null ? "not determinable" : verdict.improves ? "IMPROVES the liability book on every measured dimension" : "WORSENS at least one dimension"}</b></div>
            <Table>
              <thead><tr><Th>Measure</Th><Th right>Before</Th><Th right>After</Th><Th>Better?</Th></tr></thead>
              <tbody>
                {verdict.metrics.map((m) => (
                  <tr key={m.name} className="border-t border-border/40"><Td>{m.name}</Td><Td right mono>{m.unit === "%" ? pct(m.before, 2) : m.unit === "INR" ? cr(m.before) : m.before?.toFixed(2)}</Td><Td right mono>{m.unit === "%" ? pct(m.after, 2) : m.unit === "INR" ? cr(m.after) : m.after?.toFixed(2)}</Td><Td>{m.better === null ? "—" : m.better ? "✓" : "✗"}</Td></tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-2 text-xs font-semibold">Refinancing profile after adding the new funding</div>
            <HBars items={verdict.after.ladder.map((l) => ({ label: `Year ${l.year}`, value: l.amountInr / 1e7 }))} fmt={(v) => `₹${v.toFixed(0)} Cr`} title="maturity ladder" />
          </div>
        ) : <div className="mt-2 text-xs text-text-dim">Add your existing liabilities to see the consolidated cost, FX exposure, duration, VaR and refinancing ladder with and without the new funding.</div>}
      </Card>

      <Card title="Multi-currency optimizer — split the funding across currencies" right={<Select value={st.objective} width="w-56" onChange={(v: Objective) => up((s) => (s.objective = v))} options={[{ value: "lowest_cost", label: "Lowest absolute cost" }, { value: "max_saving", label: "Maximum funding saving" }, { value: "lowest_risk", label: "Lowest risk" }, { value: "max_certainty", label: "Maximum certainty" }, { value: "min_fx_exposure", label: "Minimum FX exposure" }, { value: "balanced", label: "Balanced" }]} />}>
        {opt.infeasible ? <Note tone="warn">{opt.candidates.length ? "No allocation satisfies your limits (max single-currency share, liquidity, FX ES, unhedged share). Relax a limit in Settings." : "Needs at least one complete, non-blocked route."}</Note> : (
          <>
            <Table>
              <thead><tr><Th>Portfolio</Th>{opt.candidates.map((c) => <Th key={c.key} right>{c.ccy}</Th>)}<Th right>Weighted cost</Th><Th right>Exact blended IRR</Th><Th right>Penalties</Th><Th right>Concentration (HHI)</Th></tr></thead>
              <tbody>
                {([["Lowest-cost", opt.lowestCost], ["Lowest-risk", opt.lowestRisk], ["Balanced", opt.balanced], [`Selected: ${st.objective.replace(/_/g, " ")}`, opt.selected]] as const).map(([name, al]) => al && (
                  <tr key={name} className="border-t border-border/60">
                    <Td><b>{name}</b></Td>
                    {opt.candidates.map((c) => <Td key={c.key} right mono>{(((al.weights[c.key] ?? 0)) * 100).toFixed(0)}%</Td>)}
                    <Td right mono>{pct(al.cost, 3)}</Td><Td right mono>{pct(al.exactIrr, 3)}</Td><Td right mono>{pct(al.penalty, 3)}</Td><Td right mono>{al.concentration.toFixed(2)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-2 text-[11px] text-text-dim">Each column is the best executable route for that starting currency ({opt.candidates.map((c) => c.label).join("; ")}). Allocations are in 5% steps, must sum to 100% and respect your limits (max {(eff.risk.maxSingleCurrencyShare * 100).toFixed(0)}% per currency, liquidity ≥ {eff.risk.minLiquidityScore}, FX ES ≤ {(eff.risk.maxFxEsPctOfNotional * 100).toFixed(0)}%). The blended IRR is computed from the summed cash flows, not from an average of rates. It never forces 100% into one currency.</div>
          </>
        )}
      </Card>

      <Card title="Tenor optimizer (uses the tenors you have entered quotes for)">
        <div className="mb-3 flex flex-wrap items-end gap-4">
          <Field label="Shortest tenor allowed"><Select value={st.tenorCons.minTenor} width="w-24" onChange={(v) => up((s) => (s.tenorCons.minTenor = v))} options={[{ value: 0, label: "any" }, ...TENORS.map((t) => ({ value: t, label: `${t}Y` }))]} /></Field>
          <Field label="Longest tenor allowed"><Select value={st.tenorCons.maxTenor} width="w-24" onChange={(v) => up((s) => (s.tenorCons.maxTenor = v))} options={[{ value: 99, label: "any" }, ...TENORS.map((t) => ({ value: t, label: `${t}Y` }))]} /></Field>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs"><span className="text-text-dim">INR alternative by tenor (else the single hurdle is used for every tenor):</span>{TENORS.map((t) => <span key={t} className="inline-flex items-center gap-1">{t}Y<NumInput value={eff.inrAlt.rateByTenor?.[String(t)] ?? null} unit="pct" suffix="%" width="w-14" onChange={(v) => up((s) => { const m = (s.inputs.inrAlt.rateByTenor ??= {}); if (v === null) delete m[String(t)]; else m[String(t)] = v; })} /></span>)}</div>
        {tc.points.length < 1 ? <div className="text-xs text-text-dim">Enter quotes for at least one tenor.</div> : (
          <Table>
            <thead><tr><Th>Tenor</Th><Th>Best route</Th><Th>Hedge</Th><Th right>Effective INR</Th><Th right>INR alternative</Th><Th right>Advantage</Th><Th>Status</Th></tr></thead>
            <tbody>
              {tc.points.map((pt) => (
                <tr key={pt.tenor} className={`border-t border-border/60 ${tc.best?.tenor === pt.tenor ? "bg-panel-raised" : ""}`}>
                  <Td mono>{pt.tenor}Y {tc.best?.tenor === pt.tenor ? <Tag tone="good">best</Tag> : null}</Td>
                  <Td mono>{pt.best?.label ?? "—"}</Td><Td>{pt.best?.instrument ?? "—"}</Td><Td right mono>{pct(pt.best?.effective)}</Td><Td right mono>{pct(pt.inrAlt)}</Td><Td right mono>{bpS(pt.best?.arbitrage)}</Td><Td>{pt.best ? <StatusPill s={pt.best.status as never} /> : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="mt-2 text-[11px] text-text-dim">Best currency, tenor, hedge and structure — only within your constraints and only for tenors where you entered real quotes. See the Sensitivity tab for the curves.</div>
      </Card>
    </>
  );
}
