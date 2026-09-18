import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { generateCentralBankCommentary, type DecisionCommentary } from "../prediction/centralBankCommentary";
import type { BankDecisionImpact, CentralBankKey } from "./centralBankDecisionImpact";

/**
 * Caches LLM-generated decision commentary (see centralBankCommentary.ts) per
 * DETECTED decision, keyed by (institution, event_date, to_level) — see
 * migration 0040. The LLM is only ever called once per genuinely new
 * decision: every subsequent page load for the same decision reads the
 * cached row. This is what makes "whenever a new rate announcement happens
 * it renders automatically" true without calling OpenAI on every request.
 *
 * Uses the service-role client (not the per-request user-scoped client used
 * elsewhere in engineData.ts) because this cache is shared, publicly
 * displayed content that must be written once regardless of which
 * (unprivileged) user's page load happens to trigger the cache miss — the
 * public RLS policy on this table only grants SELECT.
 */

export type StoredDecisionCommentary = DecisionCommentary & {
  institution: string;
  eventDate: string;
  fromLevel: number;
  toLevel: number;
  changeBps: number;
  generatedAt: string;
};

/**
 * A newly-announced move a bank's own primary source already confirms (e.g.
 * BOJ's decision PDF) that the persistence-confirmed rate SERIES hasn't
 * caught up to yet — see bojAnnouncementText.ts and the doc comment on
 * getCentralBankDecisionCommentary below for why this exists.
 */
export type AnnouncementOverride = { toLevel: number; eventDate: string };

const FX_KEY_BY_BANK: Partial<Record<CentralBankKey, { key: string; label: string }>> = {
  ecb: { key: "fx.usdeur", label: "USD/EUR" },
  boe: { key: "fx.usdgbp", label: "USD/GBP" },
  boj: { key: "fx.usdjpy", label: "USD/JPY" },
  boc: { key: "fx.usdcad", label: "USD/CAD" },
  pboc: { key: "fx.usdcny", label: "USD/CNY" },
  rbi: { key: "fx.usdinr", label: "USD/INR" },
  // fed intentionally has no cross here — there's no single natural USD pair
  // the way there is for the other six.
};

type CommentaryRow = {
  institution: string;
  event_date: string;
  from_level: number;
  to_level: number;
  change_bps: number;
  short_term: string;
  medium_term: string;
  long_term: string;
  trajectory: string;
  generated_at: string;
};

function mapRow(row: CommentaryRow): StoredDecisionCommentary {
  return {
    institution: row.institution,
    eventDate: row.event_date,
    fromLevel: row.from_level,
    toLevel: row.to_level,
    changeBps: row.change_bps,
    shortTerm: row.short_term,
    mediumTerm: row.medium_term,
    longTerm: row.long_term,
    trajectory: row.trajectory,
    generatedAt: row.generated_at,
  };
}

async function loadCached(db: SupabaseClient, institution: string, eventDate: string, toLevel: number): Promise<CommentaryRow | null> {
  const { data } = await db
    .from("central_bank_decision_commentary")
    .select("*")
    .eq("institution", institution)
    .eq("event_date", eventDate)
    .eq("to_level", toLevel)
    .maybeSingle();
  return (data as CommentaryRow | null) ?? null;
}

async function recentFxChange(db: SupabaseClient, key: string): Promise<{ latest: number; changePct: number | null } | null> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const points = await fetchSeries(db, key, since);
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => (a.t < b.t ? -1 : 1));
  const latest = sorted[sorted.length - 1].v;
  const first = sorted[0].v;
  return { latest, changePct: first !== 0 ? ((latest - first) / first) * 100 : null };
}

async function computeOne(db: SupabaseClient, impact: BankDecisionImpact, override?: AnnouncementOverride): Promise<StoredDecisionCommentary | null> {
  const confirmed = impact.lastEvent;

  // Prefer the override (a bank's own primary source, e.g. BOJ's decision
  // PDF) whenever it names a level the confirmed rate SERIES hasn't reached
  // yet — otherwise the confirmed series has already caught up (or this
  // override is stale/matches what's already confirmed) and there's nothing
  // to override.
  const useOverride = override && override.toLevel !== confirmed?.toLevel;

  let eventDate: string;
  let fromLevel: number;
  let toLevel: number;
  let changeBps: number;

  if (useOverride) {
    toLevel = override.toLevel;
    fromLevel = confirmed?.toLevel ?? impact.latestRate ?? override.toLevel;
    eventDate = override.eventDate;
    changeBps = Math.round((toLevel - fromLevel) * 10000) / 100;
  } else if (confirmed) {
    toLevel = confirmed.toLevel;
    fromLevel = confirmed.fromLevel;
    eventDate = confirmed.date.slice(0, 10);
    changeBps = confirmed.changeBps;
  } else {
    return null;
  }

  const cached = await loadCached(db, impact.config.institution, eventDate, toLevel);
  if (cached) return mapRow(cached);

  const fxDef = FX_KEY_BY_BANK[impact.config.key];
  const fx = fxDef ? await recentFxChange(db, fxDef.key) : null;

  const commentary = await generateCentralBankCommentary({
    institution: impact.config.institution,
    countryLabel: impact.config.countryLabel,
    rateLabel: impact.config.rateLabel,
    fromLevel,
    toLevel,
    changeBps,
    eventDate,
    fxLabel: fxDef?.label ?? null,
    fxLatest: fx?.latest ?? null,
    fxChangePct: fx?.changePct ?? null,
    equityLabel: impact.config.equityLabel,
    equityImpact: impact.equityImpact.map((h) => ({ horizonLabel: h.horizonLabel, avgChangePct: h.avgChangePct, sampleSize: h.sampleSize })),
    pastHikeCount: impact.hikeEvents.length,
    pastCutCount: impact.cutEvents.length,
  });
  if (!commentary) return null;

  const { data, error } = await db
    .from("central_bank_decision_commentary")
    .insert({
      institution: impact.config.institution,
      event_date: eventDate,
      from_level: fromLevel,
      to_level: toLevel,
      change_bps: changeBps,
      short_term: commentary.shortTerm,
      medium_term: commentary.mediumTerm,
      long_term: commentary.longTerm,
      trajectory: commentary.trajectory,
      model: process.env.OPENAI_PREDICTION_MODEL || "gpt-4.1-mini",
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation: another concurrent request generated and
    // inserted this exact decision's commentary first — read what it wrote
    // rather than erroring, dropping our own (redundant) generation.
    if (error.code === "23505") {
      const raced = await loadCached(db, impact.config.institution, eventDate, toLevel);
      return raced ? mapRow(raced) : null;
    }
    console.error(`centralBankDecisionCommentary insert(${impact.config.key}):`, error.message);
    return null;
  }

  return mapRow(data as CommentaryRow);
}

export async function getCentralBankDecisionCommentary(
  db: SupabaseClient,
  bankImpacts: BankDecisionImpact[],
  overrides?: Partial<Record<CentralBankKey, AnnouncementOverride>>
): Promise<Map<CentralBankKey, StoredDecisionCommentary>> {
  const result = new Map<CentralBankKey, StoredDecisionCommentary>();
  await Promise.all(
    bankImpacts.map(async (impact) => {
      try {
        const commentary = await computeOne(db, impact, overrides?.[impact.config.key]);
        if (commentary) result.set(impact.config.key, commentary);
      } catch (e) {
        console.error(`getCentralBankDecisionCommentary(${impact.config.key}):`, (e as Error).message);
      }
    })
  );
  return result;
}
