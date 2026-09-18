import { XMLParser } from "fast-xml-parser";

/**
 * Generic RSS/Atom feed reader for official central-bank press/speech feeds.
 * Feed URLs occasionally move — verify periodically (V3 §12 requires reverification
 * of official sources). This module only produces headline-level records
 * (institution, official, title, date, url); hawkishness/dovishness scoring is a
 * separate NLP pass (not yet implemented — see README Phase roadmap) so those
 * fields are left null rather than guessed.
 */

export type CentralBankFeedDef = {
  institution: string;
  url: string;
  sourceKey: string;
};

export const CENTRAL_BANK_FEEDS: CentralBankFeedDef[] = [
  { institution: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml", sourceKey: "fed_press" },
  { institution: "European Central Bank", url: "https://www.ecb.europa.eu/rss/press.html", sourceKey: "ecb_press" },
  { institution: "Bank of England", url: "https://www.bankofengland.co.uk/rss/news", sourceKey: "boe_press" },
  { institution: "Reserve Bank of India", url: "https://www.rbi.org.in/pressreleases_rss.xml", sourceKey: "rbi_press" },
  // Verified live: a real, working RSS 2.0 feed (same shape as the other four
  // above, so no parser changes needed), English-language, includes actual
  // policy-decision releases (e.g. "Change in the Guideline for Money Market
  // Operations") linked straight to the official PDF. BoC and PBOC were also
  // checked: BoC's feed is RDF/RSS 1.0 (a different item structure this
  // reader doesn't parse) and PBOC's URLs only returned redirects, not a
  // confirmed working feed — neither added rather than silently returning
  // zero events forever.
  { institution: "Bank of Japan", url: "https://www.boj.or.jp/en/rss/whatsnew.xml", sourceKey: "boj_press" },
];

export type CentralBankEventRecord = {
  institution: string;
  official: null;
  role: null;
  event_date: string;
  event_type: string;
  title: string;
  source_url: string;
  source_tier: number;
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export async function fetchCentralBankFeed(def: CentralBankFeedDef): Promise<CentralBankEventRecord[]> {
  const res = await fetch(def.url, { next: { revalidate: 0 }, headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" } });
  if (!res.ok) throw new Error(`${def.institution} feed: HTTP ${res.status}`);
  const xml = await res.text();
  const doc = parser.parse(xml);

  const items: unknown[] =
    doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  const list = Array.isArray(items) ? items : items ? [items] : [];

  return list
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      const title = typeof item.title === "string" ? item.title : (item.title as { "#text"?: string })?.["#text"];
      const link =
        typeof item.link === "string"
          ? item.link
          : (item.link as { "@_href"?: string })?.["@_href"] ?? "";
      const dateRaw = (item.pubDate ?? item.published ?? item.updated) as string | undefined;
      if (!title || !link || !dateRaw) return null;
      const parsedDate = new Date(dateRaw);
      if (Number.isNaN(parsedDate.getTime())) return null;
      return {
        institution: def.institution,
        official: null,
        role: null,
        event_date: parsedDate.toISOString().slice(0, 10),
        event_type: "press_release",
        title,
        source_url: link,
        source_tier: 1,
      } satisfies CentralBankEventRecord;
    })
    .filter((r): r is CentralBankEventRecord => r !== null);
}
