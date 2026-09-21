import type { CarryInputs, Ccy, EdgeQuote } from "./types";
import type { RouteSpec } from "./evaluate";
import { INR, USD } from "./currencies";
import { isNum } from "./units";
import { emptyEdge } from "./defaults";

const isFwd = (e: EdgeQuote) => e.instrument === "FX_FORWARD" || e.instrument === "FX_SWAP" || e.instrument === "NDF";
export const hasQuote = (e: EdgeQuote) => isNum(e.bid) || isNum(e.offer);

export function routeLabel(start: Ccy, edges: EdgeQuote[]): string {
  return [start, ...edges.map((e) => e.to)].join(" → ");
}

const MAX_HOPS = 3;

/** Every valid funding path start -> ... -> INR over the user's edge quotes (the "funding graph"). */
export function enumerateRoutes(inp: CarryInputs, opts: { includeRbi?: boolean; target?: Ccy } = {}): RouteSpec[] {
  const target = opts.target ?? INR;
  const q = inp.quotesByTenor[String(inp.deal.tenorYears)];
  if (!q) return [];
  const starts = Object.keys(q.lenders).filter((c) => c !== INR && c !== target);
  const edges = q.edges;
  const out: RouteSpec[] = [];
  const nowIso = inp.nowIso;

  const dfs = (start: Ccy, at: Ccy, path: EdgeQuote[], visited: Set<Ccy>, sawFwd: boolean) => {
    if (at === target) {
      out.push({ id: `${start}|${path.map((p) => p.id).join("|")}`, label: routeLabel(start, path), start, edges: [...path] });
      return;
    }
    if (path.length >= MAX_HOPS) return;
    for (const e of edges) {
      if (e.from !== at || visited.has(e.to)) continue;
      const fwd = isFwd(e);
      if (sawFwd && !fwd) continue;
      visited.add(e.to);
      path.push(e);
      dfs(start, e.to, path, visited, sawFwd || fwd);
      path.pop();
      visited.delete(e.to);
    }
  };
  for (const s of starts) dfs(s, s, [], new Set([s]), false);

  if (target === INR && (opts.includeRbi ?? inp.rbi.apply)) {
    const rbiEdge: EdgeQuote = { ...emptyEdge(USD, INR, "RBI_SWAP", nowIso), meta: { source: "USER_INPUT", quality: "C", asOf: nowIso } };
    const couponEdge = edges.find((e) => e.from === USD && e.to === INR && isFwd(e) && hasQuote(e)) ?? null;
    const toUsd = (start: Ccy, at: Ccy, path: EdgeQuote[], visited: Set<Ccy>) => {
      if (at === USD) {
        const p = [...path, rbiEdge];
        out.push({ id: `${start}|${p.map((x) => x.id).join("|")}`, label: `${routeLabel(start, path)} → INR (RBI swap)`, start, edges: p, rbiCoupon: couponEdge });
        return;
      }
      if (path.length >= MAX_HOPS - 1) return;
      for (const e of edges) {
        if (e.from !== at || visited.has(e.to) || isFwd(e)) continue;
        visited.add(e.to);
        path.push(e);
        toUsd(start, e.to, path, visited);
        path.pop();
        visited.delete(e.to);
      }
    };
    for (const s of starts) toUsd(s, s, [], new Set([s]));
  }
  return out;
}

export function routeCurrencies(r: RouteSpec): Ccy[] {
  return [r.start, ...r.edges.map((e) => e.to)];
}
