import { NextResponse } from "next/server";

export const DISCLAIMER =
  "CURRENT MACRO/MARKET ASSESSMENT — NOT A GUARANTEED FORECAST OR INVESTMENT RECOMMENDATION.";

export function apiResponse<T>(data: T, extra?: Record<string, unknown>) {
  return NextResponse.json({ data, disclaimer: DISCLAIMER, ...extra });
}

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message, disclaimer: DISCLAIMER }, { status });
}
