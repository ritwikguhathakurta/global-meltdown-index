// Zero-signup demo: hits this project's own public read API and prints real, live data.
// Run against production (default) or a local dev server:
//   npm run demo
//   DEMO_BASE_URL=http://localhost:3000 npm run demo
//
// Every value printed here comes straight from `/api/*` — nothing in this script computes,
// mocks, or reformats a number beyond picking which fields to show.

const BASE_URL = process.env.DEMO_BASE_URL ?? "https://globalmeltdownindex.net";

interface GfmiResponse {
  data?: { current?: { as_of: string; score: number; regime: string; confidence: number; components?: Record<string, unknown> } };
}
interface EngineResponse {
  data?: {
    horizons?: Array<{
      horizon: string;
      as_of: string;
      score: number;
      regime: string;
      direction: string;
      top_drivers?: Array<{ label: string; contribution: number }>;
    }>;
  };
}
interface LeadingIndicatorsResponse {
  data?: { indicators?: Array<{ status: string }> };
}
interface SourcesResponse {
  data?: { sources?: Array<{ tier: number }> };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function heading(title: string) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

async function main() {
  console.log(`Global Meltdown Index — live API demo (${BASE_URL})`);
  console.log("No API key, no signup. Every number below is a real, current response.");

  heading("Operational health — GET /api/health");
  const health = await getJson<unknown>("/api/health");
  console.log(JSON.stringify(health, null, 2));

  heading("Composite score — GET /api/gfmi");
  const gfmi = await getJson<GfmiResponse>("/api/gfmi");
  const current = gfmi?.data?.current;
  if (current) {
    const componentCount = Object.keys(current.components ?? {}).length;
    console.log(
      `as_of=${current.as_of} score=${current.score} regime="${current.regime}" ` +
        `confidence=${current.confidence} components=${componentCount}`,
    );
  }

  heading("One engine, in detail — GET /api/credit");
  const credit = await getJson<EngineResponse>("/api/credit");
  const shortHorizon = credit?.data?.horizons?.find((h) => h.horizon === "short");
  if (shortHorizon) {
    console.log(
      `as_of=${shortHorizon.as_of} score=${shortHorizon.score} regime="${shortHorizon.regime}" ` +
        `direction=${shortHorizon.direction}`,
    );
    for (const driver of (shortHorizon.top_drivers ?? []).slice(0, 3)) {
      console.log(`  - ${driver.label} (contribution ${driver.contribution})`);
    }
  }

  heading("Breadth across every engine — GET /api/leading-indicators");
  const leading = await getJson<LeadingIndicatorsResponse>("/api/leading-indicators");
  const indicators = leading?.data?.indicators ?? [];
  const live = indicators.filter((i) => i.status === "LIVE").length;
  const stale = indicators.filter((i) => i.status === "STALE").length;
  const unavailable = indicators.filter((i) => i.status === "UNAVAILABLE").length;
  console.log(
    `${indicators.length} indicators total — ${live} LIVE, ${stale} STALE, ${unavailable} UNAVAILABLE ` +
      `(this is the project's own "nothing is faked" discipline, not a bug if the STALE count isn't 0)`,
  );

  heading("Source registry — GET /api/sources");
  const sources = await getJson<SourcesResponse>("/api/sources");
  const sourceList = sources?.data?.sources ?? [];
  const byTier = new Map<number, number>();
  for (const s of sourceList) {
    byTier.set(s.tier, (byTier.get(s.tier) ?? 0) + 1);
  }
  console.log(
    `${sourceList.length} registered sources — ` +
      [...byTier.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([tier, n]) => `tier ${tier}: ${n}`)
        .join(", "),
  );

  console.log("\nFull dashboard (free account required): " + `${BASE_URL}/dashboard`);
  console.log("Endpoint list and what each one unlocks: see README.md's \"What's built\" section.");
}

main().catch((err) => {
  console.error(`\nDemo failed: ${(err as Error).message}`);
  console.error("If you're running this against localhost, make sure `npm run dev` is running.");
  process.exit(1);
});
