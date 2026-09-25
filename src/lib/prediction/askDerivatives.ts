import { OpenAIQuotaError } from "./openaiAnalysis";
import { GeminiQuotaError } from "./geminiAnalysis";

/**
 * "Ask Derivatives" — this app's THIRD deliberate LLM-computed, user-facing
 * surface (see openaiAnalysis.ts and centralBankCommentary.ts for the first
 * two; CLAUDE.md's "two places an LLM computes something" section is now
 * three, updated alongside this file). Added on explicit user request after
 * being flagged as a policy decision, not added quietly.
 *
 * User-triggered only (a button on /dashboard/derivatives, matching the
 * Prediction tab's pattern — never generated automatically on page load).
 * The model is handed a fixed snapshot of REAL/MODEL_ESTIMATE numbers this
 * app already computed (see AskDerivativesFacts below) and instructed to
 * answer using ONLY those numbers — it is a reasoning/explanation layer over
 * real data, not a new source of numbers. It must say plainly when a
 * question asks about something this dashboard doesn't track (dealer gamma,
 * options Greeks, forecasts) rather than guessing.
 */

export type AskDerivativesFacts = {
  regime: string;
  indices: { label: string; level: number | null; change4w: number | null; quality: string; methodology: string }[];
  crowdedPositioning: { market: string; category: string; netPctOi: number | null; zScore: number | null }[];
  bisOtcTotal: { notionalUsd: number | null; asOf: string | null };
  repo: { label: string; rate: number | null; asOf: string | null }[];
  vix: number | null;
  move: number | null;
  indiaFo: {
    nifty: { pcrOi: number | null; futuresOi: number | null };
    bankNifty: { pcrOi: number | null; futuresOi: number | null };
    marketTurnoverCr: number | null;
  };
  dtccNewTrades: { assetClass: string; count: number | null }[];
  cryptoFunding: { symbol: string; fundingRate: number | null }[];
};

export type AskDerivativesResult = { provider: "gemini" | "openai"; answerText: string };

function fmt(v: number | null, digits = 2): string {
  return v === null || Number.isNaN(v) ? "not available" : v.toFixed(digits);
}

export function buildAskDerivativesPrompt(facts: AskDerivativesFacts, question: string): string {
  const indexLines = facts.indices
    .map((i) => `  - ${i.label}: level ${fmt(i.level, 0)}, 4-week change ${fmt(i.change4w, 1)}, quality=${i.quality} (${i.methodology})`)
    .join("\n");

  const crowdedLines =
    facts.crowdedPositioning.length > 0
      ? facts.crowdedPositioning.map((p) => `  - ${p.market} (${p.category}): net ${fmt(p.netPctOi, 1)}% of OI, z=${fmt(p.zScore, 2)}`).join("\n")
      : "  - none currently flagged crowded (|z| >= 2.0)";

  const repoLines = facts.repo.map((r) => `  - ${r.label}: ${fmt(r.rate, 2)}% (as of ${r.asOf ?? "unknown"})`).join("\n");
  const dtccLines = facts.dtccNewTrades.map((d) => `  - ${d.assetClass}: ${d.count === null ? "not available" : d.count} new swap trades disseminated`).join("\n");
  const cryptoLines = facts.cryptoFunding.map((c) => `  - ${c.symbol} perpetual funding rate: ${c.fundingRate === null ? "not available" : `${(c.fundingRate * 100).toFixed(4)}%`}`).join("\n");

  return `You are "Ask Derivatives", an analyst assistant embedded in a real-data systemic-risk dashboard's Derivatives / Leverage page. Answer the user's question using ONLY the real data given below — never state a number, date, or fact that is not given here. If the question asks about something this dashboard does not track (e.g. live options Greeks, dealer gamma, position-level 13F/CCP data, a specific future price prediction), say plainly that this dashboard does not have that data rather than guessing or estimating one.

REAL/MODEL DATA SNAPSHOT (as currently shown on the page):
- Global Leverage Regime label: ${facts.regime}
- Page-level composite indices (quality REAL = genuine observation combined into an index; MODEL_ESTIMATE = a heuristic proxy, explicitly not a measured real-world quantity — say so if your answer leans on one):
${indexLines}
- CFTC positioning flagged as "crowded" (|z-score| >= 2.0 over trailing 2 years):
${crowdedLines}
- BIS OTC derivatives total notional outstanding: ${facts.bisOtcTotal.notionalUsd === null ? "not available" : `$${(facts.bisOtcTotal.notionalUsd / 1e12).toFixed(1)} trillion`} (as of ${facts.bisOtcTotal.asOf ?? "unknown"})
- Repo/funding rates:
${repoLines}
- VIX: ${fmt(facts.vix, 1)}; MOVE (rates volatility): ${fmt(facts.move, 1)}
- NSE India F&O: NIFTY futures OI ${facts.indiaFo.nifty.futuresOi === null ? "not available" : facts.indiaFo.nifty.futuresOi.toLocaleString()} contracts, put/call OI ratio ${fmt(facts.indiaFo.nifty.pcrOi, 2)}; BANKNIFTY futures OI ${facts.indiaFo.bankNifty.futuresOi === null ? "not available" : facts.indiaFo.bankNifty.futuresOi.toLocaleString()} contracts, put/call OI ratio ${fmt(facts.indiaFo.bankNifty.pcrOi, 2)}; whole-market F&O turnover ${facts.indiaFo.marketTurnoverCr === null ? "not available" : `INR ${(facts.indiaFo.marketTurnoverCr / 1e7).toFixed(2)} lakh crore`}
- DTCC swap transactions disseminated (new trades that day, by asset class):
${dtccLines}
- Crypto perpetual funding (OKX, Tier 3, single exchange):
${cryptoLines}

USER QUESTION: ${question}

Answer in plain prose, under 250 words, grounded strictly in the data above. Where the question is inherently a judgment call (e.g. "is this dangerous?"), give a clearly hedged qualitative view and say what specifically in the data above supports it — never invent a number to sound more precise than the data allows.`;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_PREDICTION_MODEL || "gpt-4.1-mini";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_PREDICTION_MODEL || "gemini-3.8-flash";
const REQUEST_TIMEOUT_MS = 25_000;

type OpenAiOutputItem = { type: string; content?: { type: string; text?: string }[] };
type OpenAiBody = { output?: OpenAiOutputItem[]; error?: { code?: string; message?: string } };

async function callOpenAi(prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, input: prompt }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as OpenAiBody | null;
  if (!res.ok) {
    const code = body?.error?.code;
    const message = body?.error?.message || `OpenAI request failed (HTTP ${res.status})`;
    if (code === "insufficient_quota" || code === "credit_balance_exhausted" || res.status === 429) throw new OpenAIQuotaError(message);
    throw new Error(message);
  }
  const text = (body?.output ?? [])
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text" && c.text)
    .map((c) => c.text as string)
    .join("\n")
    .trim();
  if (!text) throw new Error("OpenAI returned no answer text");
  return text;
}

type GeminiStep = { type: string; content?: { type: string; text?: string }[] };
type GeminiBody = { steps?: GeminiStep[]; error?: { message?: string; status?: string } };

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": GEMINI_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ model: GEMINI_MODEL, input: prompt }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as GeminiBody | null;
  if (!res.ok) {
    const status = body?.error?.status;
    const message = body?.error?.message || `Gemini request failed (HTTP ${res.status})`;
    if (status === "RESOURCE_EXHAUSTED" || res.status === 429) throw new GeminiQuotaError(message);
    throw new Error(message);
  }
  const text = (body?.steps ?? [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === "output_text" && c.text)
    .map((c) => c.text as string)
    .join("\n")
    .trim();
  if (!text) throw new Error("Gemini returned no answer text");
  return text;
}

export async function runAskDerivatives(facts: AskDerivativesFacts, question: string): Promise<AskDerivativesResult> {
  const prompt = buildAskDerivativesPrompt(facts, question);
  if (GEMINI_API_KEY) return { provider: "gemini", answerText: await callGemini(prompt) };
  if (OPENAI_API_KEY) return { provider: "openai", answerText: await callOpenAi(prompt) };
  throw new Error("no LLM provider configured (need GEMINI_API_KEY or OPENAI_API_KEY)");
}
