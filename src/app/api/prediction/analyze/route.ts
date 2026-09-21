import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserAndRole } from "@/lib/supabase/session";
import { fetchSeries } from "@/lib/metrics/store";
import { COMMODITIES } from "@/lib/commodities/taxonomy";
import { getCandidateCovariates } from "@/lib/prediction/covariates";
import { buildAnnualDataset, OpenAIQuotaError } from "@/lib/prediction/openaiAnalysis";
import { runPredictionAnalysis as runOpenAi } from "@/lib/prediction/openaiAnalysis";
import { runPredictionAnalysis as runGemini, GeminiQuotaError } from "@/lib/prediction/geminiAnalysis";

export const runtime = "nodejs";
export const maxDuration = 280;

// Full available history, not an arbitrary recent window — the annual
// multivariate model needs as many real years as each source actually has
// (some price series and USDA PSD balances go back to the 1960s) to have any
// chance of a meaningful backtest.
const FULL_HISTORY_SINCE_ISO = "1900-01-01T00:00:00.000Z";

// Gemini is the free-tier default (no card required, code execution tool
// included) so the tab works without paid credits; OpenAI remains available
// as a fallback for anyone who's configured it instead/as well.
function pickProvider(): "gemini" | "openai" | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

// Each call runs a paid, code-executing LLM analysis (up to 280s), and signup
// is open — so requiring login alone still lets any new account loop it.
// This is a best-effort per-user cooldown held in this serverless instance's
// memory: it stops a single account hammering one instance, but is NOT a
// global limit (separate instances don't share it). A hard limit needs shared
// storage (e.g. a Postgres counter or Vercel KV).
const COOLDOWN_MS = 60_000;
const lastCallByUser = new Map<string, number>();

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "backend not configured" }, { status: 503 });
  }

  // /api/* is outside the proxy's protected prefixes, so this route has to
  // authenticate for itself (the page that calls it is behind login, the API
  // was not).
  const { user } = await getCurrentUserAndRole();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = Date.now();
  const last = lastCallByUser.get(user.id);
  if (last !== undefined && now - last < COOLDOWN_MS) {
    const retryAfter = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return NextResponse.json({ error: `please wait ${retryAfter}s between analyses` }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }
  lastCallByUser.set(user.id, now);
  if (lastCallByUser.size > 1000) {
    for (const [id, t] of lastCallByUser) if (now - t > COOLDOWN_MS) lastCallByUser.delete(id);
  }

  const provider = pickProvider();
  if (!provider) {
    return NextResponse.json({ error: "no prediction LLM provider configured (need GEMINI_API_KEY or OPENAI_API_KEY)" }, { status: 503 });
  }

  let slug: string | undefined;
  try {
    const parsed = await req.json();
    slug = parsed?.slug;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const commodity = COMMODITIES.find((c) => c.slug === slug);
  if (!commodity) {
    return NextResponse.json({ error: `unknown commodity slug: ${slug}` }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const series = await fetchSeries(db, `commodity.${commodity.slug}.price`, FULL_HISTORY_SINCE_ISO);

    if (series.length < 12) {
      return NextResponse.json(
        {
          error: `not enough real price history for ${commodity.label} yet (${series.length} points, need at least 12)`,
        },
        { status: 422 }
      );
    }

    const candidates = getCandidateCovariates(commodity.slug);
    const covariateSeries = await Promise.all(
      candidates.map(async (def) => ({ def, series: await fetchSeries(db, def.metricKey, FULL_HISTORY_SINCE_ISO) }))
    );

    const dataset = buildAnnualDataset(series, covariateSeries);
    const result = provider === "gemini" ? await runGemini(commodity, dataset) : await runOpenAi(commodity, dataset);

    return NextResponse.json({
      commodity: { slug: commodity.slug, label: commodity.label, unit: commodity.unit, category: commodity.category },
      provider,
      dataPoints: series.length,
      dataRange: { from: series[0].t, to: series[series.length - 1].t },
      annualYearsUsed: dataset.yearsTotal,
      covariatesUsed: dataset.columnsUsed,
      covariatesDropped: dataset.columnsDropped,
      analysisText: result.analysisText,
      codeExecuted: result.codeExecuted,
    });
  } catch (e) {
    if (e instanceof OpenAIQuotaError || e instanceof GeminiQuotaError) {
      return NextResponse.json({ error: "llm_quota_exceeded", message: e.message }, { status: 402 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
