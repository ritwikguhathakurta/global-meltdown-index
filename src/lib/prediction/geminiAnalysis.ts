import type { CommodityDef } from "../commodities/taxonomy";
import { buildPredictionPrompt, type AnnualDataset, type PredictionAnalysisResult } from "./openaiAnalysis";

/**
 * Free-tier default provider for the Prediction tab: Google's Gemini API
 * has a genuine no-card-required free tier (Flash models) with a real
 * Python code-execution tool via the standard generateContent REST
 * endpoint — verified against Google's own current docs before use, since
 * exact model names/tiers move fast (gemini-3.8-flash as of this writing).
 * This mirrors openaiAnalysis.ts's contract exactly (same AnnualDataset
 * input, same PredictionAnalysisResult output, same shared prompt) so the
 * API route can pick whichever provider has a key configured.
 */
export class GeminiQuotaError extends Error {}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_PREDICTION_MODEL || "gemini-3.8-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_CONTINUATION_ROUNDS = 3;

type GeminiPart = {
  text?: string;
  executableCode?: { language?: string; code?: string };
  codeExecutionResult?: { outcome?: string; output?: string };
};
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
type GeminiResponse = {
  candidates?: { content: GeminiContent; finishReason?: string }[];
  error?: { code?: number; message?: string; status?: string };
};

async function callGemini(contents: GeminiContent[]): Promise<GeminiResponse> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const res = await fetch(`${GEMINI_BASE}/${MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents,
      tools: [{ codeExecution: {} }],
    }),
  });

  const body = (await res.json().catch(() => null)) as GeminiResponse | null;

  if (!res.ok) {
    const status = body?.error?.status;
    const message = body?.error?.message || `Gemini request failed (HTTP ${res.status})`;
    if (status === "RESOURCE_EXHAUSTED" || res.status === 429) {
      throw new GeminiQuotaError(message);
    }
    throw new Error(message);
  }
  if (!body) throw new Error("Gemini returned an unparseable response body");
  return body;
}

function extractText(resp: GeminiResponse): string {
  const parts = resp.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => p.text)
    .map((p) => p.text as string)
    .join("\n\n")
    .trim();
}

function extractCode(resp: GeminiResponse): string[] {
  const parts = resp.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => p.executableCode?.code).map((p) => p.executableCode!.code as string);
}

// Same completion heuristic as the OpenAI path: a real analysis leads with
// the backtested accuracy, so its absence means the model stopped early
// (e.g. with interim narration) rather than finishing the task.
function looksComplete(text: string): boolean {
  if (text.length < 200) return false;
  const lower = text.toLowerCase();
  return /r[²2^]/.test(lower) && lower.includes("backtest");
}

export async function runPredictionAnalysis(
  commodity: Pick<CommodityDef, "slug" | "label" | "unit">,
  dataset: AnnualDataset
): Promise<PredictionAnalysisResult> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const prompt = buildPredictionPrompt(commodity, dataset, "the code execution tool");

  let contents: GeminiContent[] = [{ role: "user", parts: [{ text: prompt }] }];
  let resp = await callGemini(contents);
  let analysisText = extractText(resp);
  const codeExecuted: string[] = extractCode(resp);

  let round = 0;
  while (!looksComplete(analysisText) && round < MAX_CONTINUATION_ROUNDS) {
    round += 1;
    const modelTurn = resp.candidates?.[0]?.content;
    contents = [
      ...contents,
      ...(modelTurn ? [modelTurn] : []),
      {
        role: "user",
        parts: [
          {
            text: "Continue now. This is still a non-interactive batch job with no user to respond to you — do not ask what to do next. Complete every remaining step immediately: fit the model, run the honest held-out backtest, compute the real test-set R² and MAPE, extrapolate, and write the final under-300-word analysis leading with that backtested accuracy. Finish in this turn.",
          },
        ],
      },
    ];
    resp = await callGemini(contents);
    const nextText = extractText(resp);
    if (nextText) analysisText = nextText;
    codeExecuted.push(...extractCode(resp));
  }

  if (!analysisText) {
    throw new Error("Gemini returned no analysis text (response shape may have changed).");
  }

  return { analysisText, codeExecuted };
}
