import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndRole } from "@/lib/supabase/session";
import { isBrokerConfigured, getOpenOrders, BinanceApiError } from "@/lib/broker/binanceClient";

export const runtime = "nodejs";
export const maxDuration = 15;

const SYMBOL_RE = /^[A-Z0-9]{5,20}$/;

export async function GET(req: NextRequest) {
  const { isAdmin } = await getCurrentUserAndRole();
  if (!isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isBrokerConfigured()) {
    return NextResponse.json({ error: "broker not configured" }, { status: 503 });
  }

  const symbol = req.nextUrl.searchParams.get("symbol") ?? undefined;
  if (symbol && !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }

  try {
    const orders = await getOpenOrders(symbol);
    return NextResponse.json({ orders });
  } catch (e) {
    const status = e instanceof BinanceApiError ? 502 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
