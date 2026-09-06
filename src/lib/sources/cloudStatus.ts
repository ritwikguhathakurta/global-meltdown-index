import { XMLParser } from "fast-xml-parser";
import type { MetricPoint } from "../metrics/store";

/**
 * Major cloud-provider status feeds (AWS, Azure, GCP) — official Tier 1
 * sources, but they publish incident updates as feed items, not a clean
 * numeric series. Rather than fabricate a severity score from free text, this
 * connector counts how many status entries each provider posted in a
 * trailing 7-day window and stores that count as the metric — a real,
 * defensible coincident "status-page activity" proxy for the
 * Cyber/Infrastructure engine, not an editorialized incident-severity
 * estimate.
 *
 * A naive version of this only ever computed "count in the last 7 days as
 * of right now" and stored one point per day, which meant a fresh deploy
 * sat below the 20-observation z-score floor for ~3 weeks of natural daily
 * accumulation. But these feeds' items carry real publish dates spanning
 * back well past 7 days (AWS's feed, for example, currently holds items
 * back to early March) — so on first run we reconstruct the trailing-7-day
 * count for every past day the feed's item dates actually cover, from a
 * single fetch. This is a real historical count derived from real
 * published timestamps, not an estimate: for a past day D, "how many
 * status items were published in the 7 days before D" is fully determined
 * by the item list already in hand.
 *
 * Backfill is one-time and gap-filling only, never a recompute-and-overwrite:
 * `ingestCloudStatus` in the pipeline checks how many rows already exist for
 * a metric before deciding whether to backfill or just append today's point.
 * This matters because these feeds trim old items over time — if we blindly
 * recomputed the whole history on every run, a provider's old incidents
 * rolling off its feed would silently zero out previously-correct stored
 * values. Backfilling once, then only ever appending forward, avoids that.
 *
 * Backfill also only runs when the feed's oldest item is old enough to clear
 * the 20-observation floor on its own (>= 20 days before the oldest item) —
 * otherwise (a feed with too few/too-recent items, e.g. Azure with none
 * right now) it falls back to the single-current-day point and lets it
 * accumulate naturally, rather than assuming a window of "0" with no actual
 * evidence behind it.
 */
export type CloudStatusFeedDef = { provider: string; metricKey: string; url: string; sourceKey: string };

export const CLOUD_STATUS_FEEDS: CloudStatusFeedDef[] = [
  { provider: "AWS", metricKey: "cyber.aws_status_events_7d", url: "https://status.aws.amazon.com/rss/all.rss", sourceKey: "aws_status" },
  { provider: "Azure", metricKey: "cyber.azure_status_events_7d", url: "https://azure.status.microsoft/en-us/status/feed/", sourceKey: "azure_status" },
  { provider: "Google Cloud", metricKey: "cyber.gcp_status_events_7d", url: "https://status.cloud.google.com/en/feed.atom", sourceKey: "gcp_status" },
];

const WINDOW_DAYS = 7;
export const MIN_BACKFILL_OBSERVATIONS = 20;
const MAX_BACKFILL_DAYS = 400; // matches lookbackDaysFor("daily") — older points would never be read anyway

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function parseItemTimestamps(xml: string): number[] {
  const doc = parser.parse(xml);
  const items: unknown[] = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  const list = Array.isArray(items) ? items : items ? [items] : [];

  const timestamps: number[] = [];
  for (const raw of list) {
    const item = raw as Record<string, unknown>;
    const dateRaw = (item.pubDate ?? item.published ?? item.updated) as string | undefined;
    if (!dateRaw) continue;
    const t = new Date(dateRaw).getTime();
    if (!Number.isNaN(t)) timestamps.push(t);
  }
  return timestamps;
}

function countInWindow(timestamps: number[], dayEndMs: number): number {
  const windowStart = dayEndMs - WINDOW_DAYS * 86400 * 1000;
  return timestamps.filter((t) => t > windowStart && t <= dayEndMs).length;
}

async function fetchFeedTimestamps(def: CloudStatusFeedDef): Promise<number[]> {
  const res = await fetch(def.url, { next: { revalidate: 0 }, headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" } });
  if (!res.ok) throw new Error(`${def.provider} status feed: HTTP ${res.status}`);
  const xml = await res.text();
  return parseItemTimestamps(xml);
}

/** Ongoing behavior: today's real trailing-7-day count only. Safe to call on every run — never touches past dates. */
export async function fetchCloudStatusCount(def: CloudStatusFeedDef, observedAtIso: string): Promise<MetricPoint[]> {
  const timestamps = await fetchFeedTimestamps(def);
  const todayEnd = new Date(observedAtIso).setUTCHours(23, 59, 59, 999);
  return [
    {
      metric_key: def.metricKey,
      observed_at: observedAtIso,
      value: countInWindow(timestamps, todayEnd),
      unit: "events",
      source_key: def.sourceKey,
      source_tier: 1,
      frequency: "daily",
    },
  ];
}

/**
 * One-time reconstruction of past days from whatever date-stamped items the
 * feed currently holds. Only reconstructs a day if the feed's oldest item is
 * old enough to clear MIN_BACKFILL_OBSERVATIONS on its own; otherwise falls
 * back to `fetchCloudStatusCount`'s single point so we never invent a "0"
 * window we have no evidence for.
 */
export async function fetchCloudStatusBackfill(def: CloudStatusFeedDef, observedAtIso: string): Promise<MetricPoint[]> {
  const timestamps = await fetchFeedTimestamps(def);
  const todayEnd = new Date(observedAtIso).setUTCHours(23, 59, 59, 999);
  const oldest = timestamps.length > 0 ? Math.min(...timestamps) : todayEnd;
  const daysSpan = Math.floor((todayEnd - oldest) / 86400000);

  if (timestamps.length === 0 || daysSpan < MIN_BACKFILL_OBSERVATIONS) {
    return [
      {
        metric_key: def.metricKey,
        observed_at: observedAtIso,
        value: countInWindow(timestamps, todayEnd),
        unit: "events",
        source_key: def.sourceKey,
        source_tier: 1,
        frequency: "daily",
      },
    ];
  }

  const backfillDays = Math.min(daysSpan, MAX_BACKFILL_DAYS);
  const points: MetricPoint[] = [];
  for (let d = backfillDays; d >= 0; d--) {
    const dayEndMs = todayEnd - d * 86400000;
    points.push({
      metric_key: def.metricKey,
      observed_at: new Date(dayEndMs).toISOString().slice(0, 10),
      value: countInWindow(timestamps, dayEndMs),
      unit: "events",
      source_key: def.sourceKey,
      source_tier: 1,
      frequency: "daily",
    });
  }
  return points;
}
