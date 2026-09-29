import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserAndRole } from "@/lib/supabase/session";
import { getGeopoliticalPageData } from "@/lib/api/geopoliticalData";
import { runAskGeopolitics, type AskGeopoliticsFacts } from "@/lib/prediction/askGeopolitics";
import { OpenAIQuotaError } from "@/lib/prediction/openaiAnalysis";
import { GeminiQuotaError } from "@/lib/prediction/geminiAnalysis";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_QUESTION_LENGTH = 500;

// Same per-instance, best-effort cooldown as /api/derivatives/ask.
const COOLDOWN_MS = 20_000;
const lastCallByUser = new Map<string, number>();

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "backend not configured" }, { status: 503 });
  }

  const { user } = await getCurrentUserAndRole();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = Date.now();
  const last = lastCallByUser.get(user.id);
  if (last !== undefined && now - last < COOLDOWN_MS) {
    const retryAfter = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return NextResponse.json({ error: `please wait ${retryAfter}s between questions` }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }
  lastCallByUser.set(user.id, now);
  if (lastCallByUser.size > 1000) {
    for (const [id, t] of lastCallByUser) if (now - t > COOLDOWN_MS) lastCallByUser.delete(id);
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "no LLM provider configured (need GEMINI_API_KEY or OPENAI_API_KEY)" }, { status: 503 });
  }

  let question: string | undefined;
  try {
    const parsed = await req.json();
    question = typeof parsed?.question === "string" ? parsed.question.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  if (!question || question.length === 0) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: `question too long (max ${MAX_QUESTION_LENGTH} characters)` }, { status: 400 });
  }

  const data = await getGeopoliticalPageData();
  if (!data) {
    return NextResponse.json({ error: "geopolitical data not available yet" }, { status: 503 });
  }

  const facts: AskGeopoliticsFacts = {
    indices: [
      { ...data.indices.gewi, label: "Geopolitical Early Warning (GEWI)" },
      { ...data.indices.militaryBuildup, label: "Military Buildup" },
      { ...data.indices.sanctionsIntensity, label: "Sanctions Intensity" },
      { ...data.indices.escalation, label: "Escalation Reading" },
      { ...data.indices.chokepointStress, label: "Maritime Chokepoint Stress" },
    ],
    militaryTop: data.militaryRows
      .filter((r) => r.spendPctGdp !== null)
      .sort((a, b) => (b.spendPctGdp ?? 0) - (a.spendPctGdp ?? 0))
      .slice(0, 8)
      .map((r) => ({ country: r.countryLabel, spendUsdYoyPct: r.spendUsdYoyPct, spendPctGdp: r.spendPctGdp })),
    sanctionsCounts: data.indices.sanctionsIntensity.inputs.map((i) => ({ program: i.label, count: i.value })),
    chokepoints: data.chokepointRows.map((c) => ({ label: c.label, transitsPerDay: c.transitsPerDay, transitsZ: c.transitsZ })),
    historicalEventCount: data.historicalEvents.length,
  };

  try {
    const result = await runAskGeopolitics(facts, question);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof OpenAIQuotaError || e instanceof GeminiQuotaError) {
      return NextResponse.json({ error: "llm_quota_exceeded", message: e.message }, { status: 402 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
