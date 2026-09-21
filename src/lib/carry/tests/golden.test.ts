import assert from "node:assert/strict";
import { defaultInputs, meta } from "../defaults";
import { evalInrAlternative, evalRoute, type RouteSpec } from "../evaluate";
import { enumerateRoutes } from "../routes";

const NOW = "2026-09-21T10:00:00.000Z";
const near = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b} ±${tol}`);

const inp = defaultInputs(NOW);
inp.inrAlt.rate = 0.071;
const m = meta("USER_INPUT", "A", NOW);
for (const s of inp.spots) if (s.base === "USD" && s.quote === "INR") Object.assign(s, { bid: 96, ask: 96, meta: m });
const q = inp.quotesByTenor["5"];
Object.assign(q.lenders.USD, { benchmarkRate: 0.039, spread: 0.0085, upfrontFeePct: 0, ongoingFeeBp: 20 });
const e = q.edges.find((x) => x.from === "USD" && x.to === "INR")!;
e.instrument = "HEDGE_COST";
e.bid = 0.015;
e.offer = 0.015;

const routes = enumerateRoutes(inp);
const usd = routes.find((r) => r.label === "USD → INR") as RouteSpec;
assert.ok(usd, "USD → INR route exists");
const out = evalRoute(inp, usd, "exec");
assert.ok(out.ok && out.irr !== null, JSON.stringify(out.missing));
near(out.irr as number, 0.0645, 1e-9, "golden effective cost");
const alt = evalInrAlternative(inp);
near(alt.irr as number, 0.071, 1e-9, "INR alt IRR");
near((alt.irr as number) - (out.irr as number), 0.0065, 1e-9, "golden arbitrage 65 bp");
console.log("golden OK", out.irr, "entries", out.entries.length);
