import { XMLParser } from "fast-xml-parser";
import type { MetricPoint } from "../metrics/store";

/**
 * Major cloud-provider status feeds (AWS, Azure, GCP) — official Tier 1
 * sources, but they publish incident updates as feed items, not a clean
 * numeric series. Rather than fabricate a severity score from free text, this
 * connector counts how many status entries each provider posted in the
 * trailing 7 days and stores that count as the metric — a real, defensible
 * coincident "status-page activity" proxy for the Cyber/Infrastructure engine,
 * not an editorialized incident-severity estimate.
 */
export type CloudStatusFeedDef = { provider: string; metricKey: string; url: string; sourceKey: string };

export const CLOUD_STATUS_FEEDS: CloudStatusFeedDef[] = [
  { provider: "AWS", metricKey: "cyber.aws_status_events_7d", url: "https://status.aws.amazon.com/rss/all.rss", sourceKey: "aws_status" },
  { provider: "Azure", metricKey: "cyber.azure_status_events_7d", url: "https://azure.status.microsoft/en-us/status/feed/", sourceKey: "azure_status" },
  { provider: "Google Cloud", metricKey: "cyber.gcp_status_events_7d", url: "https://status.cloud.google.com/en/feed.atom", sourceKey: "gcp_status" },
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export async function fetchCloudStatusCount(def: CloudStatusFeedDef, observedAtIso: string): Promise<MetricPoint[]> {
  const res = await fetch(def.url, { next: { revalidate: 0 }, headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" } });
  if (!res.ok) throw new Error(`${def.provider} status feed: HTTP ${res.status}`);
  const xml = await res.text();
  const doc = parser.parse(xml);
  const items: unknown[] = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  const list = Array.isArray(items) ? items : items ? [items] : [];

  const cutoff = Date.now() - 7 * 86400 * 1000;
  let count = 0;
  for (const raw of list) {
    const item = raw as Record<string, unknown>;
    const dateRaw = (item.pubDate ?? item.published ?? item.updated) as string | undefined;
    if (!dateRaw) continue;
    const t = new Date(dateRaw).getTime();
    if (!Number.isNaN(t) && t >= cutoff) count++;
  }

  return [
    {
      metric_key: def.metricKey,
      observed_at: observedAtIso,
      value: count,
      unit: "events",
      source_key: def.sourceKey,
      source_tier: 1,
      frequency: "daily",
    },
  ];
}
