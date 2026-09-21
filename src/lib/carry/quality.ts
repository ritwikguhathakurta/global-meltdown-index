/**
 * Data-quality hierarchy (A executable dealer quote … E model-derived), age and staleness.
 * A stale or non-executable input can never produce an EXECUTE signal; manual USER_INPUT never overwrites market data.
 */
import type { CarryInputs, Ccy, DataQuality, Meta } from "./types";
import type { RouteSpec } from "./evaluate";
import { INR } from "./currencies";
import { isNum } from "./units";

export type ExecLabel = "EXECUTABLE" | "INDICATIVE" | "MODELLED" | "ILLUSTRATIVE" | "SCENARIO";

const ORDER: DataQuality[] = ["A", "B", "C", "D", "E"];
export const worse = (a: DataQuality, b: DataQuality): DataQuality => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

export function ageMinutes(m: Meta, nowIso: string): number | null {
  if (!m.asOf) return null;
  const a = Date.parse(m.asOf);
  const n = Date.parse(nowIso);
  if (!Number.isFinite(a) || !Number.isFinite(n)) return null;
  return Math.max(0, (n - a) / 60000);
}

export function fmtAge(min: number | null): string {
  if (min === null) return "age unknown";
  if (min < 1) return "<1 min";
  if (min < 90) return `${Math.round(min)} min`;
  if (min < 60 * 48) return `${(min / 60).toFixed(1)} h`;
  return `${(min / 1440).toFixed(1)} d`;
}

export interface QualityReport {
  worst: DataQuality;
  execLabel: ExecLabel;
  stale: string[];
  ages: { what: string; ageMin: number | null; limitMin: number; quality: DataQuality; source: Meta["source"] }[];
  theoretical: boolean;
  allExecutable: boolean;
  dataScore: "HIGH" | "MEDIUM" | "LOW";
}

export function routeQuality(inp: CarryInputs, route: RouteSpec): QualityReport {
  const q = inp.quotesByTenor[String(inp.deal.tenorYears)];
  const ccys = new Set<Ccy>([route.start, ...route.edges.flatMap((e) => [e.from, e.to]), INR]);
  const items: { what: string; meta: Meta; limit: number }[] = [];
  for (const s of inp.spots) {
    if (!(isNum(s.bid) || isNum(s.ask))) continue;
    if (ccys.has(s.base) && ccys.has(s.quote)) items.push({ what: `Spot ${s.base}/${s.quote}`, meta: s.meta, limit: inp.stale.fxSpotMin });
  }
  const L = q?.lenders[route.start];
  if (L) items.push({ what: `${route.start} lender quote`, meta: L.meta, limit: inp.stale.creditMin });
  for (const e of route.edges) if (e.instrument !== "RBI_SWAP") items.push({ what: `${e.from}→${e.to} ${e.instrument}`, meta: e.meta, limit: inp.stale.hedgeMin });
  const worst: DataQuality = items.reduce<DataQuality>((w, i) => worse(w, i.meta.quality), "A");
  const stale: string[] = [];
  const ages = items.map((i) => {
    const age = ageMinutes(i.meta, inp.nowIso);
    if (age === null || age > i.limit) stale.push(`${i.what} (${fmtAge(age)} old, limit ${i.limit} min)`);
    return { what: i.what, ageMin: age, limitMin: i.limit, quality: i.meta.quality, source: i.meta.source };
  });
  const sources = new Set(items.map((i) => i.meta.source));
  const theoretical = sources.has("EXAMPLE") || sources.has("MODEL") || sources.has("SCENARIO") || worst === "E";
  const execLabel: ExecLabel = sources.has("SCENARIO") ? "SCENARIO" : sources.has("EXAMPLE") ? "ILLUSTRATIVE" : sources.has("MODEL") || worst === "E" ? "MODELLED" : worst === "A" ? "EXECUTABLE" : "INDICATIVE";
  const allExecutable = worst === "A" && !theoretical && stale.length === 0;
  const dataScore: QualityReport["dataScore"] = theoretical ? "LOW" : worst === "A" && stale.length === 0 ? "HIGH" : "MEDIUM";
  return { worst, execLabel, stale, ages, theoretical, allExecutable, dataScore };
}

/** DATA_CONFLICT: two sources for the same pair differ materially — never silently choose one. */
export interface Conflict {
  pair: string;
  a: { label: string; mid: number };
  b: { label: string; mid: number };
  diffPct: number;
}

export function reconcile(pair: string, a: { label: string; mid: number } | null, b: { label: string; mid: number } | null, tolPct = 0.3): Conflict | null {
  if (!a || !b || !(a.mid > 0) || !(b.mid > 0)) return null;
  const diffPct = (Math.abs(a.mid - b.mid) / ((a.mid + b.mid) / 2)) * 100;
  return diffPct > tolPct ? { pair, a, b, diffPct } : null;
}
