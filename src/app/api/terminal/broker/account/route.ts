import { NextResponse } from "next/server";
import { getCurrentUserAndRole } from "@/lib/supabase/session";
import { isBrokerConfigured, getAccountBalances, BinanceApiError } from "@/lib/broker/binanceClient";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET() {
  const { isAdmin } = await getCurrentUserAndRole();
  if (!isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isBrokerConfigured()) {
    return NextResponse.json({ error: "broker not configured" }, { status: 503 });
  }
  try {
    const balances = await getAccountBalances();
    return NextResponse.json({ balances });
  } catch (e) {
    const status = e instanceof BinanceApiError ? 502 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
