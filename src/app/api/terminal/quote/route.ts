import { NextRequest, NextResponse } from "next/server";
import { fetchTickerQuote } from "@/lib/sources/yahooLiveQuote";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
  if (!symbol) {
    return NextResponse.json({ error: "symbol query param required" }, { status: 400 });
  }
  if (symbol.length > 20) {
    return NextResponse.json({ error: "symbol too long" }, { status: 400 });
  }

  const quote = await fetchTickerQuote({ symbol, label: symbol, assetClass: "Custom" });
  if (quote.error) {
    return NextResponse.json({ error: quote.error }, { status: 502 });
  }
  return NextResponse.json(quote);
}
