import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndRole } from "@/lib/supabase/session";
import { isBrokerConfigured, placeOrder, BinanceApiError } from "@/lib/broker/binanceClient";

export const runtime = "nodejs";
export const maxDuration = 15;

const SYMBOL_RE = /^[A-Z0-9]{5,20}$/;

/**
 * Places a REAL order with REAL money on the account's Binance spot wallet.
 * Gated behind profiles.role = 'admin' (same pattern as the existing
 * manual-pipeline-trigger admin action) rather than merely "signed in" —
 * this app has a public signup flow, and any authenticated-but-non-admin
 * user must never be able to reach this. `confirm: true` is required in
 * the body as defense-in-depth: the client-side UI already requires a
 * separate review step before sending this request at all, but this
 * ensures the endpoint itself refuses to act on an incomplete/accidental
 * call regardless of what called it.
 */
export async function POST(req: NextRequest) {
  const { isAdmin } = await getCurrentUserAndRole();
  if (!isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isBrokerConfigured()) {
    return NextResponse.json({ error: "broker not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const { symbol, side, type, quantity, price, confirm } = (body ?? {}) as Record<string, unknown>;

  if (confirm !== true) {
    return NextResponse.json({ error: "order must be explicitly confirmed (confirm: true)" }, { status: 400 });
  }
  if (typeof symbol !== "string" || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }
  if (side !== "BUY" && side !== "SELL") {
    return NextResponse.json({ error: "side must be BUY or SELL" }, { status: 400 });
  }
  if (type !== "MARKET" && type !== "LIMIT") {
    return NextResponse.json({ error: "type must be MARKET or LIMIT" }, { status: 400 });
  }
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
  }
  let limitPrice: number | undefined;
  if (type === "LIMIT") {
    limitPrice = Number(price);
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      return NextResponse.json({ error: "price must be a positive number for LIMIT orders" }, { status: 400 });
    }
  }

  try {
    const result = await placeOrder({ symbol, side, type, quantity: qty, price: limitPrice });
    return NextResponse.json({ order: result });
  } catch (e) {
    const status = e instanceof BinanceApiError ? 502 : 500;
    const binanceCode = e instanceof BinanceApiError ? e.code : undefined;
    return NextResponse.json({ error: (e as Error).message, binanceCode }, { status });
  }
}
