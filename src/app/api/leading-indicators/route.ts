import { apiResponse, apiError } from "@/lib/api/respond";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("risk_engine_scores")
      .select("engine_key, as_of, horizon, leading_indicators")
      .eq("horizon", "short")
      .order("as_of", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    const seen = new Set<string>();
    const latestByEngine = (data ?? []).filter((r) => {
      if (seen.has(r.engine_key)) return false;
      seen.add(r.engine_key);
      return true;
    });

    const indicators = latestByEngine.flatMap((r) =>
      (r.leading_indicators as unknown[]).map((i) => ({ engineKey: r.engine_key, ...(i as object) }))
    );

    return apiResponse({ indicators });
  } catch (e) {
    return apiError((e as Error).message);
  }
}
