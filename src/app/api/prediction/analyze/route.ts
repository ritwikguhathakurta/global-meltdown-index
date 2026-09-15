import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchSeries } from "@/lib/metrics/store";
import { COMMODITIES } from "@/lib/commodities/taxonomy";
import { getCandidateCovariates } from "@/lib/prediction/covariates";
import { runPredictionAnalysis, buildAnnualDataset, OpenAIQuotaError } from "@/lib/prediction/openaiAnalysis";

export const runtime = "nodejs";
export const maxDuration = 280;

// Full available history, not an arbitrary recent window — the annual
// multivariate model needs as many real years as each source actually has
// (some price series and USDA PSD balances go back to the 1960s) to have any
// chance of a meaningful backtest.
const FULL_HISTORY_SINCE_ISO = "1900-01-01T00:00:00.000Z";

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "backend not configured" }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
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
    const result = await runPredictionAnalysis(commodity, dataset);

    return NextResponse.json({
      commodity: { slug: commodity.slug, label: commodity.label, unit: commodity.unit, category: commodity.category },
      dataPoints: series.length,
      dataRange: { from: series[0].t, to: series[series.length - 1].t },
      annualYearsUsed: dataset.yearsTotal,
      covariatesUsed: dataset.columnsUsed,
      covariatesDropped: dataset.columnsDropped,
      analysisText: result.analysisText,
      codeExecuted: result.codeExecuted,
    });
  } catch (e) {
    if (e instanceof OpenAIQuotaError) {
      return NextResponse.json({ error: "openai_quota_exceeded", message: e.message }, { status: 402 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
