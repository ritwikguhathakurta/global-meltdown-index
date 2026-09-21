import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndRole } from "@/lib/supabase/session";
import { analyze } from "@/lib/carry/analyze";
import { reverseFor } from "@/lib/carry/reverse";
import { stressTable } from "@/lib/carry/risk";
import { evalRoute } from "@/lib/carry/evaluate";
import { assessEcb, assessRbiSwap, activeRules } from "@/lib/carry/regulatory";
import { buildSchedule } from "@/lib/carry/schedule";
import { MODEL_VERSION } from "@/lib/carry/defaults";
import { radarRows } from "@/lib/carry/report";
import type { CarryInputs } from "@/lib/carry/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY = 512 * 1024;
const ALLOWED_FREQ = new Set([1, 2, 4, 12]);
const lastCall = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (lastCall.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= 30) {
    lastCall.set(userId, hits);
    return true;
  }
  hits.push(now);
  lastCall.set(userId, hits);
  if (lastCall.size > 2000) for (const [k, v] of lastCall) if (!v.some((t) => now - t < 60_000)) lastCall.delete(k);
  return false;
}

function validate(inp: unknown): { ok: true; inp: CarryInputs } | { ok: false; error: string } {
  const i = inp as CarryInputs | null;
  if (!i || typeof i !== "object" || !i.deal || !i.inrAlt || !Array.isArray(i.spots) || !i.quotesByTenor || typeof i.quotesByTenor !== "object") return { ok: false, error: "inputs must be a CarryInputs object (see the audit JSON export for the shape)" };
  const d = i.deal;
  if (!(Number.isFinite(d.requirementInr) && d.requirementInr > 0 && d.requirementInr < 1e15)) return { ok: false, error: "deal.requirementInr must be a positive number of rupees (full units)" };
  if (!(Number.isFinite(d.tenorYears) && d.tenorYears >= 0.25 && d.tenorYears <= 30)) return { ok: false, error: "deal.tenorYears must be between 0.25 and 30" };
  if (!ALLOWED_FREQ.has(d.paymentFreq) || !ALLOWED_FREQ.has(i.inrAlt.freq)) return { ok: false, error: "payment frequency must be 1, 2, 4 or 12" };
  if (!(Number.isFinite(d.hedgeRatio) && d.hedgeRatio >= 0 && d.hedgeRatio <= 1)) return { ok: false, error: "deal.hedgeRatio must be within 0..1" };
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(d.startDate))) return { ok: false, error: "deal.startDate must be YYYY-MM-DD" };
  if (i.spots.length > 80 || Object.keys(i.quotesByTenor).length > 12) return { ok: false, error: "too many spots or tenors" };
  for (const t of Object.values(i.quotesByTenor)) if (!t || typeof t !== "object" || !t.lenders || !Array.isArray(t.edges) || t.edges.length > 120) return { ok: false, error: "invalid quotesByTenor entry" };
  return { ok: true, inp: { ...i, nowIso: new Date().toISOString() } };
}

/**
 * Deterministic engine as an API (authenticated: /api/* is outside the proxy's protected prefixes).
 * POST { action: "analyze" | "reverse" | "stress" | "regulatory", inputs, routeLabel? }
 */
export async function POST(req: NextRequest) {
  const { user } = await getCurrentUserAndRole();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (rateLimited(user.id)) return NextResponse.json({ error: "rate limit: 30 requests per minute" }, { status: 429, headers: { "Retry-After": "60" } });
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY) return NextResponse.json({ error: "request too large" }, { status: 413 });
  let body: { action?: string; inputs?: unknown; routeLabel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const v = validate(body.inputs);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const inp = v.inp;
  try {
    const a = analyze(inp);
    const pick = () => a.routes.find((r) => (body.routeLabel ? r.label === body.routeLabel : r === a.best));
    switch (body.action ?? "analyze") {
      case "analyze":
        return NextResponse.json({ model_version: MODEL_VERSION, as_of: a.asOf, mode: "ANALYSIS ONLY", inr_alternative_effective: a.inrAltIrr, best: a.best?.label ?? null, ranking: a.ranking, routes: radarRows(a, inp), carry: a.carry, regulatory: { ecb: a.ecb.status, rbi_swap: a.swap?.status ?? null }, warnings: a.warnings });
      case "reverse": {
        const r = pick();
        if (!r?.exec) return NextResponse.json({ error: "route not found or incomplete", missing: r?.missing ?? [] }, { status: 422 });
        return NextResponse.json({ route: r.label, reverse: reverseFor(inp, r.route) });
      }
      case "stress": {
        const r = pick();
        if (!r?.exec || !r.evalExec) return NextResponse.json({ error: "route not found or incomplete", missing: r?.missing ?? [] }, { status: 422 });
        return NextResponse.json({ route: r.label, base_effective: r.exec.effective, stress: stressTable(inp, r.route, evalRoute(inp, r.route, "exec")) });
      }
      case "regulatory": {
        const sched = buildSchedule({ ...inp.deal });
        return NextResponse.json({ rules_in_force: activeRules(inp.reg.drawdownDate).map((x) => ({ rule_id: x.rule_id, rule_version: x.rule_version, provenance: x.provenance })), ecb: assessEcb(inp, sched), rbi_swap: assessRbiSwap(inp, sched) });
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
