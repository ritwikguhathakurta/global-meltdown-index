import type { Point } from "../metrics/stats";
import type { CommodityDef } from "../commodities/taxonomy";
import type { CovariateSeriesDef } from "./covariates";

/**
 * Thrown specifically when OpenAI rejects the request for billing/quota
 * reasons (insufficient_quota, credit_balance_exhausted, or a bare 429 with
 * no other body) — distinct from a genuine request/server error, so the API
 * route can surface a "add credits" message instead of a stack trace.
 */
export class OpenAIQuotaError extends Error {}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// gpt-4o-mini was tried first for cost, but observed live to stop after 1-2
// code_interpreter calls with interim narration ("let's visualize the data
// to decide...") instead of completing the multi-step backtest — it treats
// itself as mid-conversation with a user who never replies. gpt-4.1-mini is
// materially more reliable at finishing an unsupervised multi-step tool-use
// task in one batch turn, at a still-modest cost; the continuation loop
// below is a second line of defense regardless of model choice.
const MODEL = process.env.OPENAI_PREDICTION_MODEL || "gpt-4.1-mini";
const MAX_CONTINUATION_ROUNDS = 3;

export type PredictionAnalysisResult = {
  analysisText: string;
  codeExecuted: string[];
};

/** Minimum real overlapping annual observations a covariate needs against
 * the commodity's own price years before it's trusted as a model feature —
 * below this, a "multivariate" fit would just be curve-fitting noise dressed
 * up as precision. */
const MIN_COVARIATE_OVERLAP_YEARS = 15;

function toAnnualMeans(series: Point[]): Map<number, number> {
  const sums = new Map<number, { total: number; count: number }>();
  for (const p of series) {
    const year = new Date(p.t).getUTCFullYear();
    const bucket = sums.get(year) ?? { total: 0, count: 0 };
    bucket.total += p.v;
    bucket.count += 1;
    sums.set(year, bucket);
  }
  const means = new Map<number, number>();
  for (const [year, { total, count }] of sums) means.set(year, total / count);
  return means;
}

function sanitizeColumnName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type AnnualDataset = {
  csv: string;
  yearsTotal: number;
  columnsUsed: string[];
  columnsDropped: { label: string; reason: string }[];
};

/**
 * Joins a commodity's real price series (any frequency, aggregated to
 * annual means) with zero or more real covariate series on calendar year.
 * Any covariate with fewer than MIN_COVARIATE_OVERLAP_YEARS real
 * overlapping points against the price series' own years is dropped rather
 * than silently fit on too little data — the caller surfaces which
 * covariates were kept/dropped and why for full transparency.
 */
export function buildAnnualDataset(
  priceSeries: Point[],
  covariates: { def: CovariateSeriesDef; series: Point[] }[]
): AnnualDataset {
  const priceByYear = toAnnualMeans(priceSeries);
  const years = Array.from(priceByYear.keys()).sort((a, b) => a - b);

  const kept: { def: CovariateSeriesDef; column: string; byYear: Map<number, number> }[] = [];
  const columnsDropped: { label: string; reason: string }[] = [];
  const usedColumnNames = new Set<string>(["price"]);

  for (const { def, series } of covariates) {
    const byYear = toAnnualMeans(series);
    const overlap = years.filter((y) => byYear.has(y)).length;
    if (overlap < MIN_COVARIATE_OVERLAP_YEARS) {
      columnsDropped.push({
        label: def.label,
        reason: `only ${overlap} real overlapping year(s) of history against this commodity's price series (need at least ${MIN_COVARIATE_OVERLAP_YEARS})`,
      });
      continue;
    }
    let column = sanitizeColumnName(def.label);
    while (usedColumnNames.has(column)) column = `${column}_2`;
    usedColumnNames.add(column);
    kept.push({ def, column, byYear });
  }

  const header = ["year", "price", ...kept.map((k) => k.column)];
  const rows = years.map((y) => {
    const cells = [String(y), String(priceByYear.get(y))];
    for (const k of kept) {
      const v = k.byYear.get(y);
      cells.push(v === undefined ? "" : String(v));
    }
    return cells.join(",");
  });

  return {
    csv: [header.join(","), ...rows].join("\n"),
    yearsTotal: years.length,
    columnsUsed: kept.map((k) => `${k.column} (${k.def.label})`),
    columnsDropped,
  };
}

/**
 * Runs OpenAI's Code Interpreter tool (Responses API) against a commodity's
 * real price history, joined with whatever real covariates cleared the
 * overlap bar in buildAnnualDataset(). The model must fit on real executed
 * Python (pandas/numpy/scikit-learn) and — critically — report accuracy
 * from a genuine held-out backtest, never in-sample fit, which is the
 * difference between an honest number and a curve-fit one. A poor backtest
 * result must be reported as poor, not hedged into sounding better than it
 * is; this app's own rule is that a number that looks wrong (or too good)
 * gets investigated, never shipped as-is.
 */
/**
 * Provider-agnostic prompt — the wording is what enforces the "real
 * executed code, honest backtest, no fabricated numbers" contract, so both
 * the OpenAI and Gemini implementations share this single copy rather than
 * risking the two drifting apart.
 */
export function buildPredictionPrompt(
  commodity: Pick<CommodityDef, "slug" | "label" | "unit">,
  dataset: AnnualDataset,
  toolName: string
): string {
  const hasCovariates = dataset.columnsUsed.length > 0;
  const covariateList = hasCovariates
    ? dataset.columnsUsed.join(", ")
    : "none available with enough real overlapping history — use price history alone";

  return `This is a single NON-INTERACTIVE batch job. There is no user available to reply to questions, confirm a plan, or approve a next step — you must complete the entire task autonomously in this one turn, chaining as many ${toolName} calls back-to-back as needed. Never stop to say things like "let's do X to decide Y" or "shall I proceed" — just proceed. The task is not done until you have produced the final written analysis described in step 6.

You are building an HONESTLY VALIDATED statistical model for ${commodity.label} (unit: ${commodity.unit}) prices, using REAL annual data given below as CSV. Columns: year, price (annual mean of this app's own real commodity price database — ultimately World Bank Pink Sheet / IMF PCPS), ${dataset.yearsTotal} years of it, followed by these real covariate columns where available: ${covariateList}. Covariates come from this app's own already-ingested real sources (USDA PSD world production/consumption/stocks, EIA world energy fundamentals, FAOSTAT world production, or the Fed's Broad Dollar Index) — never synthetic.

CSV data:
${dataset.csv}

Using ${toolName} (pandas/numpy/scikit-learn), do ALL of the following with real executed code in this one turn — never state a number you did not compute, and never pause between steps:

1. Load the CSV. Drop rows with missing values in any column you plan to use as a feature. Report how many usable rows remain.
2. If fewer than 15 usable rows remain, or there are no usable covariate columns, STOP any multivariate attempt: fit a simple model of log(price) vs. year instead, and say explicitly that there wasn't enough real covariate history for a multivariate fit.
3. Otherwise, decide whether to model price or log(price) based on whether the series looks trending/non-stationary (say which you chose and why), then fit an interpretable multivariate model (plain OLS or Ridge regression via scikit-learn — not an opaque ensemble) using the available covariate columns plus a time trend as features.
4. Backtest HONESTLY: hold out the most recent 20% of years (at least the last 3, whichever is larger) as a test set never seen during fitting. Fit only on the earlier years, predict the held-out years, and compute the test-set R² and MAPE against the REAL actual prices in those held-out years. This out-of-sample number is what matters — report it prominently and honestly. If it is low, or even negative (meaning the model is worse than just guessing the historical mean), say so plainly. Do not soften a bad result.
5. Only after reporting the honest backtested accuracy, refit on ALL available years and extrapolate 1, 2, and 3 years past the last observed year (holding any covariates flat at their last observed value — state this simplifying assumption explicitly).
6. Write a concise FINAL analysis (under 300 words) that LEADS with the backtested test-set R²/MAPE and a plain-language verdict on whether this model is actually useful for forecasting this specific commodity. Name which covariates mattered most (by standardized coefficient magnitude), if any were used. Only then give the extrapolated figures, hedged in proportion to how good (or poor) the backtested accuracy actually was. This is an illustrative statistical exercise, not a forecast guarantee or investment advice. This final analysis is the deliverable — do not end the turn before writing it.`;
}

export async function runPredictionAnalysis(
  commodity: Pick<CommodityDef, "slug" | "label" | "unit">,
  dataset: AnnualDataset
): Promise<PredictionAnalysisResult> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const prompt = buildPredictionPrompt(commodity, dataset, "code_interpreter");

  type MessageItem = { type: "message"; content?: { type: string; text?: string }[] };
  type CodeItem = { type: "code_interpreter_call"; code?: string };
  type OutputItem = MessageItem | CodeItem | { type: string };
  type ResponsesBody = {
    id?: string;
    status?: string;
    output?: OutputItem[];
    error?: { code?: string; message?: string };
  };

  async function callResponses(input: unknown, previousResponseId?: string): Promise<ResponsesBody> {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input,
        tools: [{ type: "code_interpreter", container: { type: "auto" } }],
        ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      }),
    });
    const body = (await res.json().catch(() => null)) as ResponsesBody | null;
    if (!res.ok) {
      const code = body?.error?.code;
      const message = body?.error?.message || `OpenAI request failed (HTTP ${res.status})`;
      if (code === "insufficient_quota" || code === "credit_balance_exhausted" || res.status === 429) {
        throw new OpenAIQuotaError(message);
      }
      throw new Error(message);
    }
    if (!body) throw new Error("OpenAI returned an unparseable response body");
    return body;
  }

  function extractText(body: ResponsesBody): string {
    return (body.output ?? [])
      .filter((o): o is MessageItem => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === "output_text" && c.text)
      .map((c) => c.text as string)
      .join("\n\n")
      .trim();
  }

  function extractCode(body: ResponsesBody): string[] {
    return (body.output ?? [])
      .filter((o): o is CodeItem => o.type === "code_interpreter_call")
      .map((o) => o.code)
      .filter((c): c is string => Boolean(c));
  }

  // Weaker models (and occasionally stronger ones) sometimes end their turn
  // with interim narration ("let's plot this to decide...") instead of the
  // requested final report — there's no user here to respond to that, so
  // detect it and explicitly push the model to finish rather than silently
  // shipping a half-finished analysis.
  function looksComplete(text: string): boolean {
    if (text.length < 200) return false;
    const lower = text.toLowerCase();
    return /r[²2^]/.test(lower) && lower.includes("backtest");
  }

  let body = await callResponses([{ role: "user", content: prompt }]);
  let analysisText = extractText(body);
  const codeExecuted: string[] = extractCode(body);

  let round = 0;
  while (!looksComplete(analysisText) && body.id && round < MAX_CONTINUATION_ROUNDS) {
    round += 1;
    const previousId = body.id;
    body = await callResponses(
      [
        {
          role: "user",
          content:
            "Continue now. This is still a non-interactive batch job with no user to respond to you — do not ask what to do next. Complete every remaining step immediately: fit the model, run the honest held-out backtest, compute the real test-set R² and MAPE, extrapolate, and write the final under-300-word analysis leading with that backtested accuracy. Finish in this turn.",
        },
      ],
      previousId
    );
    const nextText = extractText(body);
    if (nextText) analysisText = nextText;
    codeExecuted.push(...extractCode(body));
  }

  if (!analysisText) {
    throw new Error("OpenAI returned no analysis text (response shape may have changed).");
  }

  return { analysisText, codeExecuted };
}
