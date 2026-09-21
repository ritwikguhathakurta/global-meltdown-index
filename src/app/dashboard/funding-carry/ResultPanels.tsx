"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { PanelProps } from "./InputPanels";
import { Btn, Card, LevelPill, Note, QualityBadge, StatusPill, Table, Tag, Td, Th } from "./ui";
import { Waterfall } from "./charts";
import { bpS, bpU, cr, pct, spreadText, STATUS_HELP } from "./fmt";
import type { CarryInputs } from "@/lib/carry/types";
import type { RouteResult } from "@/lib/carry/analyze";
import { evalDirectLoan, evalRoute } from "@/lib/carry/evaluate";
import { enumerateRoutes } from "@/lib/carry/routes";
import { reverseFor } from "@/lib/carry/reverse";
import { riskBreakdown } from "@/lib/carry/risk";
import { aggregate } from "@/lib/carry/cashflow";
import { buildFxTable, midRate } from "@/lib/carry/fx";
import { INR, USD, benchmarkName } from "@/lib/carry/currencies";
import { isNum } from "@/lib/carry/units";
import { download } from "./ui";
import { ledgerCsv } from "@/lib/carry/report";

export interface ResultProps extends PanelProps {
  eff: CarryInputs;
  selectedId: string | null;
  onSelect: (id: string) => void;
  goto: (tab: string) => void;
}

const INSTR_SHORT: Record<string, string> = { CCS: "CCS", FX_FORWARD: "Fwd", FX_SWAP: "FX swap", NDF: "NDF", OPTION: "Option", COLLAR: "Collar", HEDGE_COST: "Hedge", RBI_SWAP: "RBI swap" };

export function selectedRoute(a: ResultProps["a"], id: string | null): RouteResult | null {
  return (id ? a.routes.find((r) => r.id === id) : null) ?? a.best ?? null;
}

function riskWord(v: number, low: number, high: number): "LOW" | "MEDIUM" | "HIGH" {
  return v <= low ? "LOW" : v <= high ? "MEDIUM" : "HIGH";
}

/* ---------------------------------- radar ---------------------------------- */

export function RadarPanel(p: ResultProps) {
  const { a, eff, selectedId, onSelect, goto } = p;
  const [showAll, setShowAll] = useState(false);
  const complete = a.routes.filter((r) => r.exec);
  const incomplete = a.routes.filter((r) => !r.exec);
  const shown = showAll ? a.routes : complete;
  const best = selectedRoute(a, selectedId);
  const dRev = useDeferredValue(best);
  const rv = useMemo(() => (dRev?.exec ? reverseFor(eff, dRev.route) : null), [eff, dRev]);
  const rb = useMemo(() => (dRev?.evalExec ? riskBreakdown(eff, dRev.route, dRev.evalExec) : null), [eff, dRev]);
  const perCcy = useMemo(() => {
    const m = new Map<string, RouteResult>();
    for (const r of complete) {
      const c = m.get(r.start);
      if (!c || (r.exec?.effective ?? 9) < (c.exec?.effective ?? 9)) m.set(r.start, r);
    }
    return [...m.values()].sort((x, y) => (x.exec?.effective ?? 9) - (y.exec?.effective ?? 9));
  }, [complete]);
  const rank = (ids: string[]) => ids.map((id) => a.routes.find((r) => r.id === id)).filter(Boolean) as RouteResult[];
  const altRate = a.inrAltIrr;
  const req = eff.deal.requirementInr;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
        <Tag tone={a.modeLabel === "LIVE" ? "info" : "warn"}>{a.modeLabel === "LIVE" ? "LIVE / OTC INPUTS" : "SCENARIO MODE"}</Tag>
        <Tag tone="info">ANALYSIS ONLY — nothing is executed</Tag>
        {best && <Tag tone={best.quality.execLabel === "EXECUTABLE" ? "good" : "warn"}>{best.quality.execLabel}</Tag>}
        <span className="text-text-dim">Model {a.modelVersion}</span>
      </div>

      {a.warnings.map((w) => <Note key={w} tone="warn">{w}</Note>)}

      <Card title="What should I raise today?">
        <div className="mb-3 text-sm">
          <span className="gfew-mono font-semibold">{cr(req)}</span> · <span className="gfew-mono">{eff.deal.tenorYears}Y</span> · INR alternative <span className="gfew-mono font-semibold">{pct(altRate)}</span>
          <span className="text-text-dim"> ({eff.inrAlt.label}, effective annual)</span> · minimum saving <span className="gfew-mono font-semibold">{bpU(eff.deal.minSaving)}</span> · hedge <span className="gfew-mono">{(eff.deal.hedgeRatio * 100).toFixed(0)}%</span>
        </div>
        {!perCcy.length ? (
          <Note tone="warn">No route is complete yet. Go to <button className="underline" onClick={() => goto("quotes")}>2 · Enter OTC quotes</button> and fill a lender quote and a hedge quote for at least one currency, plus your rupee alternative in step 1. Or load the worked example from the Guide tab to see how it looks.</Note>
        ) : (
          <Table>
            <thead>
              <tr><Th>Currency (best route)</Th><Th right>Effective INR</Th><Th right>Saving</Th><Th right>Max lender spread</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {perCcy.map((r) => (
                <tr key={r.id} className="cursor-pointer border-t border-border/60 hover:bg-panel-raised" onClick={() => onSelect(r.id)}>
                  <Td mono>{r.label}</Td>
                  <Td right mono>{pct(r.exec?.effective)}</Td>
                  <Td right mono>{bpS(r.exec?.arbitrage)}</Td>
                  <Td right mono>{r.maxSpread !== null ? spreadText(r.start, r.maxSpread) : "—"}</Td>
                  <Td><StatusPill s={r.status} /> {r.tags.slice(0, 1).map((t) => <Tag key={t}>{t}</Tag>)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {best?.exec && (
        <Card title={`Best current structure — ${best.label}`} right={<StatusPill s={best.status} />}>
          <div className="grid gap-x-8 gap-y-2 text-xs md:grid-cols-3">
            <Kpi k="Effective INR cost (executable)" v={pct(best.exec.effective)} sub={`mid ${pct(best.mid?.effective)} · slippage ${bpU(best.slippage, 1)}`} />
            <Kpi k="INR alternative" v={pct(best.exec.inrAlt)} />
            <Kpi k="Funding advantage" v={bpS(best.exec.arbitrage)} sub={best.exec.classification.replace("_", " ").toLowerCase()} />
            <Kpi k="Annual saving" v={cr(best.exec.annualSaving)} />
            <Kpi k="Minimum required saving" v={bpU(eff.deal.minSaving)} />
            <Kpi k="Arbitrage headroom remaining" v={bpS(best.exec.headroom)} />
            <Kpi k="Maximum lender spread" v={best.maxSpread !== null ? spreadText(best.start, best.maxSpread) : "—"} sub={rv?.maxSpread ? `all-in FCY coupon ${pct(rv.maxSpread.benchmarkPlusSpread)}` : undefined} />
            <Kpi k="Maximum total hedge cost" v={pct(best.maxHedgeCost)} sub={rv?.maxHedgeCost ? `you can tolerate another ${bpU(rv.maxHedgeCost.headroom)}` : undefined} />
            <Kpi k="Maximum CCS / hedge quote (basis headroom)" v="—" custom={rv?.edges.length ? <div>{rv.edges.map((e) => <div key={e.edgeId} className="gfew-mono text-xs">{e.label}: max {pct(e.max)} <span className="text-text-dim">(today {pct(e.current)}, {bpS(e.headroom)})</span></div>)}</div> : undefined} />
            <Kpi k="Break-even INR cost (arbitrage = your minimum)" v={pct(rv?.breakEvenInr)} sub={rv?.breakEvenInrZero !== null && rv?.breakEvenInrZero !== undefined ? `zero arbitrage at ${pct(rv.breakEvenInrZero)}` : undefined} />
            <Kpi k="Regulatory" v={best.regulatory === "ELIGIBLE" ? "CONFIRMED" : best.regulatory === "NOT_ELIGIBLE" ? "NOT ELIGIBLE" : "REVIEW / CONFIRM"} sub="see the Regulatory tab" />
            <Kpi k="Execution" v={best.status === "EXECUTE" && best.regulatory === "ELIGIBLE" ? "ACTIONABLE" : best.status === "EXECUTE" ? "ACTIONABLE — confirm regulatory" : "WATCH"} />
            <Kpi k="Confidence" v={best.confidence.overall} custom={<div className="text-[10px] text-text-dim">data <LevelPill l={best.confidence.data} /> · economic <LevelPill l={best.confidence.economic} /> · regulatory <LevelPill l={best.confidence.regulatory} /> · execution <LevelPill l={best.confidence.execution} /> · model <LevelPill l={best.confidence.model} /></div>} />
          </div>
          {best.tags.length > 0 && <div className="mt-3">{best.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>}
          {best.reasons.map((r) => <div key={r} className="mt-1 text-xs text-text-dim">• {r}</div>)}
          {best.quality.theoretical && <Note tone="warn">Theoretical arbitrage only — dealer quote required. These numbers come from illustrative or model-derived inputs; replace them with firm quotes before relying on anything here.</Note>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn onClick={() => goto("why")}>Why is this ranked #1? · show every cash flow</Btn>
            <Btn onClick={() => goto("reverse")}>At what rate does it stop being cheap?</Btn>
            <Btn onClick={() => goto("bank")}>Compare bank quotes & negotiate</Btn>
          </div>
          {rb && (
            <div className="mt-4 grid gap-2 border-t border-border pt-3 text-xs md:grid-cols-6">
              <RiskWord k="FX" v={riskWord(rb.fx.unhedgedShare, 0, eff.risk.maxUnhedgedShare)} />
              <RiskWord k="Basis" v={riskWord(rb.basisVar / req, eff.deal.minSaving * 0.5, eff.deal.minSaving * 1.5)} />
              <RiskWord k="Liquidity" v={best.liquidityScore >= 0.7 ? "LOW" : best.liquidityScore >= eff.risk.minLiquidityScore ? "MEDIUM" : "HIGH"} />
              <RiskWord k="Credit / counterparty" v={riskWord(rb.hedgePfe / req, 0.1, 0.25)} />
              <RiskWord k="Regulatory" v={best.regulatory === "ELIGIBLE" ? "CONFIRMED" : best.regulatory === "NOT_ELIGIBLE" ? "NOT ELIGIBLE" : "REVIEW"} />
              <RiskWord k="Execution" v={best.quality.allExecutable ? "EXECUTABLE" : best.quality.theoretical ? "THEORETICAL" : "INDICATIVE"} />
            </div>
          )}
        </Card>
      )}

      <Card title="Live funding opportunities — every route, executable economics" right={<label className="flex items-center gap-1 text-[11px] text-text-dim"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show {incomplete.length} routes with missing data</label>}>
        <Table>
          <thead>
            <tr>
              <Th>Route</Th><Th right>Tenor</Th><Th>Benchmark</Th><Th right>Borrowing rate</Th><Th>Hedge</Th><Th right>Hedge cost</Th><Th right>CCS basis</Th><Th right>Effective INR</Th><Th right>INR alt.</Th><Th right>Advantage</Th><Th right>Headroom</Th><Th right>Max spread</Th><Th right>Liquidity</Th><Th>Regulatory</Th><Th>Confidence</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} onClick={() => onSelect(r.id)} className={`cursor-pointer border-t border-border/60 hover:bg-panel-raised ${best?.id === r.id ? "bg-panel-raised" : ""}`}>
                <Td mono className="whitespace-nowrap">{r.label}{r.usesRbi ? <Tag tone="info">RBI</Tag> : null}</Td>
                <Td right mono>{eff.deal.tenorYears}Y</Td>
                <Td><span className="text-text-dim">{benchmarkName(r.start)}</span></Td>
                <Td right mono>{pct(r.fcyRate)}</Td>
                <Td>{r.route.edges.map((e) => INSTR_SHORT[e.instrument]).join(" + ")}</Td>
                <Td right mono>{pct(r.explain?.hedgeCost)}</Td>
                <Td right mono>{r.explain?.basis != null ? bpS(r.explain.basis) : "—"}</Td>
                <Td right mono>{pct(r.exec?.effective)}</Td>
                <Td right mono>{pct(r.exec?.inrAlt ?? altRate)}</Td>
                <Td right mono>{bpS(r.exec?.arbitrage)}</Td>
                <Td right mono>{bpS(r.exec?.headroom)}</Td>
                <Td right mono>{r.maxSpread !== null ? spreadText(r.start, r.maxSpread) : "—"}</Td>
                <Td right mono>{r.liquidityScore.toFixed(2)}</Td>
                <Td><span className="text-[10px]">{r.regulatory.replace(/_/g, " ")}</span></Td>
                <Td><LevelPill l={r.confidence.overall} /></Td>
                <Td><StatusPill s={r.status} />{r.status === "INSUFFICIENT_DATA" && r.missing.length ? <div className="mt-1 max-w-[16rem] text-[10px] text-text-dim">need: {r.missing.slice(0, 3).join("; ")}</div> : null}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="mt-2 grid gap-1 text-[10px] text-text-dim md:grid-cols-2">
          {Object.entries(STATUS_HELP).map(([k, v]) => <div key={k}><b>{k.replace(/_/g, " ")}</b> — {v}</div>)}
          <div>Colour is never the only signal: every status is also written out. Click a row to select it for the Why / Reverse / Stress tabs.</div>
        </div>
      </Card>

      <Card title="Three independent rankings (never merged into one)">
        <div className="grid gap-4 md:grid-cols-3">
          <RankList title="A · Cheapest THEORETICAL" sub="mid-market, any data quality" rows={rank(a.ranking.theoretical)} pick={(r) => r.mid?.effective ?? null} onSelect={onSelect} />
          <RankList title="B · Cheapest EXECUTABLE" sub="bid/offer applied, firm fresh dealer quotes only" rows={rank(a.ranking.executable)} pick={(r) => r.exec?.effective ?? null} onSelect={onSelect} empty="No route has firm, fresh, complete dealer quotes yet." />
          <RankList title="C · Best RISK-ADJUSTED" sub="effective cost + risk, liquidity and refinancing penalties" rows={rank(a.ranking.riskAdjusted)} pick={(r) => r.rac} onSelect={onSelect} />
        </div>
      </Card>

      <CarryCard {...p} />
      <MatrixCard {...p} />
    </>
  );
}

function Kpi({ k, v, sub, custom }: { k: string; v: string; sub?: string; custom?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-text-dim">{k}</div>
      {custom ?? <div className="gfew-mono text-base font-semibold text-text">{v}</div>}
      {sub ? <div className="text-[10px] text-text-dim">{sub}</div> : null}
    </div>
  );
}

function RiskWord({ k, v }: { k: string; v: string }) {
  const c = v === "LOW" || v === "CONFIRMED" || v === "EXECUTABLE" ? "#34c085" : v === "MEDIUM" || v === "REVIEW" || v === "INDICATIVE" ? "#e0b93d" : "#e05a4d";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-text-dim">{k}</div>
      <div className="text-xs font-semibold" style={{ color: c }}>{v}</div>
    </div>
  );
}

function RankList({ title, sub, rows, pick, onSelect, empty }: { title: string; sub: string; rows: RouteResult[]; pick: (r: RouteResult) => number | null; onSelect: (id: string) => void; empty?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-text">{title}</div>
      <div className="mb-2 text-[10px] text-text-dim">{sub}</div>
      {!rows.length ? <div className="text-[11px] text-text-dim">{empty ?? "No complete routes yet."}</div> : (
        <ol className="space-y-1 text-xs">
          {rows.slice(0, 8).map((r, i) => (
            <li key={r.id} className="flex cursor-pointer items-center gap-2 rounded px-1 hover:bg-panel-raised" onClick={() => onSelect(r.id)}>
              <span className="w-4 text-text-dim">{i + 1}</span>
              <span className="flex-1 truncate gfew-mono">{r.label}</span>
              <span className="gfew-mono">{pct(pick(r))}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* --------------------------- USD carry vs INR carry --------------------------- */

function CarryCard({ a }: ResultProps) {
  const rows = a.carry;
  const direct = a.directUsdIrr;
  return (
    <Card title="Carry — USD as the base comparison currency">
      <Note>
        <b>USD carry</b> = direct USD funding cost − synthetic USD cost (foreign loan swapped into USD). <b>INR carry</b> = your rupee alternative − the effective INR cost. <b>Path advantage</b> = direct foreign→INR cost − foreign→USD→INR cost. They answer different questions, so they are never added together. Interest-rate differential is <i>not</i> economic carry, and a forward premium is <i>not</i> the same as your actual hedge cost — that is why every number here comes from actual cash flows.
      </Note>
      {direct !== null && <div className="mb-2 text-xs text-text-dim">Direct USD borrowing cost (annual-effective): <b className="gfew-mono text-text">{pct(direct)}</b></div>}
      {!rows.length ? <div className="text-xs text-text-dim">Enter a foreign→USD swap quote (Step 2 · C) plus USD lender quotes to see USD carry.</div> : (
        <Table>
          <thead>
            <tr><Th>Funding currency</Th><Th right>Synthetic USD cost</Th><Th right>USD carry (mid)</Th><Th right>USD carry (executable)</Th><Th right>INR carry — direct</Th><Th right>INR carry — via USD</Th><Th right>Path advantage (via USD vs direct)</Th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.ccy} className="border-t border-border/60">
                <Td mono>{c.ccy}</Td>
                <Td right mono>{pct(c.synthUsdExec)}</Td>
                <Td right mono>{bpS(c.usdCarryMid)}</Td>
                <Td right mono>{bpS(c.usdCarryExec)}</Td>
                <Td right mono>{bpS(c.inrCarryDirect)}</Td>
                <Td right mono>{bpS(c.inrCarryViaUsd)}</Td>
                <Td right mono>{bpS(c.crossPathAdvantage)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="mt-2 text-[10px] text-text-dim">Positive = cheaper than the comparator. Where USD carry is large but INR carry via USD is small, the benefit is coming from the USD leg; where INR carry is large, the source is the rupee hedge (see the attribution on the Why tab). This tells you whether the benefit exists because foreign funding is cheap, USD funding is expensive, INR funding is expensive, the basis is favourable, or an RBI concession lowers hedge cost.</p>
    </Card>
  );
}

function MatrixCard({ eff }: ResultProps) {
  const ccys = ["USD", "EUR", "JPY", "CHF", "SGD"];
  const cells = useMemo(() => {
    const out: Record<string, number | null> = {};
    const routes = (t: string) => enumerateRoutes(eff, { target: t });
    for (const from of ccys) {
      for (const to of ccys) {
        if (from === to) {
          const d = evalDirectLoan(eff, from);
          out[`${from}>${to}`] = d.irr;
          continue;
        }
        const rs = routes(to).filter((r) => r.start === from);
        let best: number | null = null;
        for (const r of rs) {
          const o = evalRoute(eff, r, "exec", {}, to);
          if (o.irr !== null && (best === null || o.irr < best)) best = o.irr;
        }
        out[`${from}>${to}`] = best;
      }
      const inr = enumerateRoutes(eff).filter((r) => r.start === from && r.edges.length === 1);
      let bi: number | null = null;
      for (const r of inr) {
        const o = evalRoute(eff, r, "exec");
        if (o.irr !== null && (bi === null || o.irr < bi)) bi = o.irr;
      }
      out[`${from}>INR`] = bi;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eff]);
  return (
    <Card title="Funding-currency matrix — cost of borrowing the row currency and ending up with the column currency">
      <Table>
        <thead><tr><Th>Borrow ↓ / End up with →</Th>{ccys.map((c) => <Th key={c} right>{c}</Th>)}<Th right>INR</Th></tr></thead>
        <tbody>
          {ccys.map((from) => (
            <tr key={from} className="border-t border-border/60">
              <Td mono><b>{from}</b></Td>
              {[...ccys, "INR"].map((to) => (
                <Td key={to} right mono className={from === to ? "text-text-dim" : ""}>{pct(cells[`${from}>${to}`])}{from === to ? <span className="ml-1 text-[9px]">direct</span> : null}</Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-2 text-[10px] text-text-dim">Each cell is an annual-effective rate in the <i>column</i> currency from actual cash flows at executable prices; blanks need a quote. The shortest route is never assumed to be the cheapest — the route list above searches the whole funding graph (up to three hops).</p>
    </Card>
  );
}

/* ------------------------------- why / audit -------------------------------- */

const LABELS: Record<string, string> = { bench: "Foreign benchmark swap rate", spread: "Lender credit spread", fee: "Fees (upfront amortised + ongoing + other costs)", wht: "Withholding-tax gross-up", stamp: "Stamp duty / other tax", shield: "Interest tax shield", fx: "Expected FX move on the unhedged share" };

export function WhyPanel(p: ResultProps) {
  const { a, eff, selectedId } = p;
  const r = selectedRoute(a, selectedId);
  const [showAllLedgers, setShowAllLedgers] = useState(false);
  if (!r || !r.exec || !r.explain || !r.evalExec) return <Note tone="warn">Select a complete route on the Radar tab (or enter the missing quotes) to see the full explanation.</Note>;
  const e = r.explain;
  const ev = r.evalExec;
  const eIrr = ev.irr as number;
  const fx = buildFxTable(eff.spots, "mid");
  const inrEq = (ccy: string, amt: number) => {
    if (ccy === INR) return amt;
    const k = midRate(fx, ccy, INR);
    return isNum(k) ? amt * k : null;
  };
  const usdEq = (ccy: string, amt: number) => {
    if (ccy === USD) return amt;
    const k = midRate(fx, ccy, USD);
    return isNum(k) ? amt * k : null;
  };
  const ledgers = [...new Set(ev.entries.map((x) => x.ledger))];
  const netByCcy = [...new Set(ev.entries.map((x) => x.ccy))].map((c) => {
    const rows = aggregate(ev.entries.filter((x) => !x.modelled), c);
    return { ccy: c, maxAbs: Math.max(0, ...rows.map((x) => Math.abs(x.amount))), total: rows.reduce((s, x) => s + x.amount, 0) };
  });
  const wf = e.lines.map((l) => ({ label: l.key.startsWith("hedge:") ? `Hedge cost — ${l.key.slice(6) || "hedge"}` : (LABELS[l.key] ?? l.key), value: l.cost }));
  // multi-stage explanation
  const tq = eff.quotesByTenor[String(eff.deal.tenorYears)];
  const steps: { k: string; v: string }[] = [];
  if (tq) {
    const L = tq.lenders[r.start];
    let rate = (L?.benchmarkRate ?? 0) + (L?.spread ?? 0);
    let bench = L?.benchmarkRate ?? 0;
    steps.push({ k: `STEP 1 — ${r.start} funding`, v: `${pct(bench)} ${benchmarkName(r.start)} swap + ${bpU(L?.spread ?? 0)} spread = ${pct(rate)}` });
    r.route.edges.forEach((edge, i) => {
      if (edge.instrument === "RBI_SWAP") {
        steps.push({ k: `STEP ${i + 2} — RBI USD/INR swap`, v: `principal swapped at ${pct(eff.rbi.swapRate)} p.a. compounded ${eff.rbi.compoundingPerYear}x; coupons ${r.route.rbiCoupon ? "hedged at the market forward quote" : "UNHEDGED"}` });
        return;
      }
      const q = [edge.bid, edge.offer].filter(isNum) as number[];
      const flat = q.length ? Math.max(...q) : NaN;
      const isCcs = edge.instrument === "CCS";
      if (isCcs) {
        const next = flat + (rate - bench);
        steps.push({ k: `STEP ${i + 2} — ${edge.from} → ${edge.to} CCS`, v: `pay ${edge.to} fixed ${pct(flat)} on the flat leg + ${bpU(rate - bench)} carried spread = ${pct(next)} in ${edge.to} (hedge cost ${bpU(flat - bench)})` });
        rate = next;
        bench = tq.lenders[edge.to]?.benchmarkRate ?? 0;
      } else steps.push({ k: `STEP ${i + 2} — ${edge.from} → ${edge.to} ${edge.instrument}`, v: `each payment converted at spot × (1 + ${pct(flat)})^t` });
    });
    steps.push({ k: `STEP ${r.route.edges.length + 2} — Final INR cost`, v: `${pct(eIrr)} (IRR of every INR cash flow, incl. fees${eff.tax.mode === "included" ? " and tax" : ""})` });
    steps.push({ k: `STEP ${r.route.edges.length + 3} — INR alternative`, v: pct(e.inrAlt) });
    steps.push({ k: "NET ARBITRAGE = INR alternative − final INR cost", v: bpS(e.arbitrage) });
  }
  const valid = r.validators;
  return (
    <>
      <Card title={`Why ${r.label}? — every number is traceable`} right={<div className="flex items-center gap-2"><StatusPill s={r.status} /><Btn onClick={() => download(`ledger-${r.label.replace(/[^A-Za-z]+/g, "-")}.csv`, "text/csv", ledgerCsv(r))}>Download ledger CSV</Btn></div>}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold">WHY THIS STRUCTURE?</div>
            <ol className="space-y-1 text-xs">
              <li>1. FCY funding cost: <b className="gfew-mono">{pct(e.fcyFundingCost)}</b> <span className="text-text-dim">(benchmark + lender spread)</span></li>
              <li>2. Hedge cost: <b className="gfew-mono">{pct(e.hedgeCost)}</b></li>
              <li>3. Basis: <b className="gfew-mono">{e.basis === null ? "n/a" : bpS(e.basis)}</b> <span className="text-text-dim">{e.basis === null ? "(enter the INR term swap rate in step 1 to isolate it)" : "(hedge cost beyond the pure interest differential)"}</span></li>
              <li>4. Fees: <b className="gfew-mono">{pct(e.fees, 3)}</b></li>
              <li>5. Tax: <b className="gfew-mono">{pct(e.tax, 3)}</b></li>
              <li>6. RBI benefit: <b className="gfew-mono">{e.rbiBenefit === null ? "none / n.a." : bpS(e.rbiBenefit)}</b> {e.rbiBenefit !== null ? <Tag tone="info">regulatory carry, not market arbitrage</Tag> : null}</li>
              <li>7. Effective INR cost: <b className="gfew-mono">{pct(e.effective)}</b></li>
              <li>8. INR alternative: <b className="gfew-mono">{pct(e.inrAlt)}</b></li>
              <li>9. Arbitrage: <b className="gfew-mono">{bpS(e.arbitrage)}</b></li>
              <li>10. Remaining headroom: <b className="gfew-mono">{bpS(e.headroom)}</b> <span className="text-text-dim">over the {bpU(eff.deal.minSaving)} minimum</span></li>
            </ol>
            <div className="mt-3 rounded border border-border p-2 text-xs">
              <div className="mb-1 font-semibold">Mid-market vs executable</div>
              <div>Mid-market economics: <b className="gfew-mono">{pct(r.mid?.effective)}</b> ({bpS(r.mid?.arbitrage)})</div>
              <div>Executable economics: <b className="gfew-mono">{pct(r.exec.effective)}</b> ({bpS(r.exec.arbitrage)})</div>
              <div>Slippage (executable − mid): <b className="gfew-mono">{bpU(r.slippage, 1)}</b></div>
              <div className="mt-1 text-[10px] text-text-dim">Executable uses the adverse side of every bid/offer (spot, forward, CCS, spreads). An arbitrage that exists only at mid is flagged FALSE_ARBITRAGE.</div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold">Cost build-up (annual, adds up exactly to the effective rate)</div>
            <Waterfall items={wf} fmt={(v) => pct(v, 3)} endLabel="Effective INR cost" />
            <div className="mt-2 text-[10px] text-text-dim">Each bar is that item&apos;s present-value share of the effective rate, so the bars reconcile to the IRR to the last decimal. Costs (orange) add; benefits (green) subtract.</div>
          </div>
        </div>
      </Card>

      <Card title="Step-by-step decomposition">
        <div className="space-y-1 text-xs">
          {steps.map((s) => (
            <div key={s.k} className="flex flex-wrap gap-2 border-b border-border/40 py-1"><span className="w-80 shrink-0 font-semibold">{s.k}</span><span className="gfew-mono text-text-dim">{s.v}</span></div>
          ))}
        </div>
      </Card>

      <Card title="Show cash flows (borrower perspective: + received, − paid)" right={<label className="flex items-center gap-1 text-[11px] text-text-dim"><input type="checkbox" checked={showAllLedgers} onChange={(x) => setShowAllLedgers(x.target.checked)} /> show every line (otherwise first 40 per ledger)</label>}>
        {ledgers.map((lg) => {
          const rows = ev.entries.filter((x) => x.ledger === lg && x.ccy !== "src").sort((x, y) => x.t - y.t);
          const cut = showAllLedgers ? rows : rows.slice(0, 40);
          return (
            <div key={lg} className="mb-4">
              <div className="mb-1 text-xs font-semibold">{lg}</div>
              <Table>
                <thead><tr><Th>Date</Th><Th>Ccy</Th><Th>Instrument</Th><Th>Description</Th><Th right>Inflow</Th><Th right>Outflow</Th><Th right>Net</Th><Th right>INR equiv.</Th><Th right>USD equiv.</Th><Th right>Discount factor</Th><Th right>PV (INR)</Th><Th>Attribution</Th></tr></thead>
                <tbody>
                  {cut.map((x, i) => {
                    const df = Math.pow(1 + eIrr, -x.t);
                    const ie = inrEq(x.ccy, x.amount);
                    const ue = usdEq(x.ccy, x.amount);
                    return (
                      <tr key={i} className="border-t border-border/40">
                        <Td mono>{x.date}</Td><Td mono>{x.ccy}</Td><Td>{x.instrument}</Td>
                        <Td><span className="text-text-dim">{x.desc}{x.modelled ? " · MODELLED" : ""}</span></Td>
                        <Td right mono>{x.amount > 0 ? x.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : ""}</Td>
                        <Td right mono>{x.amount < 0 ? (-x.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : ""}</Td>
                        <Td right mono>{x.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Td>
                        <Td right mono>{ie === null ? "—" : ie.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Td>
                        <Td right mono>{ue === null ? "—" : ue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Td>
                        <Td right mono>{x.ccy === ev.target ? df.toFixed(6) : "—"}</Td>
                        <Td right mono>{x.ccy === ev.target ? (x.amount * df).toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"}</Td>
                        <Td><span className="text-[10px] text-text-dim">{x.kind}{x.tag ? `:${x.tag}` : ""}</span></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              {rows.length > cut.length && <div className="text-[10px] text-text-dim">… {rows.length - cut.length} more lines (tick the box above)</div>}
            </div>
          );
        })}
        <div className="mt-2 text-xs font-semibold">Cancellation proof — net of every currency across all ledgers</div>
        <Table>
          <thead><tr><Th>Currency</Th><Th right>Sum of all cash flows</Th><Th right>Largest single-date net</Th><Th>Reading</Th></tr></thead>
          <tbody>
            {netByCcy.map((n) => (
              <tr key={n.ccy} className="border-t border-border/40">
                <Td mono>{n.ccy}</Td>
                <Td right mono>{n.total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Td>
                <Td right mono>{n.maxAbs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Td>
                <Td>{n.ccy === ev.target ? "final liability currency (INR debt remains)" : n.maxAbs < 1e-3 * (eff.deal.requirementInr / 1e3) ? "cancels — hedged" : `open exposure (${((1 - eff.deal.hedgeRatio) * 100).toFixed(0)}% unhedged share)`}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {ev.residualExposure.length > 0 && <Note tone="warn">Residual FX exposure: {ev.residualExposure.map((x) => `${x.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ${x.ccy}`).join(", ")} stays open — reported separately from funding cost.</Note>}
      </Card>

      <Card title="Independent checks (all four views must tell the same story)">
        <Table>
          <thead><tr><Th>Validator</Th><Th>Result</Th><Th>Detail</Th></tr></thead>
          <tbody>
            {valid.map((v) => (
              <tr key={v.name} className="border-t border-border/40"><Td>{v.name}</Td><Td><span style={{ color: v.ok ? "#34c085" : "#e05a4d" }}>{v.ok ? "✓ PASS" : "✗ FAIL"}</span></Td><Td><span className="text-text-dim">{v.detail}</span></Td></tr>
            ))}
          </tbody>
        </Table>
        <div className="mt-2 text-xs text-text-dim">Cash-flow view → IRR <b className="gfew-mono text-text">{pct(eIrr, 4)}</b> · NPV view → saving <b className="gfew-mono text-text">{cr(r.exec.npvSaving)}</b> (present value, discounted at the INR alternative) · Attribution view → lines sum to <b className="gfew-mono text-text">{pct(e.lines.reduce((s, l) => s + l.cost, 0), 4)}</b> · Effective-rate view → advantage <b className="gfew-mono text-text">{bpS(e.arbitrage)}</b>.</div>
      </Card>

      <Card title="Inputs behind this result — value, source, quality, age">
        <Table>
          <thead><tr><Th>Input</Th><Th>Quality</Th><Th>Source</Th><Th right>Age</Th><Th right>Limit</Th></tr></thead>
          <tbody>
            {r.quality.ages.map((x) => (
              <tr key={x.what} className="border-t border-border/40"><Td>{x.what}</Td><Td><QualityBadge q={x.quality} /></Td><Td>{x.source}</Td><Td right mono>{x.ageMin === null ? "unknown" : x.ageMin < 90 ? `${x.ageMin.toFixed(0)} min` : `${(x.ageMin / 60).toFixed(1)} h`}</Td><Td right mono>{x.limitMin} min</Td></tr>
            ))}
          </tbody>
        </Table>
        {r.quality.stale.length > 0 && <Note tone="warn">Stale: {r.quality.stale.join("; ")}. A route can never be EXECUTE on stale data.</Note>}
        <div className="mt-2">{r.gates.map((g) => <div key={g.name} className="text-xs"><span style={{ color: g.pass ? "#34c085" : "#e05a4d" }}>{g.pass ? "✓" : "✗"}</span> <b>{g.name}</b> <span className="text-text-dim">— {g.detail}</span></div>)}</div>
      </Card>
    </>
  );
}
