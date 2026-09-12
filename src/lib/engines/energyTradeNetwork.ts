import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLatestForKeys } from "../metrics/store";
import { EIA_COUNTRIES } from "../sources/eiaApi";
import { TRADE_COMMODITIES } from "../sources/unComtrade";
import { COUNTRY_LABELS } from "./energyCountryBalance";

/**
 * Global Energy Trade Network Graph (spec §82-84, 122-123) — built on real
 * bilateral export values from UN Comtrade (unComtrade.ts), not a
 * geographic proxy. Each edge is one reporter country's own declared export
 * value to one partner; import-side figures shown here are the standard
 * "mirror statistics" convention (a country's imports read off its
 * partners' own export declarations), not independently confirmed customs
 * data on the receiving end.
 *
 * Node centrality is computed with the actual graph-theoretic definitions,
 * not a hand-rolled heuristic: degree centrality, weighted strength (trade
 * value touching the node), and betweenness centrality via Brandes'
 * algorithm (unweighted, undirected — a node's betweenness reflects how
 * often it sits on the shortest connective path between two OTHER
 * countries in this 16-country energy-trade universe, i.e. how much of a
 * structural "broker" it is).
 */

export type TradeEdge = {
  fromSlug: string;
  fromLabel: string;
  toSlug: string;
  toLabel: string;
  commodity: string;
  commodityLabel: string;
  valueUsd: number;
  asOf: string;
};

export type TradeNodeCentrality = {
  slug: string;
  label: string;
  degree: number; // distinct trade-connected partners
  degreeCentralityPct: number; // degree / (n-1) * 100
  exportValueUsd: number;
  importValueUsd: number; // mirror-reported: sum of partners' declared exports TO this node
  betweenness: number; // normalized 0-100
};

export type EnergyTradeNetworkResult = {
  edges: TradeEdge[];
  nodes: TradeNodeCentrality[];
  asOf: string | null;
};

function computeBetweenness(nodeSlugs: string[], adjacency: Map<string, Set<string>>): Map<string, number> {
  const betweenness = new Map<string, number>(nodeSlugs.map((s) => [s, 0]));
  for (const s of nodeSlugs) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>(nodeSlugs.map((v) => [v, []]));
    const sigma = new Map<string, number>(nodeSlugs.map((v) => [v, 0]));
    sigma.set(s, 1);
    const dist = new Map<string, number>(nodeSlugs.map((v) => [v, -1]));
    dist.set(s, 0);
    const queue: string[] = [s];
    while (queue.length > 0) {
      const v = queue.shift() as string;
      stack.push(v);
      for (const w of adjacency.get(v) ?? []) {
        if (dist.get(w) === -1) {
          dist.set(w, (dist.get(v) ?? 0) + 1);
          queue.push(w);
        }
        if (dist.get(w) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          predecessors.get(w)?.push(v);
        }
      }
    }
    const delta = new Map<string, number>(nodeSlugs.map((v) => [v, 0]));
    while (stack.length > 0) {
      const w = stack.pop() as string;
      for (const v of predecessors.get(w) ?? []) {
        const sigmaW = sigma.get(w) ?? 0;
        if (sigmaW === 0) continue;
        const c = ((sigma.get(v) ?? 0) / sigmaW) * (1 + (delta.get(w) ?? 0));
        delta.set(v, (delta.get(v) ?? 0) + c);
      }
      if (w !== s) betweenness.set(w, (betweenness.get(w) ?? 0) + (delta.get(w) ?? 0));
    }
  }
  // Each shortest path between an unordered pair is counted once from each
  // endpoint's BFS in an undirected graph, so halve to get the standard value.
  for (const s of nodeSlugs) betweenness.set(s, (betweenness.get(s) ?? 0) / 2);
  return betweenness;
}

export async function getEnergyTradeNetworkGraph(db: SupabaseClient): Promise<EnergyTradeNetworkResult> {
  const expected: { key: string; commodity: string; commodityLabel: string; fromSlug: string; toSlug: string }[] = [];
  for (const commodity of TRADE_COMMODITIES) {
    for (const from of EIA_COUNTRIES) {
      for (const to of EIA_COUNTRIES) {
        if (from.slug === to.slug) continue;
        expected.push({
          key: `energy.trade.${commodity.slug}.${from.slug}_to_${to.slug}`,
          commodity: commodity.slug,
          commodityLabel: commodity.label,
          fromSlug: from.slug,
          toSlug: to.slug,
        });
      }
    }
  }
  const latest = await fetchLatestForKeys(db, expected.map((e) => e.key));

  const edges: TradeEdge[] = [];
  let asOf: string | null = null;
  for (const e of expected) {
    const row = latest.get(e.key);
    if (!row) continue;
    edges.push({
      fromSlug: e.fromSlug,
      fromLabel: COUNTRY_LABELS[e.fromSlug] ?? e.fromSlug,
      toSlug: e.toSlug,
      toLabel: COUNTRY_LABELS[e.toSlug] ?? e.toSlug,
      commodity: e.commodity,
      commodityLabel: e.commodityLabel,
      valueUsd: row.v,
      asOf: row.t,
    });
    if (!asOf || row.t > asOf) asOf = row.t;
  }

  const nodeSlugs = EIA_COUNTRIES.map((c) => c.slug);
  const adjacency = new Map<string, Set<string>>(nodeSlugs.map((s) => [s, new Set<string>()]));
  for (const e of edges) {
    adjacency.get(e.fromSlug)?.add(e.toSlug);
    adjacency.get(e.toSlug)?.add(e.fromSlug);
  }
  const betweenness = computeBetweenness(nodeSlugs, adjacency);
  // Relative normalization: the single most "brokering" node in today's
  // graph reads as 100; every other node is scaled against it.
  const maxBetweenness = Math.max(1e-9, ...Array.from(betweenness.values()));

  const nodes: TradeNodeCentrality[] = nodeSlugs.map((slug) => {
    const degree = adjacency.get(slug)?.size ?? 0;
    const exportValueUsd = edges.filter((e) => e.fromSlug === slug).reduce((a, e) => a + e.valueUsd, 0);
    const importValueUsd = edges.filter((e) => e.toSlug === slug).reduce((a, e) => a + e.valueUsd, 0);
    const rawBetweenness = betweenness.get(slug) ?? 0;
    return {
      slug,
      label: COUNTRY_LABELS[slug] ?? slug,
      degree,
      degreeCentralityPct: Math.round((degree / (nodeSlugs.length - 1)) * 1000) / 10,
      exportValueUsd,
      importValueUsd,
      betweenness: Math.round((rawBetweenness / maxBetweenness) * 1000) / 10,
    };
  });
  nodes.sort((a, b) => b.betweenness - a.betweenness || b.exportValueUsd - a.exportValueUsd);

  return { edges, nodes, asOf };
}
