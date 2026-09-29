import { OpenAIQuotaError } from "./openaiAnalysis";
import { GeminiQuotaError } from "./geminiAnalysis";

/**
 * "Ask Geopolitics" — this app's FOURTH deliberate LLM-computed, user-facing surface (see
 * openaiAnalysis.ts, centralBankCommentary.ts, and askDerivatives.ts for the first three;
 * CLAUDE.md's "three places an LLM computes something" section is bumped to four alongside this
 * file). Approved explicitly by the user for the Geopolitical Intelligence build
 * (docs/GEOPOLITICAL_ENGINE.md), not added quietly.
 *
 * Same pattern as askDerivatives.ts exactly: user-triggered only (a button on
 * /dashboard/geopolitical, never generated on page load), handed a fixed snapshot of the REAL/
 * MODEL_ESTIMATE numbers this page already computed, instructed to answer using ONLY those
 * numbers and to say plainly when a question asks about something this dashboard doesn't track
 * (e.g. live intelligence assessments, classified capabilities, election predictions, AIS vessel
 * tracking) rather than guessing.
 */

export type AskGeopoliticsFacts = {
  indices: { label: string; level: number | null; change4w: number | null; quality: string; methodology: string }[];
  militaryTop: { country: string; spendUsdYoyPct: number | null; spendPctGdp: number | null }[];
  sanctionsCounts: { program: string; count: number | null }[];
  chokepoints: { label: string; transitsPerDay: number | null; transitsZ: number | null }[];
  historicalEventCount: number;
};

export type AskGeopoliticsResult = { provider: "gemini" | "openai"; answerText: string };

function fmt(v: number | null, digits = 2): string {
  return v === null || Number.isNaN(v) ? "not available" : v.toFixed(digits);
}

export function buildAskGeopoliticsPrompt(facts: AskGeopoliticsFacts, question: string): string {
  const indexLines = facts.indices
    .map((i) => `  - ${i.label}: level ${fmt(i.level, 0)}, 4-week change ${fmt(i.change4w, 1)}, quality=${i.quality} (${i.methodology})`)
    .join("\n");
  const militaryLines = facts.militaryTop.map((m) => `  - ${m.country}: military spend ${fmt(m.spendPctGdp, 2)}% of GDP, YoY change ${fmt(m.spendUsdYoyPct, 1)}%`).join("\n");
  const sanctionsLines = facts.sanctionsCounts.map((s) => `  - ${s.program}: ${s.count === null ? "not available" : s.count} entities currently listed (OFAC SDN)`).join("\n");
  const chokepointLines = facts.chokepoints.map((c) => `  - ${c.label}: ${c.transitsPerDay === null ? "not available" : `${c.transitsPerDay.toFixed(0)} vessel transits/day`}, z-score ${fmt(c.transitsZ, 2)}`).join("\n");

  return `You are "Ask Geopolitics", an analyst assistant embedded in a real-data systemic-risk dashboard's Geopolitical page. Answer the user's question using ONLY the real data given below — never state a number, date, or fact that is not given here. This dashboard does NOT have: live intelligence assessments, classified military capabilities, AIS/satellite vessel tracking, cyber-attribution data, election predictions, or news-event-level detail beyond the automated GDELT signal already folded into the Escalation Reading. If the question asks about any of that, say plainly that this dashboard does not have that data rather than guessing or estimating one.

REAL/MODEL DATA SNAPSHOT (as currently shown on the page):
- Page-level composite indices (quality REAL = genuine observation combined into an index; MODEL_ESTIMATE = a heuristic proxy combining real inputs, not itself a measured or validated predictive quantity — say so if your answer leans on one):
${indexLines}
- Military spending, top tracked countries (SIPRI + World Bank, official):
${militaryLines}
- OFAC sanctions list (Specially Designated Nationals), entities listed by program:
${sanctionsLines}
- Maritime chokepoint traffic (IMF PortWatch, AIS-derived):
${chokepointLines}
- Historical reference table: ${facts.historicalEventCount} documented past episodes available (factual, not a scored backtest — no precision/recall claim exists for any early-warning signal on this page).

USER QUESTION: ${question}

Answer in plain prose, under 250 words, grounded strictly in the data above. Where the question is inherently a judgment call (e.g. "is this escalating?"), give a clearly hedged qualitative view and say what specifically in the data above supports it — never invent a number, an event, or an intelligence assessment to sound more precise than the data allows.`;
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

export async function runAskGeopolitics(facts: AskGeopoliticsFacts, question: string): Promise<AskGeopoliticsResult> {
  const prompt = buildAskGeopoliticsPrompt(facts, question);
  if (GEMINI_API_KEY) return { provider: "gemini", answerText: await callGemini(prompt) };
  if (OPENAI_API_KEY) return { provider: "openai", answerText: await callOpenAi(prompt) };
  throw new Error("no LLM provider configured (need GEMINI_API_KEY or OPENAI_API_KEY)");
}
