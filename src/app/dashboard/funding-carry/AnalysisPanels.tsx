"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { selectedRoute, type ResultProps } from "./ResultPanels";
import { Btn, Card, Field, NumInput, Note, Select, StatusPill, Table, Tag, Td, Th } from "./ui";
import { HBars, LineChart, PALETTE, heatStyle } from "./charts";
import { bpS, bpU, cr, pct, spreadText } from "./fmt";
import { evalDirectLoan, evalInrAlternative, evalRoute } from "@/lib/carry/evaluate";
import { enumerateRoutes } from "@/lib/carry/routes";
import { reverseFor, sensitivityGrid, type Dim } from "@/lib/carry/reverse";
import { answerReverse, compareScenario, emptyScenario, isEmptyScenario, parseQuestion, solveBeat, type ParsedQuery, type Scenario } from "@/lib/carry/scenario";
import { riskBreakdown, stressTable, PENALTY } from "@/lib/carry/risk";
import { tenorCurves } from "@/lib/carry/portfolio";
import { detectRegime } from "@/lib/carry/marketData";
import { FUNDING_CCYS, INR, USD } from "@/lib/carry/currencies";
import { BP, bisect, isNum } from "@/lib/carry/units";
import { analyze } from "@/lib/carry/analyze";
import { TENORS } from "@/lib/carry/defaults";

/* --------------------------------- reverse --------------------------------- */

export function ReversePanel(p: ResultProps) {
  const { a, eff } = p;
  const r = selectedRoute(a, p.selectedId);
  const dr = useDeferredValue(r);
  const rv = useMemo(() => (dr?.exec ? reverseFor(eff, dr.route) : null), [eff, dr]);
  const others = useMemo(() => {
    if (!dr?.exec) return [];
    const best = new Map<string, (typeof a.routes)[number]>();
    for (const x of a.routes) {
      if (!x.exec || x.usesRbi || x.start === dr.start) continue;
      const c = best.get(x.start);
      if (!c || (x.exec.effective < (c.exec?.effective ?? 9))) best.set(x.start, x);
    }
    return [...best.values()].map((o) => {
      const parityOther = solveBeat(eff, o.start, dr.start);
      const parityMine = solveBeat(eff, dr.start, o.start);
      const f = (x: number) => {
        const v = evalRoute(eff, o.route, "exec", { basisBp: x });
        return v.irr === null ? NaN : (dr.exec?.effective ?? 0) - v.irr;
      };
      const hb = bisect(f, -3000, 3000, 1e-10, 100);
      return { o, parityOther, parityMine, hedgeShiftBp: hb };
    });
  }, [eff, dr, a]);
  if (!r || !r.exec) return <Note tone="warn">Select a complete route on the Radar tab first.</Note>;
  if (!rv || !rv.ok) return <Note tone="warn">{rv?.reason ?? "Cannot solve this route yet."}</Note>;
  const e = r.explain;
  const maxEff = eff.inrAlt.rate !== null ? (r.exec.inrAlt - eff.deal.minSaving) : null;
  const other = e ? e.effective - e.fcyFundingCost : 0;
  const additiveMaxCoupon = maxEff !== null ? maxEff - other : null;
  return (
    <>
      <Note>
        <b>Question 1 — What is cheapest right now?</b> {a.best ? `${a.best.label} at ${pct(a.best.exec?.effective)} (${bpS(a.best.exec?.arbitrage)} vs your rupee alternative).` : "—"}
        <br /><b>Question 2 — At what rate does it stop being cheap?</b> The thresholds below are solved backwards through the full cash-flow model for <b>{r.label}</b>.
        <br /><b>Question 3 — What market change makes another currency cheaper?</b> See the last table.
      </Note>

      <Card title={`Thresholds for ${r.label} — the saving stays at least ${bpU(eff.deal.minSaving)} until…`}>
        <Table>
          <thead><tr><Th>Threshold</Th><Th right>Today</Th><Th right>Limit</Th><Th right>Room left</Th><Th>Meaning</Th></tr></thead>
          <tbody>
            <tr className="border-t border-border/60">
              <Td>Maximum lender spread</Td>
              <Td right mono>{spreadText(r.start, rv.maxSpread?.current)}</Td>
              <Td right mono>{rv.maxSpread ? spreadText(r.start, rv.maxSpread.max) : "cannot reach"}</Td>
              <Td right mono>{rv.maxSpread ? bpS(rv.maxSpread.headroom) : "—"}</Td>
              <Td><span className="text-text-dim">Above this the lender is too expensive. All-in foreign coupon at the limit: {pct(rv.maxSpread?.benchmarkPlusSpread)}.</span></Td>
            </tr>
            <tr className="border-t border-border/60">
              <Td>Maximum total hedge cost</Td>
              <Td right mono>{pct(rv.maxHedgeCost?.current)}</Td>
              <Td right mono>{pct(rv.maxHedgeCost?.max)}</Td>
              <Td right mono>{rv.maxHedgeCost ? bpS(rv.maxHedgeCost.headroom) : "—"}</Td>
              <Td><span className="text-text-dim">{rv.maxHedgeCost ? `You can tolerate another ${(rv.maxHedgeCost.headroom / BP).toFixed(0)} bp of hedge-cost deterioration before the arbitrage disappears.` : "—"}</span></Td>
            </tr>
            {rv.edges.map((x) => (
              <tr key={x.edgeId} className="border-t border-border/60">
                <Td>Maximum {x.label} quote (basis headroom)</Td>
                <Td right mono>{pct(x.current)}</Td>
                <Td right mono>{pct(x.max)}</Td>
                <Td right mono>{bpS(x.headroom)}</Td>
                <Td><span className="text-text-dim">The worst dealer quote you can accept on this leg.</span></Td>
              </tr>
            ))}
            <tr className="border-t border-border/60">
              <Td>Break-even INR alternative</Td>
              <Td right mono>{pct(eff.inrAlt.rate)}</Td>
              <Td right mono>{pct(rv.breakEvenInr)}</Td>
              <Td right mono>{rv.breakEvenInr !== null && eff.inrAlt.rate !== null ? bpS(rv.breakEvenInr - eff.inrAlt.rate) : "—"}</Td>
              <Td><span className="text-text-dim">If your rupee alternative falls below this, the saving is lost{rv.breakEvenInrZero !== null ? ` (arbitrage is zero at ${pct(rv.breakEvenInrZero)})` : ""}.</span></Td>
            </tr>
            <tr className="border-t border-border/60">
              <Td>Break-even spread for zero arbitrage</Td>
              <Td right mono>{spreadText(r.start, rv.maxSpread?.current)}</Td>
              <Td right mono>{spreadText(r.start, rv.breakEvenSpread)}</Td>
              <Td right mono>{rv.breakEvenSpread !== null && rv.maxSpread ? bpS(rv.breakEvenSpread - rv.maxSpread.current) : "—"}</Td>
              <Td><span className="text-text-dim">Beyond this it costs more than your rupee alternative even ignoring your minimum saving.</span></Td>
            </tr>
            <tr className="border-t border-border/60">
              <Td>Break-even funding amount</Td>
              <Td right mono>{cr(eff.deal.requirementInr)}</Td>
              <Td right mono>{rv.breakEvenAmountInr !== null ? cr(rv.breakEvenAmountInr) : "n/a"}</Td>
              <Td right mono>—</Td>
              <Td><span className="text-text-dim">{rv.breakEvenAmountInr !== null ? "Smallest size at which fixed legal / ISDA / agency costs no longer wipe out the saving." : "Only matters if you entered fixed rupee costs in step 1."}</span></Td>
            </tr>
            <tr className="border-t border-border/60">
              <Td>Break-even tenor (today&apos;s quotes held constant)</Td>
              <Td right mono>{eff.deal.tenorYears}Y</Td>
              <Td right mono>{rv.breakEvenTenor !== null ? `${rv.breakEvenTenor.toFixed(1)}Y` : "n/a"}</Td>
              <Td right mono>—</Td>
              <Td><span className="text-text-dim">Upfront costs amortise over tenor; this shows how the saving changes with length if quotes stayed the same.</span></Td>
            </tr>
          </tbody>
        </Table>
        {additiveMaxCoupon !== null && rv.maxSpread && (
          <div className="mt-3 rounded border border-border p-2 text-[11px] text-text-dim">
            Cross-check with the simple formula <span className="gfew-mono">R<sub>FCY,max</sub> = INR hurdle − min arbitrage − (hedge + fees + other)</span>: {pct(r.exec.inrAlt)} − {pct(eff.deal.minSaving)} − {pct(other)} = <b className="gfew-mono text-text">{pct(additiveMaxCoupon)}</b> maximum foreign coupon; the full cash-flow solve gives <b className="gfew-mono text-text">{pct(rv.maxSpread.benchmarkPlusSpread)}</b>. Small differences are real compounding/timing effects, which is why the app solves the actual cash flows.
          </div>
        )}
      </Card>

      <Card title="What would change the answer? (automatic)">
        <p className="mb-2 text-xs text-text-dim"><b className="text-text">{r.label} loses its advantage if…</b></p>
        <ol className="list-decimal space-y-1 pl-5 text-xs">
          <li>The lender spread rises above <b className="gfew-mono">{spreadText(r.start, rv.maxSpread?.max)}</b></li>
          <li>The effective hedge cost rises above <b className="gfew-mono">{pct(rv.maxHedgeCost?.max)}</b></li>
          <li>Your INR alternative falls below <b className="gfew-mono">{pct(rv.breakEvenInr)}</b></li>
          {r.usesRbi ? <li>The RBI concession becomes unavailable — the same route at market hedge prices would cost {e?.rbiBenefit != null ? <b className="gfew-mono">{bpU(e.rbiBenefit)} more</b> : "more"} (regulatory carry, not market arbitrage)</li> : <li>An RBI concession is not part of this route; if you later qualify for one the picture can improve.</li>}
          <li>Regulatory eligibility changes: status today is <b>{r.regulatory.replace(/_/g, " ")}</b> — see the Regulatory tab (rules are versioned by date)</li>
          <li>Any quote goes stale: quotes older than {eff.stale.hedgeMin} min (hedge) / {eff.stale.creditMin} min (lender) drop the route out of EXECUTE</li>
        </ol>
      </Card>

      <Card title="What market change would make another currency cheaper?">
        {!others.length ? <div className="text-xs text-text-dim">Enter complete quotes for a second currency to compare.</div> : (
          <Table>
            <thead><tr><Th>Alternative</Th><Th right>Its cost today</Th><Th right>Gap to {r.start}</Th><Th>It becomes cheaper if…</Th></tr></thead>
            <tbody>
              {others.map(({ o, parityOther, parityMine, hedgeShiftBp }) => (
                <tr key={o.id} className="border-t border-border/60 align-top">
                  <Td mono>{o.label}</Td>
                  <Td right mono>{pct(o.exec?.effective)}</Td>
                  <Td right mono>{bpS((o.exec?.effective ?? 0) - (r.exec?.effective ?? 0))}</Td>
                  <Td>
                    <ul className="space-y-0.5 text-[11px] text-text-dim">
                      {parityOther.spread !== null && <li>its lender spread ≤ <b className="gfew-mono text-text">{spreadText(o.start, parityOther.spread)}</b> (today {spreadText(o.start, parityOther.current)})</li>}
                      {hedgeShiftBp !== null && <li>its hedge quote falls by <b className="gfew-mono text-text">{Math.abs(hedgeShiftBp).toFixed(0)} bp</b>{hedgeShiftBp > 0 ? " (rises — it would still be cheaper)" : ""}</li>}
                      {parityMine.spread !== null && <li>or {r.start} lender spread rises to <b className="gfew-mono text-text">{spreadText(r.start, parityMine.spread)}</b></li>}
                    </ul>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

/* --------------------------------- scenario --------------------------------- */

const EXAMPLES = ["What if USD borrowing spread rises by 50 bp?", "What if INR rates fall by 75 bp?", "What if USD/INR goes to 100?", "What if JPY/INR basis widens by 30 bp?", "What if RBI swap facility disappears?", "What if I hedge only 75%?", "What if the tenor becomes 7 years?", "What is the maximum USD spread I can pay?", "What USD rate do I need to beat EUR?", "What JPY spread makes JPY cheaper than USD?", "How much hedge-cost increase can I tolerate?", "What INR yield would eliminate the USD arbitrage?"];

export function ScenarioPanel(p: ResultProps) {
  const { st, up, a } = p;
  const inp = st.inputs;
  const sc = st.scenario;
  const [q, setQ] = useState("");
  const [parsed, setParsed] = useState<ParsedQuery | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const cmp = useMemo(() => (parsed?.kind === "scenario" ? compareScenario(inp, parsed.scenario) : null), [parsed, inp]);
  const liveCcys = FUNDING_CCYS.filter((c) => isNum(inp.quotesByTenor[String(inp.deal.tenorYears)]?.lenders[c]?.spread));
  const set = (fn: (s: Scenario) => void) => up((d) => fn(d.scenario));
  const run = (text: string) => {
    const pq = parseQuestion(text);
    setParsed(pq);
    if (pq.kind === "beat") {
      const r = solveBeat(inp, pq.a, pq.b);
      setAnswer(r.spread !== null ? `${r.note} All-in ${pq.a} coupon at parity: ${pct(r.rate)} (${pq.b}'s best executable cost is ${pct(r.bestB)}).` : r.note);
    } else if (pq.kind === "reverse") setAnswer(answerReverse(inp, pq, analyze(inp)).text);
    else setAnswer(null);
  };
  return (
    <>
      <Note tone="warn"><b>Scenario mode never changes your live / OTC quotes.</b> It works on a copy in which every quote is relabelled SCENARIO, so nothing computed here can be an EXECUTE signal. Switch it on to see the whole app under the scenario.</Note>
      <Card title="Ask in plain English (deterministic — the sentence is turned into scenario variables and the exact same model is re-run)">
        <div className="flex flex-wrap items-center gap-2">
          <input className="min-w-[22rem] flex-1 rounded border border-border bg-bg px-3 py-2 text-xs text-text outline-none focus:border-accent" placeholder='e.g. "What if USD borrowing spread rises by 50 bp?"' value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(q)} />
          <Btn kind="primary" onClick={() => run(q)}>Run</Btn>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">{EXAMPLES.map((x) => <button key={x} className="rounded border border-border px-2 py-0.5 text-[10px] text-text-dim hover:text-text" onClick={() => { setQ(x); run(x); }}>{x}</button>)}</div>
        {parsed?.kind === "unparsed" && <Note tone="warn">Could not understand that. {parsed.hint}</Note>}
        {answer && <Note tone="good">{answer}</Note>}
        {parsed?.kind === "scenario" && cmp && (
          <div className="mt-3">
            <div className="mb-1 text-xs">Assumptions used: {parsed.notes.map((n) => <Tag key={n} tone="info">{n}</Tag>)}</div>
            <Table>
              <thead><tr><Th>Route</Th><Th right>Effective before</Th><Th right>Effective after</Th><Th right>Advantage before</Th><Th right>Advantage after</Th><Th>Status</Th></tr></thead>
              <tbody>
                {cmp.rows.filter((r) => r.before !== null || r.after !== null).map((r) => (
                  <tr key={r.label} className="border-t border-border/60">
                    <Td mono>{r.label}</Td><Td right mono>{pct(r.before)}</Td><Td right mono>{pct(r.after)}</Td><Td right mono>{bpS(r.beforeArb)}</Td><Td right mono>{bpS(r.afterArb)}</Td><Td><span className="text-[10px] text-text-dim">{r.beforeStatus} → {r.afterStatus}</span></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-2 flex gap-2"><Btn onClick={() => up((d) => { d.scenario = parsed.scenario; d.scenarioOn = true; })}>Apply this scenario to the whole app</Btn><Btn onClick={() => setParsed(null)}>Dismiss</Btn></div>
            {parsed.notes.some((n) => n.includes("locks the conversion")) && <div className="mt-2 text-[11px] text-text-dim">A fully hedged structure fixes the conversion at inception, so a spot move changes nothing for the hedged share — that is correct, not a bug. Set the hedge ratio below 100% to see the exposure.</div>}
          </div>
        )}
      </Card>

      <Card title="Scenario lab — all outputs update immediately" right={<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={st.scenarioOn} onChange={(e) => up((d) => (d.scenarioOn = e.target.checked))} /> <b>{st.scenarioOn ? "SCENARIO MODE IS ON for the whole app" : "Run the whole app in scenario mode"}</b></label>}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold">Lender spread change (bp)</div>
            <div className="flex flex-wrap gap-3">{liveCcys.length ? liveCcys.map((c) => <Field key={c} label={c}><NumInput value={(sc.spreadShiftBp[c] ?? 0) * BP} unit="bp" suffix="bp" width="w-16" onChange={(v) => set((s) => { if (v === null || v === 0) delete s.spreadShiftBp[c]; else s.spreadShiftBp[c] = v / BP; })} /></Field>) : <span className="text-xs text-text-dim">Enter lender quotes first.</span>}</div>
            <div className="mb-1 mt-3 text-xs font-semibold">Hedge cost / CCS basis change (bp)</div>
            <div className="flex flex-wrap gap-3">
              <Field label="All hedge quotes"><NumInput value={sc.hedgeShiftBp * BP} unit="bp" suffix="bp" width="w-16" onChange={(v) => set((s) => (s.hedgeShiftBp = (v ?? 0) / BP))} /></Field>
              {liveCcys.filter((c) => c !== INR).map((c) => <Field key={c} label={`${c} legs`}><NumInput value={(sc.hedgeShiftByCcyBp[c] ?? 0) * BP} unit="bp" suffix="bp" width="w-16" onChange={(v) => set((s) => { if (v === null || v === 0) delete s.hedgeShiftByCcyBp[c]; else s.hedgeShiftByCcyBp[c] = v / BP; })} /></Field>)}
            </div>
          </div>
          <div>
            <div className="flex flex-wrap gap-3">
              <Field label="INR alternative change (bp)"><NumInput value={sc.inrRateShiftBp * BP} unit="bp" suffix="bp" width="w-16" onChange={(v) => set((s) => (s.inrRateShiftBp = (v ?? 0) / BP))} /></Field>
              <Field label="USD/INR spot (mid) override"><NumInput value={sc.spotOverride["USD/INR"] ?? null} width="w-20" onChange={(v) => set((s) => { if (v === null) delete s.spotOverride["USD/INR"]; else s.spotOverride["USD/INR"] = v; })} /></Field>
              <Field label="Hedge ratio"><NumInput value={sc.hedgeRatio} unit="pct" suffix="%" width="w-16" min={0} max={100} onChange={(v) => set((s) => (s.hedgeRatio = v))} /></Field>
              <Field label="Tenor"><Select value={sc.tenorYears ?? 0} width="w-24" onChange={(v) => set((s) => (s.tenorYears = v === 0 ? null : v))} options={[{ value: 0, label: "as deal" }, ...TENORS.map((t) => ({ value: t, label: `${t}Y` }))]} /></Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={sc.rbiOff} onChange={(e) => set((s) => (s.rbiOff = e.target.checked))} /> RBI concessional swap not available</label>
            <div className="mt-3 flex gap-2"><Btn onClick={() => up((d) => { d.scenario = emptyScenario(); d.scenarioOn = false; })}>Reset scenario</Btn>{isEmptyScenario(sc) && st.scenarioOn && <Tag>no changes set</Tag>}</div>
          </div>
        </div>
        {st.scenarioOn && <div className="mt-3 text-xs text-text-dim">Best structure in scenario mode: <b className="text-text">{a.best?.label ?? "—"}</b> {a.best?.exec ? `at ${pct(a.best.exec.effective)} (${bpS(a.best.exec.arbitrage)})` : ""} <StatusPill s={a.best?.status ?? "INSUFFICIENT_DATA"} /></div>}
      </Card>
    </>
  );
}

/* ------------------------------- sensitivity ------------------------------- */

const DIMS: { id: Dim; label: string; unit: string; step: number }[] = [
  { id: "spread", label: "Lender spread", unit: "bp", step: 25 },
  { id: "hedge", label: "Hedge cost (last leg)", unit: "bp", step: 25 },
  { id: "inr", label: "INR alternative rate", unit: "bp", step: 25 },
  { id: "basis", label: "FX basis shock (all legs)", unit: "bp", step: 25 },
  { id: "tenor", label: "Tenor", unit: "y", step: 1 },
];

function axisValues(inp: ResultProps["eff"], route: NonNullable<ReturnType<typeof selectedRoute>>, dim: Dim, stepBp: number, n = 5): number[] {
  const tq = inp.quotesByTenor[String(inp.deal.tenorYears)];
  const half = Math.floor(n / 2);
  const make = (center: number, unitStep: number) => Array.from({ length: n }, (_, i) => center + (i - half) * unitStep);
  if (dim === "spread") {
    const s0 = tq?.lenders[route.start]?.spread ?? 0.01;
    return make(s0, stepBp * BP).map((v) => Math.max(0, v));
  }
  if (dim === "hedge") {
    const e = route.route.edges[route.route.edges.length - 1];
    const q = e ? (e.offer ?? e.bid ?? 0) : 0;
    const b = e && e.instrument === "CCS" ? (tq?.lenders[e.from]?.benchmarkRate ?? 0) : 0;
    return make(q - b, stepBp * BP);
  }
  if (dim === "inr") return make(inp.inrAlt.rate ?? 0.07, stepBp * BP);
  if (dim === "basis") return make(0, stepBp * BP);
  return [1, 2, 3, 5, 7, 10];
}

export function SensitivityPanel(p: ResultProps) {
  const { a, eff } = p;
  const r = selectedRoute(a, p.selectedId);
  const [xDim, setX] = useState<Dim>("hedge");
  const [yDim, setY] = useState<Dim>("spread");
  const [step, setStep] = useState(25);
  const [uFrom, setUFrom] = useState("JPY");
  const grid = useMemo(() => {
    if (!r?.exec || xDim === yDim) return null;
    const xs = axisValues(eff, r, xDim, step);
    const ys = axisValues(eff, r, yDim, step);
    return sensitivityGrid(eff, r.route, xDim, xs, yDim, ys);
  }, [eff, r, xDim, yDim, step]);
  const hurdle = eff.deal.minSaving;
  const fmtAxis = (dim: Dim, v: number) => (dim === "tenor" ? `${v}Y` : dim === "basis" ? `${(v / BP >= 0 ? "+" : "")}${(v / BP).toFixed(0)} bp` : dim === "spread" ? `${(v / BP).toFixed(0)} bp` : pct(v));
  const curves = useMemo(() => tenorCurves(eff), [eff]);
  const carrySurface = useMemo(() => {
    const per = new Map<string, NonNullable<typeof r>>();
    for (const x of a.routes) if (x.exec && !x.usesRbi && (!per.has(x.start) || x.exec.effective < (per.get(x.start)?.exec?.effective ?? 9))) per.set(x.start, x);
    const shifts = [-50, -25, 0, 25, 50, 100, 150];
    return { shifts, rows: [...per.values()].map((x) => ({ x, cells: shifts.map((s) => { const o = evalRoute(eff, x.route, "exec", { spreadBp: s }); return o.irr; }) })) };
  }, [eff, a.routes]);
  const usdGrid = useMemo(() => {
    const tq = eff.quotesByTenor[String(eff.deal.tenorYears)];
    const l = tq?.lenders[uFrom];
    const routes = enumerateRoutes(eff, { target: USD }).filter((x) => x.start === uFrom && x.edges.length === 1);
    const spec = routes[0];
    if (!l || !isNum(l.spread) || !spec) return null;
    const e = spec.edges[0];
    const q0 = e.offer ?? e.bid;
    if (!isNum(q0)) return null;
    const direct = evalDirectLoan(eff, USD).irr;
    if (direct === null) return null;
    const sp = [-50, -25, 0, 25, 50].map((d) => l.spread! + d * BP);
    const ed = [-50, -25, 0, 25, 50].map((d) => q0 + d * BP);
    const z = ed.map((ev) => sp.map((sv) => {
      const i2 = structuredClone(eff);
      const t2 = i2.quotesByTenor[String(i2.deal.tenorYears)];
      t2.lenders[uFrom].spread = Math.max(0, sv);
      const e2 = t2.edges.find((x) => x.id === e.id);
      if (e2) { e2.bid = ev; e2.offer = ev; }
      const o = evalRoute(i2, spec, "exec", {}, USD);
      const d2 = evalDirectLoan(i2, USD).irr;
      return o.irr !== null && d2 !== null ? d2 - o.irr : null;
    }));
    return { sp, ed, z, direct };
  }, [eff, uFrom]);
  const hedgeCurve = useMemo(() => {
    if (!r?.exec) return [] as { x: number; y: number }[];
    const e = r.route.edges[r.route.edges.length - 1];
    const q = e ? (e.offer ?? e.bid ?? 0) : 0;
    const b = e && e.instrument === "CCS" ? (eff.quotesByTenor[String(eff.deal.tenorYears)]?.lenders[e.from]?.benchmarkRate ?? 0) : 0;
    const cur = q - b;
    const pts: { x: number; y: number }[] = [];
    for (let h = 0; h <= 0.04001; h += 0.005) {
      const o = evalRoute(eff, r.route, "exec", { basisBp: (h - cur) / BP, basisEdgeId: e?.id });
      if (o.irr !== null) pts.push({ x: h, y: o.irr });
    }
    return pts;
  }, [eff, r]);
  if (!r?.exec) return <Note tone="warn">Select a complete route on the Radar tab first.</Note>;
  const fwdEdge = r.route.edges.find((e) => e.instrument === "FX_FORWARD" || e.instrument === "FX_SWAP" || e.instrument === "NDF");
  const spotMid = fwdEdge ? (() => { const s = eff.spots.find((x) => x.base === fwdEdge.from && x.quote === fwdEdge.to); return s && isNum(s.bid) && isNum(s.ask) ? (s.bid + s.ask) / 2 : null; })() : null;
  return (
    <>
      <Card title={`Two-way sensitivity of the advantage (bp) — ${r.label}`}>
        <div className="mb-3 flex flex-wrap items-end gap-4">
          <Field label="Across"><Select value={xDim} width="w-48" onChange={(v) => setX(v)} options={DIMS.map((d) => ({ value: d.id, label: d.label }))} /></Field>
          <Field label="Down"><Select value={yDim} width="w-48" onChange={(v) => setY(v)} options={DIMS.map((d) => ({ value: d.id, label: d.label }))} /></Field>
          <Field label="Step (bp)"><NumInput value={step * BP} unit="bp" suffix="bp" width="w-16" min={1} onChange={(v) => v && setStep(v / BP)} /></Field>
        </div>
        {xDim === yDim ? <Note tone="warn">Pick two different dimensions.</Note> : grid && (
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead><tr><th className="px-2 py-1 text-left text-[10px] text-text-dim">{DIMS.find((d) => d.id === yDim)?.label} ↓ / {DIMS.find((d) => d.id === xDim)?.label} →</th>{grid.xs.map((x) => <th key={x} className="gfew-mono px-2 py-1 text-right text-[10px] text-text-dim">{fmtAxis(xDim, x)}</th>)}</tr></thead>
              <tbody>
                {grid.ys.map((y, yi) => (
                  <tr key={y}>
                    <td className="gfew-mono px-2 py-1 text-[10px] text-text-dim">{fmtAxis(yDim, y)}</td>
                    {grid.xs.map((x, xi) => {
                      const v = grid.z[yi][xi];
                      const right = grid.z[yi][xi + 1];
                      const below = grid.z[yi + 1]?.[xi];
                      const cross = (o: number | null | undefined) => v !== null && o !== null && o !== undefined && (v >= hurdle) !== (o >= hurdle);
                      const zero = (o: number | null | undefined) => v !== null && o !== null && o !== undefined && (v >= 0) !== (o >= 0);
                      const st = heatStyle(v, hurdle);
                      return (
                        <td key={x} className="gfew-mono px-2 py-1 text-right" style={{ ...st, borderRight: cross(right) ? "3px solid #ffffff" : zero(right) ? "2px dashed #ffffff99" : "1px solid #0a0e14", borderBottom: cross(below) ? "3px solid #ffffff" : zero(below) ? "2px dashed #ffffff99" : "1px solid #0a0e14" }}>
                          {v === null ? "n/a" : `${v / BP >= 0 ? "+" : ""}${(v / BP).toFixed(0)}`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-text-dim">
          <span><span className="inline-block h-2 w-3 align-middle" style={{ background: "#34c08555" }} /> at or above your minimum saving (VIABLE)</span>
          <span><span className="inline-block h-2 w-3 align-middle" style={{ background: "#e0b93d44" }} /> positive but below minimum (MARGINAL)</span>
          <span><span className="inline-block h-2 w-3 align-middle" style={{ background: "#e05a4d55" }} /> negative (NOT VIABLE)</span>
          <span>solid white line = break-even boundary (advantage = your minimum) · dashed = zero-arbitrage boundary</span>
        </div>
      </Card>

      <Card title="Hedge-cost sensitivity — effective INR cost as the last hedge leg gets dearer">
        <LineChart series={[{ name: "Effective INR", color: PALETTE[0], points: hedgeCurve }, { name: "INR alternative", color: PALETTE[1], dash: "4 3", points: hedgeCurve.map((q) => ({ x: q.x, y: r.exec?.inrAlt ?? 0 })) }]} xLabel="hedge cost p.a. of the last leg" yFmt={(v) => pct(v, 1)} xFmt={(v) => pct(v, 1)} />
        <div className="text-[10px] text-text-dim">Where the two lines cross, the funding arbitrage disappears.</div>
      </Card>

      <Card title="Carry surface — effective INR cost by currency and lender-spread change (cells below your hurdle are shaded green)">
        <Table>
          <thead><tr><Th>Best route per currency</Th>{carrySurface.shifts.map((s) => <Th key={s} right>{s >= 0 ? "+" : ""}{s} bp</Th>)}</tr></thead>
          <tbody>
            {carrySurface.rows.map(({ x, cells }) => (
              <tr key={x.id} className="border-t border-border/60">
                <Td mono>{x.label}</Td>
                {cells.map((c, i) => {
                  const arb = c !== null && x.exec ? x.exec.inrAlt - c : null;
                  return <Td key={i} right mono className="" ><span style={heatStyle(arb, hurdle)} className="rounded px-1">{c === null ? "n/a" : pct(c)}</span></Td>;
                })}
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-2 text-[10px] text-text-dim">A 3-D surface (currency × tenor × spread) shown as tables you can read exactly. Tenor is on the curves below.</p>
      </Card>

      <Card title="Funding curves by tenor (needs quotes for two or more tenors: Step 2 · tenor buttons)">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold">Effective FCY→INR funding curve vs INR curve</div>
            <LineChart
              xLabel="tenor (years)"
              yFmt={(v) => pct(v, 1)}
              xFmt={(v) => `${v}Y`}
              series={[
                ...FUNDING_CCYS.filter((c) => curves.points.filter((pt) => isNum(pt.byCcy[c])).length >= 2).map((c, i) => ({ name: c, color: PALETTE[i % PALETTE.length], points: curves.points.filter((pt) => isNum(pt.byCcy[c])).map((pt) => ({ x: pt.tenor, y: pt.byCcy[c] as number })) })),
                { name: "INR", color: "#ffffff", dash: "4 3", points: curves.points.filter((pt) => pt.inrAlt !== null).map((pt) => ({ x: pt.tenor, y: pt.inrAlt as number })) },
              ]}
            />
            {curves.crossings.length > 0 && <div className="mt-1 text-[11px] text-text-dim">Intersections (economically important): {curves.crossings.map((c) => `${c.ccy} crosses INR at ≈${c.tenor.toFixed(1)}Y`).join(" · ")}</div>}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold">USD carry curve: Carry(T) = direct USD(T) − synthetic USD(T)</div>
            <LineChart xLabel="tenor (years)" yFmt={(v) => `${(v / BP).toFixed(0)} bp`} xFmt={(v) => `${v}Y`} series={FUNDING_CCYS.filter((c) => curves.points.filter((pt) => isNum(pt.usdCarry[c])).length >= 2).map((c, i) => ({ name: c, color: PALETTE[i % PALETTE.length], points: curves.points.filter((pt) => isNum(pt.usdCarry[c])).map((pt) => ({ x: pt.tenor, y: pt.usdCarry[c] as number })) }))} />
            <div className="text-[10px] text-text-dim">Shows where the carry is concentrated: a currency can be unattractive at 1Y and attractive at 5Y.</div>
          </div>
        </div>
      </Card>

      <Card title="USD-carry heat map — funding-currency spread × swap-to-USD quote → carry vs direct USD (bp)" right={<Select value={uFrom} width="w-20" onChange={setUFrom} options={FUNDING_CCYS.filter((c) => c !== USD).map((c) => ({ value: c, label: c }))} />}>
        {!usdGrid ? <div className="text-xs text-text-dim">Needs a {uFrom} lender quote, a {uFrom}→USD swap quote and a USD lender quote.</div> : (
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead><tr><th className="px-2 py-1 text-left text-[10px] text-text-dim">{uFrom}→USD quote ↓ / {uFrom} lender spread →</th>{usdGrid.sp.map((s) => <th key={s} className="gfew-mono px-2 py-1 text-right text-[10px] text-text-dim">{(s / BP).toFixed(0)} bp</th>)}</tr></thead>
              <tbody>
                {usdGrid.ed.map((ev, yi) => (
                  <tr key={ev}>
                    <td className="gfew-mono px-2 py-1 text-[10px] text-text-dim">{pct(ev)}</td>
                    {usdGrid.sp.map((s, xi) => {
                      const v = usdGrid.z[yi][xi];
                      const rt = usdGrid.z[yi][xi + 1];
                      const bl = usdGrid.z[yi + 1]?.[xi];
                      const zr = (o: number | null | undefined) => v !== null && o !== null && o !== undefined && (v >= 0) !== (o >= 0);
                      return <td key={s} className="gfew-mono px-2 py-1 text-right" style={{ ...heatStyle(v, hurdle), borderRight: zr(rt) ? "3px solid #fff" : "1px solid #0a0e14", borderBottom: zr(bl) ? "3px solid #fff" : "1px solid #0a0e14" }}>{v === null ? "n/a" : `${v / BP >= 0 ? "+" : ""}${(v / BP).toFixed(0)}`}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 text-[10px] text-text-dim">Computed live from the cash-flow engine; the solid white line is the exact zero-carry boundary. Direct USD cost: {pct(usdGrid?.direct)}.</div>
      </Card>

      {fwdEdge && spotMid !== null && (
        <Card title={`Forward curve implied by your ${fwdEdge.from}/${fwdEdge.to} premium quote`}>
          <Table>
            <thead><tr><Th>Year</Th><Th right>Forward outright</Th><Th right>Forward points</Th></tr></thead>
            <tbody>
              {Array.from({ length: Math.round(eff.deal.tenorYears) }, (_, i) => i + 1).map((t) => {
                const pr = (fwdEdge.offer ?? fwdEdge.bid ?? 0);
                const F = spotMid * Math.pow(1 + pr, t);
                return <tr key={t} className="border-t border-border/40"><Td mono>{t}Y</Td><Td right mono>{F.toFixed(4)}</Td><Td right mono>{(F - spotMid).toFixed(4)}</Td></tr>;
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}

/* ------------------------------- stress & risk ------------------------------- */

export function StressRiskPanel(p: ResultProps) {
  const { a, eff, live } = p;
  const r = selectedRoute(a, p.selectedId);
  const dr = useDeferredValue(r);
  const rows = useMemo(() => (dr?.evalExec ? stressTable(eff, dr.route, dr.evalExec) : []), [eff, dr]);
  const rb = useMemo(() => (dr?.evalExec ? riskBreakdown(eff, dr.route, dr.evalExec) : null), [eff, dr]);
  const regime = useMemo(() => detectRegime(live), [live]);
  if (!r?.exec || !r.evalExec) return <Note tone="warn">Select a complete route on the Radar tab first.</Note>;
  const groups = [...new Set(rows.map((x) => x.group))];
  const alt = evalInrAlternative(eff).irr;
  return (
    <>
      <Card title={`Stress test — ${r.label} (each row re-runs the full cash-flow model)`}>
        <div className="mb-2 text-xs text-text-dim">Base: effective INR cost <b className="gfew-mono text-text">{pct(r.exec.effective)}</b>, advantage <b className="gfew-mono text-text">{bpS(r.exec.arbitrage)}</b>. FX shocks: <b>+</b> = the foreign currency gets dearer vs INR (bad for an unhedged liability). Rate shocks only bite where the floating coupon is not locked by a swap. Basis / credit / liquidity shocks show the damage if the market moves <i>before</i> you execute.</div>
        {r.evalExec.residualExposure.length === 0 && <Note>Fully hedged: FX shocks leave the effective cost unchanged for the hedged share (the hedge&apos;s MTM offsets the liability&apos;s move — see the MTM column).</Note>}
        {groups.map((g) => (
          <div key={g} className="mb-4">
            <div className="mb-1 text-xs font-semibold">{g}</div>
            <Table>
              <thead><tr><Th>Shock</Th><Th right>Effective INR</Th><Th right>Change</Th><Th right>Advantage</Th><Th>Still viable?</Th><Th right>Hedge MTM (approx.)</Th></tr></thead>
              <tbody>
                {rows.filter((x) => x.group === g).map((x) => (
                  <tr key={x.label} className="border-t border-border/40">
                    <Td mono>{x.label}</Td><Td right mono>{pct(x.effective)}</Td><Td right mono>{bpS(x.delta)}</Td><Td right mono>{bpS(x.arbitrage)}</Td>
                    <Td>{x.viable === null ? "—" : x.viable ? <span style={{ color: "#34c085" }}>✓ yes (≥ minimum)</span> : x.arbitrage !== null && x.arbitrage >= 0 ? <span style={{ color: "#e0b93d" }}>marginal (below minimum)</span> : <span style={{ color: "#e05a4d" }}>✗ no (arbitrage gone)</span>}</Td>
                    <Td right mono>{x.hedgeMtmInr === null ? "" : cr(x.hedgeMtmInr)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))}
        <div className="text-xs font-semibold">Stress distribution (change in effective INR cost, bp)</div>
        <HBars items={rows.map((x) => ({ label: `${x.group.split(" ")[0]} ${x.label}`, value: (x.delta ?? 0) / BP, color: (x.delta ?? 0) > 0 ? "#e0793d" : "#3fa9f5" }))} fmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} bp`} title="stress distribution" />
        <div className="hidden">{alt}</div>
      </Card>

      {rb && (
        <Card title="Risk engine (parametric, user-editable assumptions)">
          <Table>
            <thead><tr><Th>Measure</Th><Th right>Value</Th><Th>How it is computed</Th></tr></thead>
            <tbody>
              <tr className="border-t border-border/40"><Td>Residual FX exposure</Td><Td right mono>{cr(rb.fx.exposureInr)}</Td><Td><span className="text-text-dim">unhedged share × notional ({(rb.fx.unhedgedShare * 100).toFixed(0)}%)</span></Td></tr>
              <tr className="border-t border-border/40"><Td>FX VaR ({(eff.risk.confidence * 100).toFixed(0)}%, {eff.risk.horizonDays}d)</Td><Td right mono>{rb.fx.var === null ? "enter FX vol" : cr(rb.fx.var)}</Td><Td><span className="text-text-dim">exposure × z × σ√(days/252); σ = your FX vol input</span></Td></tr>
              <tr className="border-t border-border/40"><Td>FX expected shortfall</Td><Td right mono>{rb.fx.es === null ? "enter FX vol" : cr(rb.fx.es)}</Td><Td><span className="text-text-dim">exposure × σ√(days/252) × φ(z)/(1−c)</span></Td></tr>
              <tr className="border-t border-border/40"><Td>Basis VaR</Td><Td right mono>{cr(rb.basisVar)}</Td><Td><span className="text-text-dim">notional × avg life × z × basis vol ({eff.risk.basisVolBp} bp/yr) — only where a CCS is used</span></Td></tr>
              <tr className="border-t border-border/40"><Td>Funding-spread risk</Td><Td right mono>{cr(rb.spreadVar)}</Td><Td><span className="text-text-dim">notional × avg life × z × spread vol ({eff.risk.spreadVolBp} bp/yr) — refinancing / repricing</span></Td></tr>
              <tr className="border-t border-border/40"><Td>Rate VaR</Td><Td right mono>{cr(rb.rateVar)}</Td><Td><span className="text-text-dim">floating benchmark not locked by a swap × rate vol ({eff.risk.rateVolBp} bp/yr)</span></Td></tr>
              <tr className="border-t border-border/40"><Td>Counterparty (hedge potential future exposure)</Td><Td right mono>{cr(rb.hedgePfe)}</Td><Td><span className="text-text-dim">hedged notional × avg FX vol × √tenor × z × 0.5</span></Td></tr>
              <tr className="border-t border-border/40"><Td>Liquidity score</Td><Td right mono>{rb.liquidityScore.toFixed(2)}</Td><Td><span className="text-text-dim">lowest across route currencies (editable in Settings)</span></Td></tr>
              <tr className="border-t border-border/40"><Td>Refinancing shortfall</Td><Td right mono>{rb.refinancingYears.toFixed(2)} y</Td><Td><span className="text-text-dim">years of average maturity below 3</span></Td></tr>
            </tbody>
          </Table>
          <div className="mt-3 text-xs font-semibold">FX VaR / ES grid</div>
          <Table>
            <thead><tr><Th>Confidence</Th><Th>Horizon</Th><Th right>VaR</Th><Th right>ES</Th></tr></thead>
            <tbody>{rb.fxGrid.map((g) => <tr key={`${g.confidence}-${g.horizonDays}`} className="border-t border-border/40"><Td mono>{(g.confidence * 100).toFixed(0)}%</Td><Td mono>{g.horizonDays === 1 ? "1 day" : g.horizonDays === 10 ? "10 days" : g.horizonDays === 21 ? "1 month" : g.horizonDays === 63 ? "3 months" : "1 year"}</Td><Td right mono>{g.var === null ? "—" : cr(g.var)}</Td><Td right mono>{g.es === null ? "—" : cr(g.es)}</Td></tr>)}</tbody>
          </Table>
          <div className="mt-3 rounded border border-border p-2 text-[11px] text-text-dim">
            <b className="text-text">Risk-adjusted cost (RAC)</b> = effective INR cost + risk penalty + liquidity penalty + refinancing penalty. Here: <span className="gfew-mono">{pct(r.exec.effective, 3)} + {pct(r.penalties?.risk, 3)} + {pct(r.penalties?.liquidity, 3)} + {pct(r.penalties?.refinancing, 3)} = {pct(r.rac, 3)}</span>. Penalty parameters (model assumptions, not market data): FX risk price {PENALTY.fxRiskPrice} × your risk aversion × unhedged share × vol; liquidity up to {(PENALTY.liquidityMax * 1e4).toFixed(0)} bp at score 0; refinancing {(PENALTY.refiPerYearShort * 1e4).toFixed(0)} bp per year of average maturity below 3.
          </div>
        </Card>
      )}

      <Card title="Market regime (affects RISK assumptions only — never the funding economics)">
        <div className="flex flex-wrap gap-1">{regime.labels.map((l) => <Tag key={l} tone="info">{l}</Tag>)}</div>
        <ul className="mt-2 space-y-0.5 text-[11px] text-text-dim">{regime.evidence.map((e) => <li key={e}>• {e}</li>)}</ul>
        <div className="mt-2 text-[11px] text-text-dim">Suggested multiplier on your FX-vol assumptions: <b className="gfew-mono text-text">×{regime.volMultiplier.toFixed(2)}</b>. {p.st.applyRegimeVol ? "Applied." : "Not applied — switch it on in Settings if you want the VaR to use it."} A regime label is context, not a prediction.</div>
      </Card>
    </>
  );
}
