"use client";

import { useMemo, useState } from "react";
import type { AppState } from "./state";
import { declareReal, stamp, tenorQuotes } from "./state";
import { Btn, Card, Field, NumInput, Note, QualityBadge, QualitySelect, AgeBadge, Select, Table, Td, Th, Tag } from "./ui";
import type { Analysis } from "@/lib/carry/analyze";
import type { Ccy, EdgeQuote, HedgeInstrument } from "@/lib/carry/types";
import type { LiveSnapshot } from "@/lib/carry/marketData";
import { LiveSnapshotProvider } from "@/lib/carry/marketData";
import { FUNDING_CCYS, INR, USD, benchmarkName, quoteDefinition } from "@/lib/carry/currencies";
import { edgeId, emptyEdge, emptyTenorQuotes, TENORS } from "@/lib/carry/defaults";
import { BP, fmtPct, isNum } from "@/lib/carry/units";
import { rfqText } from "@/lib/carry/report";

export interface PanelProps {
  st: AppState;
  up: (fn: (d: AppState) => void) => void;
  now: string;
  a: Analysis;
  live: LiveSnapshot | null;
}

const INR_LABELS = ["Bank loan", "INR bond", "CP", "NCD", "G-sec + spread", "Repo-linked", "MCLR-linked", "User-defined hurdle"];
const INSTRUMENTS: { value: HedgeInstrument; label: string }[] = [
  { value: "CCS", label: "Cross-currency swap (CCS)" },
  { value: "FX_FORWARD", label: "FX forward strip" },
  { value: "FX_SWAP", label: "FX swap" },
  { value: "NDF", label: "NDF" },
  { value: "OPTION", label: "Option (premium p.a.)" },
  { value: "COLLAR", label: "Collar (net cost p.a.)" },
  { value: "HEDGE_COST", label: "Hedge cost p.a. (as quoted)" },
];

function copyText(t: string) {
  try {
    void navigator.clipboard.writeText(t);
  } catch {
    /* clipboard blocked */
  }
}

/* ------------------------------ 1. the deal ------------------------------ */

export function DealPanel({ st, up }: PanelProps) {
  const inp = st.inputs;
  const d = inp.deal;
  return (
    <>
      <Card title="1 · What do you need?">
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <Field label="Funding requirement" hint="How much rupee funding you need. ₹500 Cr = 5,000,000,000.">
            <NumInput value={d.requirementInr} unit="cr" suffix="₹ crore" width="w-28" min={0.01} onChange={(v) => v !== null && up((s) => (s.inputs.deal.requirementInr = v))} />
          </Field>
          <Field label="Tenor" hint="Years. Quotes are entered per tenor in step 2.">
            <Select value={d.tenorYears} width="w-24" onChange={(v) => up((s) => { s.inputs.deal.tenorYears = v; s.editTenor = v; tenorQuotes(s, v); })} options={TENORS.map((t) => ({ value: t, label: `${t} years` }))} />
          </Field>
          <Field label="Drawdown / start date" hint="Used to pick the rule versions in force and to build the payment dates.">
            <input type="date" className="rounded border border-border bg-bg px-2 py-1 text-xs text-text" value={d.startDate} onChange={(e) => e.target.value && up((s) => { s.inputs.deal.startDate = e.target.value; s.inputs.reg.drawdownDate = e.target.value; })} />
          </Field>
          <Field label="Minimum saving you need" hint="A route only becomes EXECUTE if it beats your rupee alternative by at least this much, after costs.">
            <NumInput value={d.minSaving} unit="bp" suffix="bp" min={0} onChange={(v) => v !== null && up((s) => (s.inputs.deal.minSaving = v))} />
          </Field>
          <Field label="Share you will hedge" hint="100% = fully hedged (no currency risk). Anything below 100% leaves an open FX position, shown as risk.">
            <NumInput value={d.hedgeRatio} unit="pct" suffix="%" min={0} max={100} onChange={(v) => v !== null && up((s) => (s.inputs.deal.hedgeRatio = v))} />
          </Field>
        </div>
      </Card>

      <Card title="Your rupee alternative (the comparator)">
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <Field label="What would you otherwise use?" hint="Pick the correct comparator: the app never compares against the 10Y G-sec automatically.">
            <Select value={inp.inrAlt.label} width="w-44" onChange={(v) => up((s) => (s.inputs.inrAlt.label = v))} options={INR_LABELS.map((l) => ({ value: l, label: l }))} />
          </Field>
          <Field label="All-in INR rate you would pay" hint="Rate quoted by your domestic lender for the same tenor.">
            <NumInput value={inp.inrAlt.rate} unit="pct" suffix="% p.a." placeholder="e.g. 7.10" min={-5} max={60} onChange={(v) => up((s) => { s.inputs.inrAlt.rate = v; })} />
          </Field>
          <Field label="INR upfront fee" hint="% of principal (0 if none).">
            <NumInput value={inp.inrAlt.upfrontFeePct} unit="pct" suffix="%" min={0} onChange={(v) => up((s) => (s.inputs.inrAlt.upfrontFeePct = v ?? 0))} />
          </Field>
          <Field label="INR ongoing fee" hint="bp p.a.">
            <NumInput value={inp.inrAlt.ongoingFeeBp * BP} unit="bp" suffix="bp" min={0} onChange={(v) => up((s) => (s.inputs.inrAlt.ongoingFeeBp = (v ?? 0) / BP))} />
          </Field>
          <Field label="INR term swap rate (optional)" hint="Only used to split the hedge cost into interest-differential vs basis in the explanation.">
            <NumInput value={inp.inrAlt.benchmarkRate} unit="pct" suffix="%" onChange={(v) => up((s) => (s.inputs.inrAlt.benchmarkRate = v))} />
          </Field>
        </div>
      </Card>

      <Card title="Loan mechanics (both the foreign loan and the rupee alternative use these)">
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <Field label="Repayment">
            <Select value={d.amortisation} width="w-32" onChange={(v) => up((s) => (s.inputs.deal.amortisation = v))} options={[{ value: "bullet", label: "Bullet (at end)" }, { value: "equal", label: "Equal instalments" }]} />
          </Field>
          <Field label="Grace period (years)" hint="No principal repaid during grace.">
            <NumInput value={d.graceYears} unit="raw" suffix="y" min={0} max={d.tenorYears - 0.25} onChange={(v) => up((s) => (s.inputs.deal.graceYears = v ?? 0))} />
          </Field>
          <Field label="Interest paid" hint="Keep annual unless your loan says otherwise: the app reports an annual-effective rate.">
            <Select value={d.paymentFreq} width="w-32" onChange={(v) => up((s) => { s.inputs.deal.paymentFreq = v; s.inputs.inrAlt.freq = v; })} options={[{ value: 1, label: "Annually" }, { value: 2, label: "Half-yearly" }, { value: 4, label: "Quarterly" }, { value: 12, label: "Monthly" }]} />
          </Field>
          <Field label="Day count">
            <Select value={d.dayCount} width="w-28" onChange={(v) => up((s) => (s.inputs.deal.dayCount = v))} options={[{ value: "30/360", label: "30/360" }, { value: "ACT/360", label: "ACT/360" }, { value: "ACT/365", label: "ACT/365" }, { value: "ACT/ACT", label: "ACT/ACT" }]} />
          </Field>
          <Field label="Expected yearly drift of unhedged FX" hint="Only affects any share you leave unhedged. 0 = spot stays where it is.">
            <NumInput value={d.unhedgedDriftPa} unit="pct" suffix="% p.a." onChange={(v) => up((s) => (s.inputs.deal.unhedgedDriftPa = v ?? 0))} />
          </Field>
        </div>
      </Card>

      <OtherCostsAndTax st={st} up={up} />
    </>
  );
}

function OtherCostsAndTax({ st, up }: { st: AppState; up: PanelProps["up"] }) {
  const c = st.inputs.otherCosts;
  const t = st.inputs.tax;
  const cost = (label: string, key: keyof typeof c, hint?: string) => (
    <Field key={key} label={label} hint={hint}>
      <NumInput value={c[key]} unit="raw" suffix="₹" width="w-28" min={0} onChange={(v) => up((s) => (s.inputs.otherCosts[key] = v ?? 0))} />
    </Field>
  );
  return (
    <Card title="Other costs & tax (optional — leave at 0 to exclude)">
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-4">
        {cost("Legal / documentation (one-off)", "legalDocsInr")}
        {cost("ISDA / CSA legal (one-off)", "isdaCsaInr")}
        {cost("Registration / reporting (one-off)", "registrationInr")}
        {cost("Other one-off costs", "otherUpfrontInr")}
        {cost("Agency (per year)", "agencyAnnualInr")}
        {cost("Custody / account (per year)", "custodyAnnualInr")}
        {cost("Other yearly costs", "otherAnnualInr")}
      </div>
      <div className="mb-2 flex items-center gap-3 text-xs">
        <span className="text-text-dim">Tax treatment:</span>
        <Select value={t.mode} width="w-36" onChange={(v) => up((s) => (s.inputs.tax.mode = v))} options={[{ value: "excluded", label: "Tax excluded" }, { value: "included", label: "Tax included" }]} />
        <span className="text-[10px] text-text-dim">No tax rate is built in. Enter only rates you can source (treaty, circular, your tax adviser) and note the source.</span>
      </div>
      {t.mode === "included" && (
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <Field label="Withholding tax on interest (lender grosses up)" hint="Applies to interest paid to the foreign lender.">
            <NumInput value={t.whtRate} unit="pct" suffix="%" min={0} max={99} onChange={(v) => up((s) => (s.inputs.tax.whtRate = v ?? 0))} />
          </Field>
          <Field label="Source of that rate + date" hint="Required for audit: e.g. 'DTAA India-Singapore Art. 11, checked 21-Sep-2026'.">
            <input className="w-64 rounded border border-border bg-bg px-2 py-1 text-xs text-text" value={t.whtSource} onChange={(e) => up((s) => (s.inputs.tax.whtSource = e.target.value))} />
          </Field>
          <Field label="GST on fees">
            <NumInput value={t.gstOnFeesRate} unit="pct" suffix="%" min={0} onChange={(v) => up((s) => (s.inputs.tax.gstOnFeesRate = v ?? 0))} />
          </Field>
          <Field label="Stamp duty (% of principal)">
            <NumInput value={t.stampDutyPct} unit="pct" suffix="%" min={0} onChange={(v) => up((s) => (s.inputs.tax.stampDutyPct = v ?? 0))} />
          </Field>
          <Field label="Guarantee fee (bp p.a.)">
            <NumInput value={t.guaranteeFeeBpPa * BP} unit="bp" suffix="bp" min={0} onChange={(v) => up((s) => (s.inputs.tax.guaranteeFeeBpPa = (v ?? 0) / BP))} />
          </Field>
          <Field label="Interest tax shield" hint="Tax rate × share of interest that is deductible. Applied equally to the rupee alternative.">
            <NumInput value={t.interestShieldRate} unit="pct" suffix="%" min={0} max={100} onChange={(v) => up((s) => (s.inputs.tax.interestShieldRate = v ?? 0))} />
          </Field>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------- 2. the OTC quotes ---------------------------- */

const instrumentHelp: Record<HedgeInstrument, string> = {
  CCS: "Bank pays you the foreign floating rate (matching your loan); you pay a FIXED rate in the destination currency. Enter the fixed rate the bank quotes for the floating leg FLAT (bid = low side, offer = the side you pay).",
  FX_FORWARD: "Forward premium of the FROM currency against the TO currency, % per year. Positive means buying the foreign currency forward costs more than spot. Bid = low side, offer = the side you pay.",
  FX_SWAP: "Same as a forward strip: enter the annual forward premium (bid / offer).",
  NDF: "Same economics as a forward strip: enter the annual forward premium (bid / offer).",
  OPTION: "Enter the all-in option premium as % per year of notional (put it in Offer). Payoff asymmetry is not modelled.",
  COLLAR: "Enter the net collar cost as % per year of notional (in Offer). Payoff asymmetry is not modelled.",
  HEDGE_COST: "Enter the total hedge cost the dealer quotes as % per year, added on top of your foreign rate (in Offer).",
  RBI_SWAP: "",
};

export function QuotesPanel({ st, up, now, live, a }: PanelProps) {
  const inp = st.inputs;
  const tq = inp.quotesByTenor[String(st.editTenor)] ?? emptyTenorQuotes(now);
  const provider = useMemo(() => new LiveSnapshotProvider(live), [live]);
  const [newEdge, setNewEdge] = useState<{ from: Ccy; to: Ccy; instrument: HedgeInstrument }>({ from: "JPY", to: "EUR", instrument: "CCS" });
  const filledTenors = Object.entries(inp.quotesByTenor).filter(([, t]) => Object.values(t.lenders).some((l) => isNum(l.spread))).map(([k]) => Number(k));
  const allCcys: Ccy[] = [...FUNDING_CCYS, INR];

  return (
    <>
      <Note>
        <b>How this works:</b> phone or message 2–3 banks and ask for the quotes below (the <b>Guide</b> tab has a ready-made request you can copy). Type each number exactly as quoted, both sides where a bid/offer is given. The app then works out your real all-in rupee cost from actual cash flows, using the side of every quote that is <i>worse for you</i>. Nothing here is fetched or guessed: empty boxes stay empty and the route shows &ldquo;insufficient data&rdquo;.
      </Note>

      <Card title="Which tenor are you entering quotes for?" right={<Btn onClick={() => copyText(rfqText(inp, FUNDING_CCYS))} title="Copy a request-for-quotes you can paste into an email to your banks">Copy quote-request text</Btn>}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {TENORS.map((t) => {
            const filled = filledTenors.includes(t);
            return (
              <button key={t} onClick={() => up((s) => { s.editTenor = t; tenorQuotes(s, t); })} className={`rounded border px-3 py-1 ${st.editTenor === t ? "border-accent bg-accent text-[#061018]" : "border-border text-text-dim hover:text-text"}`}>
                {t}Y{filled ? " ✓" : ""}{inp.deal.tenorYears === t ? " · deal" : ""}
              </button>
            );
          })}
          {st.editTenor !== inp.deal.tenorYears && <Btn onClick={() => up((s) => (s.inputs.deal.tenorYears = s.editTenor))}>Analyse this tenor</Btn>}
          <span className="text-text-dim">Copy from:</span>
          <Select value={0} width="w-24" onChange={(v) => v && up((s) => { s.inputs.quotesByTenor[String(s.editTenor)] = structuredClone(s.inputs.quotesByTenor[String(v)]); })} options={[{ value: 0, label: "—" }, ...filledTenors.filter((t) => t !== st.editTenor).map((t) => ({ value: t, label: `${t}Y` }))]} />
          <span className="text-[10px] text-text-dim">(copying assumes the same rates — only do this to save typing, then overwrite)</span>
        </div>
        {st.editTenor !== inp.deal.tenorYears && <div className="mt-2 text-[11px] text-amber-400">You are editing {st.editTenor}Y quotes; the analysis below uses the deal tenor ({inp.deal.tenorYears}Y).</div>}
      </Card>

      <Card title="A · Spot exchange rates (dealer's two-way price)" right={live ? <Btn onClick={() => up((s) => { for (const sp of s.inputs.spots) { if (isNum(sp.bid) || isNum(sp.ask)) continue; const o = provider.getFxSpot(sp.base, sp.quote); if (o) { sp.bid = o.value; sp.ask = o.value; sp.meta = { source: "LIVE", quality: "C", asOf: o.publication_timestamp }; } } })} title="Fills EMPTY boxes with the ECB daily reference rate as a starting point. It is not a dealer price: the row is marked indicative until you replace it.">Prefill empty rows with live reference</Btn> : undefined}>
        <Table>
          <thead>
            <tr>
              <Th>Pair</Th>
              <Th>Means</Th>
              <Th right>Bid (bank buys)</Th>
              <Th right>Ask (bank sells)</Th>
              <Th>Quote type</Th>
              <Th>Age</Th>
              <Th right>Live reference</Th>
              <Th>Check</Th>
            </tr>
          </thead>
          <tbody>
            {inp.spots.map((sp, i) => {
              const lv = provider.getFxSpot(sp.base, sp.quote);
              const mid = isNum(sp.bid) && isNum(sp.ask) ? (sp.bid + sp.ask) / 2 : isNum(sp.bid) ? sp.bid : isNum(sp.ask) ? sp.ask : null;
              const diff = lv && mid ? ((mid - lv.value) / lv.value) * 100 : null;
              const bad = sp.bid !== null && sp.ask !== null && sp.bid > sp.ask;
              return (
                <tr key={`${sp.base}/${sp.quote}`} className="border-t border-border/60">
                  <Td mono>{sp.base}/{sp.quote}</Td>
                  <Td><span className="text-[10px] text-text-dim">{quoteDefinition(sp)}</span></Td>
                  <Td right><NumInput value={sp.bid} width="w-24" label={`${sp.base}/${sp.quote} bid`} onChange={(v) => up((s) => { s.inputs.spots[i].bid = v; s.inputs.spots[i].meta = stamp(s.inputs.spots[i].meta, now); })} /></Td>
                  <Td right><NumInput value={sp.ask} width="w-24" label={`${sp.base}/${sp.quote} ask`} onChange={(v) => up((s) => { s.inputs.spots[i].ask = v; s.inputs.spots[i].meta = stamp(s.inputs.spots[i].meta, now); })} /></Td>
                  <Td><QualitySelect meta={sp.meta} onDeclare={(q) => up((s) => (s.inputs.spots[i].meta = declareReal(s.inputs.spots[i].meta, q, now)))} /> <QualityBadge q={sp.meta.quality} source={sp.meta.source} /></Td>
                  <Td>{isNum(sp.bid) || isNum(sp.ask) ? <AgeBadge meta={sp.meta} nowIso={now} limitMin={inp.stale.fxSpotMin} /> : <span className="text-text-dim">—</span>}</Td>
                  <Td right mono>{lv ? lv.value.toFixed(lv.value < 5 ? 4 : 2) : "—"}</Td>
                  <Td>{bad ? <Tag tone="bad">bid above ask</Tag> : diff !== null && Math.abs(diff) > 0.3 && sp.meta.source !== "EXAMPLE" ? <Tag>DATA_CONFLICT {diff.toFixed(2)}%</Tag> : null}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <p className="mt-2 text-[10px] text-text-dim">If your bank quotes only one number, put it in both boxes; the executable calculation then has no spread cost to show. The live reference is the ECB daily fixing: indicative only, shown so you can spot a wrong dealer quote — your quote is never overwritten.</p>
      </Card>

      <Card title={`B · Lender quotes — ${st.editTenor}Y`}>
        <Table>
          <thead>
            <tr>
              <Th>Currency</Th>
              <Th right>Benchmark term swap rate</Th>
              <Th right>Lender spread</Th>
              <Th right>Upfront fee</Th>
              <Th right>Ongoing fee</Th>
              <Th>Loan type</Th>
              <Th>Quote type</Th>
              <Th>Age</Th>
              <Th right>Live ref. (short rate)</Th>
            </tr>
          </thead>
          <tbody>
            {FUNDING_CCYS.map((c) => {
              const l = tq.lenders[c];
              if (!l) return null;
              const lv = provider.getInterestCurve(c);
              const empty = !isNum(l.benchmarkRate) && !isNum(l.spread);
              return (
                <tr key={c} className="border-t border-border/60">
                  <Td mono><b>{c}</b> <span className="text-[10px] text-text-dim">{benchmarkName(c)}</span></Td>
                  <Td right><NumInput value={l.benchmarkRate} unit="pct" suffix="%" placeholder="e.g. 3.90" onChange={(v) => up((s) => { const x = tenorQuotes(s).lenders[c]; x.benchmarkRate = v; x.meta = stamp(x.meta, now); })} label={`${c} benchmark`} /></Td>
                  <Td right><NumInput value={l.spread} unit="bp" suffix="bp" placeholder="e.g. 85" min={0} onChange={(v) => up((s) => { const x = tenorQuotes(s).lenders[c]; x.spread = v; x.meta = stamp(x.meta, now); })} label={`${c} spread`} /></Td>
                  <Td right><NumInput value={l.upfrontFeePct} unit="pct" suffix="%" width="w-16" min={0} onChange={(v) => up((s) => { const x = tenorQuotes(s).lenders[c]; x.upfrontFeePct = v; x.meta = stamp(x.meta, now); })} label={`${c} upfront fee`} /></Td>
                  <Td right><NumInput value={l.ongoingFeeBp !== null ? l.ongoingFeeBp * BP : null} unit="bp" suffix="bp" width="w-16" min={0} onChange={(v) => up((s) => { const x = tenorQuotes(s).lenders[c]; x.ongoingFeeBp = v === null ? null : v / BP; x.meta = stamp(x.meta, now); })} label={`${c} ongoing fee`} /></Td>
                  <Td><Select value={l.structure} width="w-24" onChange={(v) => up((s) => (tenorQuotes(s).lenders[c].structure = v))} options={[{ value: "floating", label: "Floating" }, { value: "fixed", label: "Fixed" }]} /></Td>
                  <Td><QualitySelect meta={l.meta} onDeclare={(q) => up((s) => (tenorQuotes(s).lenders[c].meta = declareReal(tenorQuotes(s).lenders[c].meta, q, now)))} /></Td>
                  <Td>{empty ? <span className="text-text-dim">—</span> : <AgeBadge meta={l.meta} nowIso={now} limitMin={inp.stale.creditMin} />}</Td>
                  <Td right mono>{lv ? `${(lv.value * 100).toFixed(2)}%` : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <p className="mt-2 text-[10px] text-text-dim">
          <b>Benchmark term swap rate</b> = the {st.editTenor}-year swap rate of that currency&apos;s benchmark (e.g. USD {st.editTenor}Y SOFR swap) — your bank quotes it with the loan. <b>Lender spread</b> = the margin the lender adds. The live short-term rate on the right is only a sanity check: it is an overnight/3M rate, <i>not</i> a {st.editTenor}Y swap rate, so it is never used in the maths. Fill a currency&apos;s benchmark even if you will not borrow it directly, when it is a stop on a route (e.g. USD for JPY → USD → INR).
        </p>
      </Card>

      <Card title={`C · Hedge quotes (how each currency is converted) — ${st.editTenor}Y`}>
        <Table>
          <thead>
            <tr>
              <Th>Convert</Th>
              <Th>Instrument</Th>
              <Th right>Bid (low side)</Th>
              <Th right>Offer (you pay)</Th>
              <Th right>Dealer margin (one-off)</Th>
              <Th right>Collateral / CSA (p.a.)</Th>
              <Th>Quote type</Th>
              <Th>Age</Th>
              <Th right>Implied hedge cost</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {tq.edges.map((e, i) => {
              const bench = tq.lenders[e.from]?.benchmarkRate ?? null;
              const q = e.offer ?? e.bid;
              const implied = isNum(q) ? (e.instrument === "CCS" ? (isNum(bench) ? q - bench : null) : q) : null;
              const set = (fn: (x: EdgeQuote) => void) => up((s) => { const x = tenorQuotes(s).edges[i]; fn(x); x.meta = stamp(x.meta, now); });
              const unit = "pct" as const;
              return (
                <tr key={e.id} className="border-t border-border/60">
                  <Td mono>{e.from} → {e.to}</Td>
                  <Td>
                    <Select value={e.instrument} width="w-44" onChange={(v) => up((s) => { const x = tenorQuotes(s).edges[i]; x.instrument = v; x.id = edgeId(x.from, x.to, v); })} options={INSTRUMENTS} />
                  </Td>
                  <Td right><NumInput value={e.bid} unit={unit} suffix="%" placeholder={e.instrument === "CCS" ? `${e.to} fixed` : "% p.a."} onChange={(v) => set((x) => (x.bid = v))} label={`${e.from}→${e.to} bid`} /></Td>
                  <Td right><NumInput value={e.offer} unit={unit} suffix="%" placeholder={e.instrument === "CCS" ? `${e.to} fixed` : "% p.a."} onChange={(v) => set((x) => (x.offer = v))} label={`${e.from}→${e.to} offer`} /></Td>
                  <Td right><NumInput value={e.upfrontBp !== null ? e.upfrontBp * BP : null} unit="bp" suffix="bp" width="w-14" min={0} onChange={(v) => set((x) => (x.upfrontBp = v === null ? null : v / BP))} /></Td>
                  <Td right><NumInput value={e.ongoingBp !== null ? e.ongoingBp * BP : null} unit="bp" suffix="bp" width="w-14" min={0} onChange={(v) => set((x) => (x.ongoingBp = v === null ? null : v / BP))} /></Td>
                  <Td><QualitySelect meta={e.meta} onDeclare={(qq) => up((s) => (tenorQuotes(s).edges[i].meta = declareReal(tenorQuotes(s).edges[i].meta, qq, now)))} /></Td>
                  <Td>{isNum(e.bid) || isNum(e.offer) ? <AgeBadge meta={e.meta} nowIso={now} limitMin={inp.stale.hedgeMin} /> : <span className="text-text-dim">—</span>}</Td>
                  <Td right mono>{implied !== null ? fmtPct(implied) : "—"}</Td>
                  <Td>{!FUNDING_CCYS.includes(e.from) || (e.to !== INR && e.to !== USD) ? <button className="text-[10px] text-red-400 hover:underline" onClick={() => up((s) => { const t = tenorQuotes(s); t.edges.splice(i, 1); })}>remove</button> : null}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <div className="mt-3 space-y-1 text-[11px] text-text-dim">
          {[...new Set(tq.edges.map((e) => e.instrument))].map((i) => (
            <div key={i}><b className="text-text">{i}</b> — {instrumentHelp[i]}</div>
          ))}
          <div><b className="text-text">Implied hedge cost</b> = for a CCS, the fixed rate less that currency&apos;s benchmark swap rate; for forwards/options, the quoted annual cost. A bigger number means the hedge eats more of the saving.</div>
          <div>The route <b>JPY → USD → INR</b> uses two rows: <b>JPY → USD</b> (USD fixed rate against JPY floating flat) and <b>USD → INR</b>. The app compares it with the direct <b>JPY → INR</b> row and with borrowing USD directly.</div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
          <span className="text-text-dim">Add another quote (e.g. JPY → EUR, or an FX forward for USD → INR):</span>
          <Select value={newEdge.from} width="w-20" onChange={(v) => setNewEdge((n) => ({ ...n, from: v }))} options={allCcys.filter((c) => c !== INR).map((c) => ({ value: c, label: c }))} />
          <span>→</span>
          <Select value={newEdge.to} width="w-20" onChange={(v) => setNewEdge((n) => ({ ...n, to: v }))} options={allCcys.map((c) => ({ value: c, label: c }))} />
          <Select value={newEdge.instrument} width="w-48" onChange={(v) => setNewEdge((n) => ({ ...n, instrument: v }))} options={INSTRUMENTS} />
          <Btn disabled={newEdge.from === newEdge.to || tq.edges.some((e) => e.id === edgeId(newEdge.from, newEdge.to, newEdge.instrument))} onClick={() => up((s) => { tenorQuotes(s).edges.push(emptyEdge(newEdge.from, newEdge.to, newEdge.instrument, now)); })}>Add</Btn>
        </div>
      </Card>

      <Card title="D · Quote freshness">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Btn onClick={() => up((s) => { for (const p of s.inputs.spots) if (p.meta.source === "USER_INPUT") p.meta.asOf = now; for (const t of Object.values(s.inputs.quotesByTenor)) { for (const l of Object.values(t.lenders)) if (l.meta.source === "USER_INPUT") l.meta.asOf = now; for (const e of t.edges) if (e.meta.source === "USER_INPUT") e.meta.asOf = now; } })} title="Only press this if the quotes you typed are current right now.">Stamp all my typed quotes as &ldquo;quoted just now&rdquo;</Btn>
          <span className="text-text-dim">Stale limits (minutes): spot <NumInput value={inp.stale.fxSpotMin} width="w-14" onChange={(v) => v !== null && up((s) => (s.inputs.stale.fxSpotMin = v))} /> · hedge <NumInput value={inp.stale.hedgeMin} width="w-14" onChange={(v) => v !== null && up((s) => (s.inputs.stale.hedgeMin = v))} /> · lender <NumInput value={inp.stale.creditMin} width="w-14" onChange={(v) => v !== null && up((s) => (s.inputs.stale.creditMin = v))} /></span>
          <span className="text-[10px] text-text-dim">A route can never show EXECUTE on stale or non-firm quotes. {a.routes.filter((r) => r.quality.stale.length).length} route(s) currently have stale inputs.</span>
        </div>
      </Card>
    </>
  );
}

