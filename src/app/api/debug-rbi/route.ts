import { NextResponse } from "next/server";
import { fetchRbiCurrentListingHtml } from "@/lib/sources/rbiArchive";

export const runtime = "nodejs";
export const maxDuration = 60;

// TEMPORARY diagnostic route — isolates a single RBI fetch outside the
// pipeline's Promise.all/mapWithConcurrency error-swallowing paths, to see
// the exact error (not a generic re-summarized one) straight from Vercel's
// network. Delete once the RBI timeout investigation concludes.
export async function GET() {
  const startedAt = Date.now();
  try {
    const html = await fetchRbiCurrentListingHtml();
    return NextResponse.json({ ok: true, elapsedMs: Date.now() - startedAt, htmlLength: html.length });
  } catch (e) {
    const err = e as Error & { cause?: unknown };
    return NextResponse.json({
      ok: false,
      elapsedMs: Date.now() - startedAt,
      name: err.name,
      message: err.message,
      cause: err.cause ? String(err.cause) : null,
      stack: err.stack,
    });
  }
}
