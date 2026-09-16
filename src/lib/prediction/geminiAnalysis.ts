import type { CommodityDef } from "../commodities/taxonomy";
import { buildPredictionPrompt, type AnnualDataset, type PredictionAnalysisResult } from "./openaiAnalysis";

/**
 * Free-tier default provider for the Prediction tab: Google's Gemini API
 * has a genuine no-card-required free tier (Flash models) with a real
 * Python code-execution tool.
 *
 * Targets the CURRENT `interactions` endpoint (v1beta/interactions), not
 * the older `generateContent` + `contents`/`parts` shape — that older shape
 * is documented as "(Legacy)" as of this writing. The `interactions` API
 * closely mirrors OpenAI's Responses API: `input` (a string, not a role
 * array), `tools: [{type: "code_execution"}]`, a response `id`, a `steps`
 * array (model_output / code_execution_call / code_execution_result
 * entries) instead of `output`, and `previous_interaction_id` instead of
 * `previous_response_id` for multi-turn continuation. Verified against
 * Google's own current docs (ai.google.dev/gemini-api/docs/code-execution)
 * across multiple independent fetches before writing this, since an
 * earlier draft was built against the legacy shape by mistake.
 *
 * Also handles the "AQ." vs "AIzaSy" API key format transition: AI Studio
 * now issues "AQ." keys by default (the "AIzaSy" format is being phased
 * out), both authenticate the same way (x-goog-api-key header) per current
 * docs — this client doesn't care which format the key is in.
 */
export class GeminiQuotaError extends Error {}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_PREDICTION_MODEL || "gemini-3.8-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_CONTINUATION_ROUNDS = 3;

type StepContent = { type: string; text?: string };
type ModelOutputStep = { type: "model_output"; content?: StepContent[] };
type CodeExecutionCallStep = { type: "code_execution_call"; arguments?: { code?: string } };
type CodeExecutionResultStep = { type: "code_execution_result"; result?: string };
type Step = ModelOutputStep | CodeExecutionCallStep | CodeExecutionResultStep | { type: string };

type InteractionResponse = {
  id?: string;
  steps?: Step[];
  error?: { code?: number; message?: string; status?: string };
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_OVERLOAD_RETRIES = 2;

async function callGemini(input: string, previousInteractionId?: string): Promise<InteractionResponse> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(GEMINI_BASE, {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input,
        tools: [{ type: "code_execution" }],
        ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
      }),
    });

    const body = (await res.json().catch(() => null)) as InteractionResponse | null;

    if (!res.ok) {
      const status = body?.error?.status;
      const message = body?.error?.message || `Gemini request failed (HTTP ${res.status})`;
      if (status === "RESOURCE_EXHAUSTED" || res.status === 429) {
        throw new GeminiQuotaError(message);
      }
      // Free-tier Flash models are popular and occasionally return a
      // transient "currently experiencing high demand" / UNAVAILABLE (503)
      // — empirically self-resolves on a bare retry, so retry a couple of
      // times with backoff before giving up rather than surfacing this to
      // the user as a hard failure.
      const isOverload = status === "UNAVAILABLE" || res.status === 503 || /high demand|overloaded/i.test(message);
      if (isOverload && attempt < MAX_OVERLOAD_RETRIES) {
        await delay(2000 * (attempt + 1));
        continue;
      }
      throw new Error(message);
    }
    if (!body) throw new Error("Gemini returned an unparseable response body");
    return body;
  }
}

function extractText(resp: InteractionResponse): string {
  return (resp.steps ?? [])
    .filter((s): s is ModelOutputStep => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text as string)
    .join("\n\n")
    .trim();
}

function extractCode(resp: InteractionResponse): string[] {
  return (resp.steps ?? [])
    .filter((s): s is CodeExecutionCallStep => s.type === "code_execution_call")
    .map((s) => s.arguments?.code)
    .filter((c): c is string => Boolean(c));
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

  let resp = await callGemini(prompt);
  let analysisText = extractText(resp);
  const codeExecuted: string[] = extractCode(resp);

  let round = 0;
  while (!looksComplete(analysisText) && resp.id && round < MAX_CONTINUATION_ROUNDS) {
    round += 1;
    const previousId = resp.id;
    resp = await callGemini(
      "Continue now. This is still a non-interactive batch job with no user to respond to you — do not ask what to do next. Complete every remaining step immediately: fit the model, run the honest held-out backtest, compute the real test-set R² and MAPE, extrapolate, and write the final under-300-word analysis leading with that backtested accuracy. Finish in this turn.",
      previousId
    );
    const nextText = extractText(resp);
    if (nextText) analysisText = nextText;
    codeExecuted.push(...extractCode(resp));
  }

  if (!analysisText) {
    throw new Error("Gemini returned no analysis text (response shape may have changed).");
  }

  return { analysisText, codeExecuted };
}
