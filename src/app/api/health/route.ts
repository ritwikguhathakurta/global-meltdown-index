import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};
  let dbOk = true;

  try {
    const db = createAdminClient();
    const { error } = await db.from("sources").select("id").limit(1);
    checks.database = error ? "error" : "ok";
    if (error) dbOk = false;
  } catch {
    checks.database = "error";
    dbOk = false;
  }

  checks.fred_api_key_configured = process.env.FRED_API_KEY ? "ok" : "error";

  return NextResponse.json(
    { status: dbOk ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: dbOk ? 200 : 503 }
  );
}
