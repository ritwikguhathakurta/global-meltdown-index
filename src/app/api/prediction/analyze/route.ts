import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchSeries } from "@/lib/metrics/store";
import { COMMODITIES } from "@/lib/commodities/taxonomy";
import { runPredictionAnalysis, OpenAIQuotaError } from "@/lib/prediction/openaiAnalysis";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    const sinceIso = new Date(Date.now() - 15 * 365 * 24 * 3600 * 1000).toISOString();
    const series = await fetchSeries(db, `commodity.${commodity.slug}.price`, sinceIso);

    if (series.length < 12) {
      return NextResponse.json(
        {
          error: `not enough real price history for ${commodity.label} yet (${series.length} points, need at least 12)`,
        },
        { status: 422 }
      );
    }

    const result = await runPredictionAnalysis(commodity, series);

    return NextResponse.json({
      commodity: { slug: commodity.slug, label: commodity.label, unit: commodity.unit, category: commodity.category },
      dataPoints: series.length,
      dataRange: { from: series[0].t, to: series[series.length - 1].t },
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
