import type { Point } from "../metrics/stats";
import type { CommodityDef } from "../commodities/taxonomy";

/**
 * Thrown specifically when OpenAI rejects the request for billing/quota
 * reasons (insufficient_quota, credit_balance_exhausted, or a bare 429 with
 * no other body) — distinct from a genuine request/server error, so the API
 * route can surface a "add credits" message instead of a stack trace.
 */
export class OpenAIQuotaError extends Error {}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_PREDICTION_MODEL || "gpt-4o-mini";

export type PredictionAnalysisResult = {
  analysisText: string;
  codeExecuted: string[];
};

function toCsv(series: Point[]): string {
  const rows = series.map((p) => `${p.t.slice(0, 10)},${p.v}`);
  return ["date,price", ...rows].join("\n");
}

/**
 * Runs OpenAI's Code Interpreter tool (Responses API) against a commodity's
 * real price history. The model is instructed to compute every number via
 * executed Python (pandas/numpy), not by eyeballing the series, and the raw
 * executed code is returned alongside the analysis so the UI can show it —
 * this is what makes the result "real code against real data" rather than an
 * LLM guess dressed up as an analysis.
 */
export async function runPredictionAnalysis(
  commodity: Pick<CommodityDef, "slug" | "label" | "unit">,
  series: Point[]
): Promise<PredictionAnalysisResult> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const csv = toCsv(series);
  const fromDate = series[0].t.slice(0, 10);
  const toDate = series[series.length - 1].t.slice(0, 10);

  const prompt = `You are analyzing REAL historical price data for ${commodity.label} (unit: ${commodity.unit}), sourced from this app's own commodity price database (ultimately World Bank Pink Sheet / IMF PCPS), given below as CSV (date,price): ${series.length} observations from ${fromDate} to ${toDate}.

Use the code interpreter to load this CSV into a pandas DataFrame and compute, with real executed code (never estimate by eye):
1. Trailing 12-month and 36-month percentage change in price (relative to the last observation).
2. Rolling volatility: the standard deviation of month-over-month percentage changes over the trailing 24 months.
3. A linear regression trend line fit to at least the last 36 months of data (or all available data if shorter), its R^2, and the extrapolated price 3, 6, and 12 months past the last observation.

Then write a concise analysis (under 250 words) for a commodity-market audience covering: the computed trend, the volatility context, and the linear extrapolation. State the R^2 explicitly so the reader can judge how much to trust the extrapolation. Explicitly frame the extrapolation as an illustrative statistical projection, NOT a forecast guarantee or investment advice. Do not state any number you did not compute in code.

CSV data:
${csv}`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [{ role: "user", content: prompt }],
      tools: [{ type: "code_interpreter", container: { type: "auto" } }],
    }),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const code = body?.error?.code as string | undefined;
    const message = (body?.error?.message as string | undefined) || `OpenAI request failed (HTTP ${res.status})`;
    if (code === "insufficient_quota" || code === "credit_balance_exhausted" || res.status === 429) {
      throw new OpenAIQuotaError(message);
    }
    throw new Error(message);
  }

  type MessageItem = { type: "message"; content?: { type: string; text?: string }[] };
  type CodeItem = { type: "code_interpreter_call"; code?: string };
  type OutputItem = MessageItem | CodeItem | { type: string };

  const output: OutputItem[] = body?.output ?? [];

  const analysisText = output
    .filter((o): o is MessageItem => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text" && c.text)
    .map((c) => c.text as string)
    .join("\n\n")
    .trim();

  const codeExecuted = output
    .filter((o): o is CodeItem => o.type === "code_interpreter_call")
    .map((o) => o.code)
    .filter((c): c is string => Boolean(c));

  if (!analysisText) {
    throw new Error("OpenAI returned no analysis text (response shape may have changed).");
  }

  return { analysisText, codeExecuted };
}
