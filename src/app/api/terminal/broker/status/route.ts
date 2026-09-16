import { NextResponse } from "next/server";
import { getCurrentUserAndRole } from "@/lib/supabase/session";
import { isBrokerConfigured } from "@/lib/broker/binanceClient";

export const runtime = "nodejs";

export async function GET() {
  const { isAdmin } = await getCurrentUserAndRole();
  if (!isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ configured: isBrokerConfigured() });
}
