import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserAndRole } from "@/lib/supabase/session";
import { getDerivativesPageData } from "@/lib/api/derivativesData";
import { runAskDerivatives, type AskDerivativesFacts } from "@/lib/prediction/askDerivatives";
import { OpenAIQuotaError } from "@/lib/prediction/openaiAnalysis";
import { GeminiQuotaError } from "@/lib/prediction/geminiAnalysis";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_QUESTION_LENGTH = 500;

// Same per-instance, best-effort cooldown as /api/prediction/analyze — stops
// one account hammering a single serverless instance, not a global limit.
const COOLDOWN_MS = 20_000;
const lastCallByUser = new Map<string, number>();

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "backend not configured" }, { status: 503 });
  }

  // /api/* is outside the proxy's protected prefixes, so this route
  // authenticates for itself even though the page that calls it is behind login.
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

  const data = await getDerivativesPageData();
  if (!data) {
    return NextResponse.json({ error: "derivatives data not available yet" }, { status: 503 });
  }

  const facts: AskDerivativesFacts = {
    regime: data.regime,
    indices: [
      { ...data.indices.gli, label: "Global Leverage (GLI)" },
      { ...data.indices.calci, label: "Cross-Asset Contagion (CALCI)" },
      { ...data.indices.pci, label: "Positioning Crowding (PCI)" },
      { ...data.indices.msi, label: "Margin Stress (MSI)" },
      { ...data.indices.csi, label: "Collateral Stress (CSI)" },
      { ...data.indices.cri, label: "Counterparty Risk (CRI)" },
      { ...data.indices.fdr, label: "Forced Deleveraging (FDR)" },
      { ...data.indices.dls, label: "Derivatives Liquidity Stress (DLS)" },
    ],
    crowdedPositioning: data.positioningRows
      .filter((r) => r.crowded)
      .map((r) => ({ market: r.market, category: r.category, netPctOi: r.netPctOi, zScore: r.extremityZ })),
    bisOtcTotal: (() => {
      const total = data.bisOtc.find((r) => r.key === "total") ?? data.bisOtc[0];
      return { notionalUsd: total?.notionalUsd ?? null, asOf: total?.asOf ?? null };
    })(),
    repo: data.repo.map((r) => ({ label: r.label, rate: r.rate, asOf: r.asOf })),
    vix: data.vix.value,
    move: data.move.value,
    indiaFo: {
      nifty: { pcrOi: data.indiaFo.indices.find((i) => i.symbol === "NIFTY")?.pcrOi ?? null, futuresOi: data.indiaFo.indices.find((i) => i.symbol === "NIFTY")?.futuresOi ?? null },
      bankNifty: { pcrOi: data.indiaFo.indices.find((i) => i.symbol === "BANKNIFTY")?.pcrOi ?? null, futuresOi: data.indiaFo.indices.find((i) => i.symbol === "BANKNIFTY")?.futuresOi ?? null },
      marketTurnoverCr: data.indiaFo.market.turnoverCr,
    },
    dtccNewTrades: data.dtccSwaps.map((d) => ({ assetClass: d.label, count: d.newTradeCount })),
    cryptoFunding: data.crypto.map((c) => ({ symbol: c.symbol, fundingRate: c.fundingRate })),
  };

  try {
    const result = await runAskDerivatives(facts, question);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof OpenAIQuotaError || e instanceof GeminiQuotaError) {
      return NextResponse.json({ error: "llm_quota_exceeded", message: e.message }, { status: 402 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
