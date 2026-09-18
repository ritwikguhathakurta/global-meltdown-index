import Link from "next/link";
import { getLatestEngine, getBankingSystemicRiskTable, getBankLevelTable, getCentralBankFsrChecks, getCentralBankDecisionImpacts, getCentralBankDecisionCommentary, getRecentCentralBankEvents } from "@/lib/api/engineData";
import { fetchLiveMarketQuote } from "@/lib/sources/liveMarketQuotes";
import { fetchAllLiveCentralBankRates } from "@/lib/sources/liveCentralBankRates";
import { fetchBojAnnouncementDetail } from "@/lib/sources/bojAnnouncementText";
import { EngineDetail } from "@/components/EngineDetail";
import {
  BANKING_STAGES,
  STRUCTURAL_WEIGHTS,
  COMPOSITE_WEIGHTS,
  getLeadingCompositeScore,
  type CountryBankingRow,
} from "@/lib/engines/bankingSystemicRisk";
import { CENTRAL_BANKS } from "@/lib/engines/centralBankDecisionImpact";
import { gfmiColor } from "@/components/RegimeBadge";
import { TrendIndicator } from "@/components/TrendIndicator";
import { CENTRAL_BANK_FSR_REGISTRY, fsrFreshness, ourStanceLevel, compareStance, FSR_REGION_ORDER } from "@/lib/data/centralBankFsrRegistry";

// getCentralBankDecisionCommentary can call OpenAI (bounded to a 15s
// per-request timeout, see centralBankCommentary.ts) the first time a bank's
// decision has no cached commentary yet — generous margin above that.
export const maxDuration = 30;

function fmt(v: number | null, unit: string, decimals = 2): string {
  if (v === null) return "—";
  return `${v.toFixed(decimals)}${unit ? " " + unit : ""}`;
}

function fmtUsdBn(v: number | null): string {
  if (v === null) return "—";
  return `$${(v / 1e9).toFixed(1)}B`;
}

function fmtPct(v: number | null, decimals = 1): string {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

function scoreColor(score: number | null): string {
  if (score === null) return "#5a6472";
  if (score < 20) return "#34c085";
  if (score < 40) return "#3fa9f5";
  if (score < 60) return "#e0b93d";
  if (score < 80) return "#e0793d";
  return "#e05a4d";
}

const STAGE_SAMPLE_SCORE = [10, 25, 40, 55, 70, 85, 95];

function stageColor(stage: number | null): { bg: string; fg: string } {
  if (stage === null || stage < 1 || stage > 7) return { bg: "#1a1f28", fg: "#8b96a8" };
  return gfmiColor(STAGE_SAMPLE_SCORE[stage - 1]);
}

function freshnessColor(status: "current" | "due" | "overdue"): string {
  if (status === "current") return "#34c085";
  if (status === "due") return "#e0b93d";
  return "#e0793d";
}

function stanceLabel(level: "calm" | "moderate" | "elevated"): string {
  return level === "calm" ? "Calm" : level === "moderate" ? "Moderate" : "Elevated";
}

function checkStatusBadge(status: string | undefined): { label: string; color: string } {
  if (status === "current") return { label: "Verified", color: "#34c085" };
  if (status === "needs_review") return { label: "Needs review", color: "#e0793d" };
  if (status === "check_failed") return { label: "Check failed", color: "#5a6472" };
  if (status === "not_automated") return { label: "Not automated", color: "#8b96a8" };
  return { label: "Not yet checked", color: "#5a6472" };
}

/** Weighted point contribution of one domain score to a parent composite —
 * i.e. what that domain actually added to the final number, not the domain's
 * own 0-100 reading. Used by the score-breakdown panel below (spec §110/135
 * "why is this score X"). Returns null (rather than 0) when the domain has
 * no data, so a missing input is visibly absent rather than silently
 * contributing zero. */
function contribution(score: number | null, weight: number): number | null {
  if (score === null) return null;
  return Math.round(score * weight * 10) / 10;
}

type Segment = { label: string; value: number | null; color: string };

function ContributionBar({ segments, total }: { segments: Segment[]; total: number | null }) {
  const known = segments.filter((s) => s.value !== null) as { label: string; value: number; color: string }[];
  const sum = known.reduce((a, b) => a + b.value, 0);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded bg-panel-raised">
        {known.map((s) => (
          <div
            key={s.label}
            style={{ width: `${sum > 0 ? (s.value / sum) * 100 : 0}%`, background: s.color }}
            title={`${s.label}: ${s.value} pts`}
          />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-text-dim">
        {segments.map((s) => (
          <span key={s.label}>
            {s.label} <span className="gfew-mono">{s.value ?? "—"}</span>
          </span>
        ))}
        {total !== null && (
          <span className="ml-auto font-semibold text-text">
            = <span className="gfew-mono">{total}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Liquidity-Solvency Matrix quadrant (spec §109/165) — placement uses the
 * same Capital score (solvency proxy) and Liquidity score already computed
 * per country, split at the midpoint of the 0-100 risk scale. Not a true
 * scatter plot (no charting library in this app — see other dashboard pages,
 * which use plain tables/steppers throughout), just the four buckets the
 * spec itself asks for. */
function quadrantFor(r: CountryBankingRow): "healthy" | "solvency_watch" | "liquidity_stress" | "crisis" | null {
  if (r.capitalScore === null || r.liquidityScore === null) return null;
  const highSolvencyRisk = r.capitalScore >= 50;
  const highLiquidityRisk = r.liquidityScore >= 50;
  if (!highSolvencyRisk && !highLiquidityRisk) return "healthy";
  if (highSolvencyRisk && !highLiquidityRisk) return "solvency_watch";
  if (!highSolvencyRisk && highLiquidityRisk) return "liquidity_stress";
  return "crisis";
}

export default async function BankingPage() {
  const [bankingRows, { rows, composite }, bankRows, fsrChecks, bankImpacts, liveUsdJpy, recentEvents, liveRates] = await Promise.all([
    getLatestEngine("banking"),
    getBankingSystemicRiskTable(),
    getBankLevelTable(),
    getCentralBankFsrChecks(),
    getCentralBankDecisionImpacts(),
    fetchLiveMarketQuote("usdjpy"),
    getRecentCentralBankEvents(200),
    fetchAllLiveCentralBankRates(CENTRAL_BANKS.map((b) => b.key)),
  ]);

  // Every recent headline, grouped by institution, straight from the
  // headline feed (centralBankRss.ts) — searched below against each bank's
  // own rate SERIES latest date. A rate series (Fed Funds Effective, BOJ's
  // O/N call rate, etc.) is a REALIZED market average, so it always lags a
  // same-day decision by the source's own normal publish cycle (typically
  // 1-3 business days) even though the announcement itself is already
  // public. Surfacing that gap here, rather than pretending the rate series
  // is instantaneous, is the honest way to answer "why does this look
  // stale right after a decision."
  //
  // Grouped as an array per institution, not collapsed to a single
  // "latest" event: a central bank often posts several items on its
  // decision day (BOJ posted four on 2026-09-18 alone — the actual
  // decision plus three housekeeping amendments), and picking just
  // whichever one happened to sort first for a tied date/time previously
  // meant the real decision could lose to an unrelated same-day item
  // purely by accident of query ordering. Every item is kept so the
  // rate-relatedness check below can search all of them, not just one.
  const eventsByInstitution = new Map<string, { date: string; title: string; url: string }[]>();
  for (const e of recentEvents) {
    const arr = eventsByInstitution.get(e.institution) ?? [];
    arr.push({ date: e.event_date, title: e.title, url: e.source_url });
    eventsByInstitution.set(e.institution, arr);
  }

  // BOJ is the one bank where a decision's actual new rate can be read
  // straight from its own PDF the same day it's published — see
  // bojAnnouncementText.ts for why this is safe to do (a verified regex
  // extraction from BOJ's own standing template, not a guess) and why it
  // isn't attempted for the other six banks (no equivalent template
  // confirmed for them). Only fetched for the exact decision title, not
  // every rate-related headline, to avoid wasting a PDF fetch+parse on
  // housekeeping amendments or unrelated items. fetchBojAnnouncementDetail
  // itself never throws (see that file) — a PDF-parsing failure degrades to
  // "the box doesn't show," never a page crash.
  const bojDecisionEvent = (eventsByInstitution.get("Bank of Japan") ?? []).find(
    (e) => e.title === "Change in the Guideline for Money Market Operations"
  );
  const bojAnnouncement = bojDecisionEvent ? await fetchBojAnnouncementDetail(bojDecisionEvent.url) : null;

  // LLM-generated analyst commentary (impact + probable trajectory) for
  // every bank's most recently DETECTED decision — see
  // centralBankDecisionCommentary.ts. Cached per (institution, event_date,
  // to_level) so this only calls OpenAI once per genuinely new decision;
  // every other page load reads the cached row. Runs after bankImpacts
  // (rather than joining the Promise.all above) because it needs each
  // bank's already-detected lastEvent as input.
  //
  // BOJ gets an override: rate.japan_call_rate is a REALIZED average that
  // lags a same-day announcement by several business days (the same gap
  // bojAnnouncement.ts exists to bridge for the PDF box above), so
  // detectRateChangeEvents' persistence-confirmed lastEvent would otherwise
  // still point at the PREVIOUS confirmed move, not today's real one — the
  // commentary would explain the wrong decision. When BOJ's PDF-extracted
  // target differs from what's already confirmed, generate commentary about
  // the newly announced move instead (still real, verified numbers — the
  // same PDF extraction, just also feeding the commentary generator).
  const commentaryOverrides =
    bojAnnouncement && bojAnnouncement.targetRatePercent !== null && bojDecisionEvent
      ? { boj: { toLevel: bojAnnouncement.targetRatePercent, eventDate: bojDecisionEvent.date.slice(0, 10) } }
      : undefined;
  const decisionCommentary = await getCentralBankDecisionCommentary(bankImpacts, commentaryOverrides);

  const fsrCheckByKey = new Map(fsrChecks.map((c) => [c.key, c]));
  const rankedBanks = [...bankRows].sort((a, b) => (b.riskScore ?? -1) - (a.riskScore ?? -1));

  const ranked = [...rows].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
  const topRisks = ranked.filter((r) => r.compositeScore !== null).slice(0, 6);
  const hiddenRisks = rows.filter((r) => r.hiddenRisk);
  const marketWarnings = rows.filter((r) => r.marketLedWarning);

  const bankingComposite = bankingRows.find((r) => r.horizon === "short") ?? bankingRows[0] ?? null;

  const leadingComposite = getLeadingCompositeScore(rows);
  const rankedByLeading = [...rows].filter((r) => r.leadingScore !== null).sort((a, b) => (b.leadingScore as number) - (a.leadingScore as number));
  const banksWithLeading = bankRows.filter((b) => b.leadingScore !== null);
  const usBankLeadingOverlay =
    banksWithLeading.length > 0
      ? Math.round(banksWithLeading.reduce((a, b) => a + (b.leadingScore as number), 0) / banksWithLeading.length)
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Global Banking Systemic Risk</h1>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        Country-level capital, credit, funding, liquidity and bank-equity-market tracking across nine
        banking systems (the G7 plus China and India). This is a new analytical layer — it does not add
        a second vote to GFMI; the existing GFMI-weighted &ldquo;Banking&rdquo; engine below (US
        delinquency/charge-off/CRE data plus Euro-area/UK funding-cost context) is unchanged. See the
        methodology page for exactly what free data each layer covers and what bank-level detail (CET1,
        LCR, NSFR, deposit concentration, interbank network) is genuinely unavailable rather than faked.
      </p>

      {bankImpacts.length > 0 && (
        <section className="gfew-panel mb-8 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Central Bank Policy Decisions — Live Level &amp; Historical Impact on Bank Equities
          </h3>
          <p className="mb-4 max-w-3xl text-xs text-text-dim">
            The <Link href="/dashboard/central-banks" className="text-accent hover:underline">Central Bank Intelligence</Link>{" "}
            tab tracks dateless press-release headlines (Fed/ECB/BOE/RBI/BOJ) — this panel is the only place a
            decision&apos;s actual numeric effect shows up. Each bank&apos;s big number is the once-daily batch
            reading everything below it is computed from; the small green &ldquo;Live&rdquo; line under it is
            the same official source (FRED for Fed/ECB/PBOC, BoE&apos;s own database, BoC&apos;s Valet API,
            BOJ&apos;s Time-Series API, RBI&apos;s daily press release) queried fresh at page load, and turns
            green when it&apos;s newer than the batch figure. Rate changes are checked for a genuine level
            change: rounded to
            the nearest 5bp and confirmed only once the new level has held for 5 consecutive trading days
            (monthly series need no such smoothing), which filters a realized rate&apos;s own day-to-day noise
            without missing a real move by more than about a week. &ldquo;Latest official announcements&rdquo;
            on each card below links to that bank&apos;s own primary source for decision detail (vote counts,
            dissents, forward guidance) this app doesn&apos;t have as structured data and won&apos;t fabricate.
            The event-study panel is real historical fact, not a prediction, of that bank&apos;s own past
            hikes vs. its bank-equity proxy; sample sizes are small by nature for a bank with a short hiking
            history and are always shown, never hidden.
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {bankImpacts.map((b) => (
              <div key={b.config.key} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-text">{b.config.institution}</div>
                    <div className="text-[10px] text-text-dim">{b.config.countryLabel}</div>
                    <a href={b.config.officialUrl} target="_blank" rel="noreferrer" className="text-[10px] text-accent hover:underline">
                      Latest official announcements &rarr;
                    </a>
                  </div>
                  <div className="text-right">
                    <div className="gfew-mono text-xl font-bold text-text">{b.latestRate !== null ? `${b.latestRate.toFixed(3)}%` : "—"}</div>
                    <div className="text-[9px] text-text-dim">
                      {b.config.rateLabel} &middot; as of {b.latestDate?.slice(0, 10) ?? "—"}
                    </div>
                    {(() => {
                      const live = liveRates.get(b.config.key);
                      if (!live) return null;
                      const isNewer = !b.latestDate || live.asOfDate > b.latestDate.slice(0, 10);
                      return (
                        <div className="mt-0.5 text-[10px]" style={{ color: isNewer ? "#34c085" : "#8b96a8" }}>
                          Live: <span className="gfew-mono font-semibold">{live.rate.toFixed(3)}%</span> as of {live.asOfDate}
                          {isNewer ? " (newer)" : ""}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {b.lastEvent ? (
                  <div className="mb-2 text-xs">
                    <span className="font-semibold" style={{ color: b.lastEvent.changeBps > 0 ? "#e0793d" : "#3fa9f5" }}>
                      {b.lastEvent.changeBps > 0 ? "+" : ""}
                      {b.lastEvent.changeBps} bps
                    </span>{" "}
                    <span className="text-text-dim">
                      ({b.lastEvent.fromLevel.toFixed(2)}% &rarr; {b.lastEvent.toLevel.toFixed(2)}%) &middot; {b.lastEvent.date.slice(0, 10)} &middot;{" "}
                      {b.daysSinceLastEvent} day{b.daysSinceLastEvent === 1 ? "" : "s"} ago
                    </span>
                  </div>
                ) : (
                  <div className="mb-2 text-xs text-text-dim">No confirmed level change detected yet in this series&apos; history.</div>
                )}

                {b.config.key === "boj" && bojAnnouncement && bojAnnouncement.targetRatePercent !== null && (
                  <div className="mb-2 rounded border border-[#34c08555] bg-[#34c08511] p-2 text-[10px] text-text-dim">
                    <strong className="text-text">Newly announced target: {bojAnnouncement.targetRatePercent.toFixed(2)}%</strong>
                    {bojAnnouncement.voteFor !== null && bojAnnouncement.voteAgainst !== null && (
                      <> ({bojAnnouncement.voteFor}-{bojAnnouncement.voteAgainst} vote)</>
                    )}
                    {bojAnnouncement.effectiveDate && <>, effective {bojAnnouncement.effectiveDate}</>} — read directly from BOJ&apos;s own
                    decision PDF (the number above is the realized market rate, which hasn&apos;t caught up to this yet).{" "}
                    <a href={bojAnnouncement.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Source PDF &rarr;
                    </a>
                  </div>
                )}

                {b.config.key === "boj" && liveUsdJpy && (
                  <div className="mb-2 text-xs text-text-dim">
                    USD/JPY (live):{" "}
                    <span className="gfew-mono font-semibold text-text">{liveUsdJpy.price.toFixed(2)}</span>{" "}
                    <span style={{ color: (liveUsdJpy.changePct ?? 0) >= 0 ? "#e05a4d" : "#34c085" }}>
                      {liveUsdJpy.changePct !== null ? `${liveUsdJpy.changePct >= 0 ? "+" : ""}${liveUsdJpy.changePct.toFixed(2)}%` : "—"}
                    </span>
                  </div>
                )}

                <div className="mb-1 text-[9px] uppercase tracking-wide text-text-dim">
                  {b.config.equityLabel} after past hikes ({b.eventStudySampleEvents.length} in sample since{" "}
                  {b.equityCoverageStart?.slice(0, 10) ?? "—"})
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {b.equityImpact.map((h) => (
                    <div key={h.horizonLabel} className="rounded bg-panel-raised p-1.5 text-center">
                      <div className="text-[8px] uppercase tracking-wide text-text-dim">{h.horizonLabel.split(" (")[0]}</div>
                      <div className="gfew-mono text-sm font-bold text-text">
                        {h.avgChangePct !== null ? `${h.avgChangePct >= 0 ? "+" : ""}${h.avgChangePct}%` : "—"}
                      </div>
                      <div className="text-[8px] text-text-dim">
                        {h.positiveCount}/{h.sampleSize} rose
                      </div>
                    </div>
                  ))}
                </div>

                {(() => {
                  const c = decisionCommentary.get(b.config.key);
                  if (!c) return null;
                  return (
                    <div className="mt-2 rounded border border-[#7a6ff055] bg-[#7a6ff011] p-2 text-[10px] leading-relaxed text-text-dim">
                      <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#a89af5]">
                        AI Analyst Commentary — qualitative, not a computed metric
                      </div>
                      <p className="mb-1 text-text">
                        {c.institution} moved {b.config.rateLabel} {c.fromLevel}% &rarr; {c.toLevel}%{" "}
                        ({c.changeBps >= 0 ? "+" : ""}
                        {c.changeBps}bp) around {c.eventDate}.
                      </p>
                      <p className="mb-1">
                        <strong className="text-text">Short term: </strong>
                        {c.shortTerm}
                      </p>
                      <p className="mb-1">
                        <strong className="text-text">Medium term: </strong>
                        {c.mediumTerm}
                      </p>
                      <p className="mb-1">
                        <strong className="text-text">Long term: </strong>
                        {c.longTerm}
                      </p>
                      <p className="mb-1">
                        <strong className="text-text">Probable trajectory: </strong>
                        {c.trajectory}
                      </p>
                      <p className="mt-2 text-[9px] italic text-text-dim/70">
                        Generated {new Date(c.generatedAt).toISOString().slice(0, 10)} by an LLM (
                        {process.env.OPENAI_PREDICTION_MODEL || "gpt-4.1-mini"}) from this bank&apos;s real detected
                        rate move and this app&apos;s own computed event-study data — cached per decision, not
                        regenerated on every visit. This is a probabilistic judgment call, not a verified data point
                        the way this app&apos;s computed engines are — same discipline as{" "}
                        <Link href="/dashboard/prediction" className="text-accent hover:underline">
                          /dashboard/prediction
                        </Link>
                        .
                      </p>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </section>
      )}

      {bankingComposite && (
        <section className="gfew-panel mb-6 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Banking Stress — US Asset Quality + Euro-Area/UK Funding Cost (feeds GFMI)
          </h3>
          <div className="flex items-baseline gap-3">
            <span className="gfew-mono text-3xl font-bold" style={{ color: scoreColor(bankingComposite.score) }}>
              {bankingComposite.score ?? "—"}
            </span>
            <span className="text-sm uppercase tracking-wide text-text-dim">{bankingComposite.regime}</span>
          </div>
        </section>
      )}

      <section className="gfew-panel mb-8 p-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
          Crisis Stage (equal-weighted across all nine tracked banking systems)
        </h3>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Stages 1-6 come from each country&apos;s own Structural (capital/credit/funding/liquidity) +
          Market (bank-equity) + Contagion (cross-country breadth) blend. Stage 7 requires a large share
          of ALL nine countries to already be at Stage 6+ simultaneously — never assigned to a single
          country in isolation.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {BANKING_STAGES.map((s) => {
            const active = composite.stage?.stage === s.stage;
            const { bg, fg } = stageColor(s.stage);
            return (
              <div
                key={s.stage}
                className="min-w-[110px] flex-1 rounded px-2 py-2 text-center"
                style={{
                  background: active ? bg : "#1a1f28",
                  color: active ? fg : "#5a6472",
                  outline: active ? `2px solid ${fg}` : "none",
                  outlineOffset: "-2px",
                }}
                title={s.description}
              >
                <div className="gfew-mono text-[10px] font-semibold uppercase tracking-wide">Stage {s.stage}</div>
                <div className="text-[11px] font-medium">{s.shortLabel}</div>
              </div>
            );
          })}
        </div>
        {composite.stage ? (
          <p className="text-sm">
            Composite reading:{" "}
            <span className="gfew-mono font-semibold" style={{ color: scoreColor(composite.score) }}>
              {composite.score}
            </span>{" "}
            <span className="font-semibold" style={{ color: stageColor(composite.stage.stage).fg }}>
              {composite.stage.label}
            </span>
          </p>
        ) : (
          <p className="text-sm text-text-dim">Insufficient data for a composite reading yet.</p>
        )}
      </section>

      <section className="gfew-panel mb-8 p-4" id="leading-banking-stress-score">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            Leading Banking Stress Score
          </h3>
          <a href="/dashboard/methodology#leading-banking-stress-score" className="text-xs text-accent hover:underline">
            Methodology →
          </a>
        </div>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          A re-derivation of numbers already shown elsewhere on this page, using only the inputs this
          app&apos;s own spec classifies as LEADING rather than LAGGING: Funding (40%) + Market (35%) +
          BIS credit-to-GDP Gap where available (25%, UK/Canada/Japan only — renormalized to Funding+Market
          for the other six countries), explicitly excluding the Capital/NPL inputs shown in the country
          table above since those are the spec&apos;s own LAGGING examples.
        </p>
        <div className="mb-4 flex items-baseline gap-3">
          <span className="gfew-mono text-3xl font-bold" style={{ color: scoreColor(leadingComposite) }}>
            {leadingComposite ?? "—"}
          </span>
          <span className="text-sm uppercase tracking-wide text-text-dim">
            Equal-weighted across the nine tracked banking systems
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-dim">By country</h4>
            <ol className="space-y-1.5">
              {rankedByLeading.map((r, i) => (
                <li key={r.country} className="text-sm">
                  <span className="gfew-mono mr-2 text-text-dim">{i + 1}.</span>
                  <span className="font-medium">{r.country}</span>{" "}
                  <span className="gfew-mono" style={{ color: scoreColor(r.leadingScore) }}>
                    {r.leadingScore}
                  </span>{" "}
                  <span className="text-[10px] text-text-dim">
                    ({Math.round(r.leadingCompleteness * 100)}% coverage{r.creditGapScore !== null ? ", incl. credit gap" : ""})
                  </span>
                </li>
              ))}
              {rankedByLeading.length === 0 && <li className="text-sm text-text-dim">No data yet.</li>}
            </ol>
          </div>
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-dim">
              US bank-level leading overlay
            </h4>
            <p className="mb-2 text-xs text-text-dim">
              Average of CRE/Assets (50%) and Deposit Growth (50%) across the twelve tracked US banks —
              real FDIC/SEC EDGAR data, but averaged across a 12-bank sample, not a US-system-wide
              observation. Shown separately rather than blended into the US country row above, since it is
              a different entity level and sample size.
            </p>
            <span className="gfew-mono text-2xl font-bold" style={{ color: scoreColor(usBankLeadingOverlay) }}>
              {usBankLeadingOverlay ?? "—"}
            </span>
          </div>
        </div>
        <div className="mt-4 rounded border border-border bg-panel-raised p-3 text-xs text-text-dim">
          <strong className="text-text">Extrapolation disclaimer:</strong> &ldquo;Leading&rdquo; here
          reflects a conventional financial-theory classification (funding costs, bank equity and credit
          growth are commonly observed to move before regulatory metrics confirm stress) — it is{" "}
          <strong>not</strong> an empirically validated lead time measured in this dataset. This app runs
          no historical backtesting or lead-time analysis (spec §146/188, not built — see methodology). A
          high reading means the specific inputs above are currently elevated, not that stress is
          forecast to arrive in any particular timeframe, and it is mechanically correlated with the
          Composite/Structural scores shown above since it reuses their component inputs rather than
          independent data. Treat it as a different lens on the same evidence, not a separate forecast.
        </div>
      </section>

      <section className="gfew-panel mb-8 p-4" id="central-bank-fsr-verification">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            Central Bank Financial Stability Report Verification
          </h3>
          <a href="/dashboard/methodology#central-bank-fsr-verification" className="text-xs text-accent hover:underline">
            Methodology →
          </a>
        </div>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          34 central banks across the G7, G20/major EM, ASEAN, CEE, Latin America, Middle East and Africa,
          each confirmed to publish a genuine periodic assessment of the soundness and resilience of its
          financial system. This table links directly to each institution&apos;s own latest published
          report — a curated verification registry, not a live feed, updated whenever a central bank
          publishes a new edition (checked, and deliberately excluded: Vietnam, Qatar and Nigeria — see
          methodology). The <strong>Auto-Check</strong> column is genuinely automated for entries marked
          &ldquo;Verified&rdquo;/&ldquo;Needs review&rdquo;/&ldquo;Check failed&rdquo;: every pipeline run
          re-fetches each institution&apos;s own publications listing (or its press-release feed, where
          already wired up) and flags a review the moment a newer edition appears to be out. Entries marked
          &ldquo;Not automated&rdquo; have a fully real, verified report and hyperlink, but their listing
          page was found to be JavaScript-rendered or bot-walled when checked, so no automated check exists
          for them yet — disclosed rather than faked. &ldquo;Δ vs central bank&rdquo; compares this
          app&apos;s current composite score to that report&apos;s own stated stance (only computed for the
          original 9 countries this app has banking-engine coverage for); it is not a point-in-time
          backtest (see methodology for why).
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Central Bank</th>
                <th className="px-3 py-2 font-medium">Latest Report</th>
                <th className="px-3 py-2 font-medium">Published</th>
                <th className="px-3 py-2 font-medium">Cadence</th>
                <th className="px-3 py-2 font-medium">Report&apos;s Own Stance</th>
                <th className="px-3 py-2 font-medium">Our Composite</th>
                <th className="px-3 py-2 font-medium">Δ vs Central Bank</th>
                <th className="px-3 py-2 font-medium">Auto-Check</th>
              </tr>
            </thead>
            <tbody>
              {FSR_REGION_ORDER.flatMap((region) => {
                const entries = CENTRAL_BANK_FSR_REGISTRY.filter((e) => e.region === region);
                if (entries.length === 0) return [];
                return [
                  <tr key={`region-${region}`} className="border-t border-border bg-panel-raised">
                    <td colSpan={9} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                      {region} ({entries.length})
                    </td>
                  </tr>,
                  ...entries.map((entry) => {
                    const { daysSince, status } = fsrFreshness(entry);
                    const row = rows.find((r) => r.country === entry.country);
                    const ourLevel = ourStanceLevel(row?.compositeScore ?? null);
                    const comparison = ourLevel ? compareStance(ourLevel, entry.bankStanceLevel) : null;
                    const check = fsrCheckByKey.get(entry.key);
                    const badge = checkStatusBadge(check?.check_status);
                    return (
                  <tr key={entry.key} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">{entry.country}</td>
                    <td className="px-3 py-2 text-text-dim">{entry.institution}</td>
                    <td className="px-3 py-2">
                      <a href={entry.reportUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        {entry.reportName}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium"
                        style={{ background: `${freshnessColor(status)}22`, color: freshnessColor(status) }}
                        title={`${daysSince} days since publication (${status})`}
                      >
                        {entry.publishedDate}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-text-dim">{entry.cadenceLabel}</td>
                    <td className="max-w-xs px-3 py-2 text-xs text-text-dim" title={entry.stance}>
                      <span className="font-medium" style={{ color: freshnessColor(entry.bankStanceLevel === "elevated" ? "overdue" : entry.bankStanceLevel === "moderate" ? "due" : "current") }}>
                        {stanceLabel(entry.bankStanceLevel)}
                      </span>
                      <div className="mt-0.5">{entry.stance}</div>
                    </td>
                    <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(row?.compositeScore ?? null) }}>
                      {row?.compositeScore ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {comparison === "consistent" && <span className="text-text-dim">Consistent</span>}
                      {comparison === "more_stressed" && <span style={{ color: "#e0793d" }}>Our model reads more stress</span>}
                      {comparison === "less_stressed" && <span style={{ color: "#3fa9f5" }}>Our model reads less stress</span>}
                      {comparison === null && <span className="text-text-dim">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium"
                        style={{ background: `${badge.color}22`, color: badge.color }}
                        title={check?.note ?? "This entry has not yet been checked by a pipeline run."}
                      >
                        {badge.label}
                      </span>
                      {check?.last_checked_at && (
                        <div className="mt-0.5 text-[10px] text-text-dim">
                          {new Date(check.last_checked_at).toISOString().slice(0, 10)}
                        </div>
                      )}
                    </td>
                  </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Where Banking Risk Is Building
          </h3>
          {topRisks.length === 0 && <p className="text-sm text-text-dim">No data yet.</p>}
          <ol className="space-y-2">
            {topRisks.map((r, i) => (
              <li key={r.country} className="text-sm">
                <span className="gfew-mono mr-2 text-text-dim">{i + 1}.</span>
                <span className="font-medium">{r.country}</span>{" "}
                <span className="gfew-mono" style={{ color: scoreColor(r.compositeScore) }}>
                  {r.compositeScore}
                </span>
                <div className="ml-5 text-xs text-text-dim">Stage {r.stage} · {r.stageLabel}</div>
              </li>
            ))}
          </ol>
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Hidden Banking Risk (structural rising, market still calm)
          </h3>
          {hiddenRisks.length === 0 ? (
            <p className="text-sm text-text-dim">None currently detected across the tracked universe.</p>
          ) : (
            <ul className="space-y-1">
              {hiddenRisks.map((r) => (
                <li key={r.country} className="text-sm">
                  <span className="font-medium">{r.country}</span>{" "}
                  <span className="text-xs text-text-dim">
                    (structural {r.structuralScore}, market {r.marketScore})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Market Warning (market deteriorating ahead of fundamentals)
          </h3>
          {marketWarnings.length === 0 ? (
            <p className="text-sm text-text-dim">None currently detected across the tracked universe.</p>
          ) : (
            <ul className="space-y-1">
              {marketWarnings.map((r) => (
                <li key={r.country} className="text-sm">
                  <span className="font-medium">{r.country}</span>{" "}
                  <span className="text-xs text-text-dim">
                    (market {r.marketScore}, structural {r.structuralScore})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Liquidity–Solvency Matrix
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Places each tracked banking system by Capital score (solvency risk, x-axis) against Liquidity
          score (liquidity risk, y-axis), split at the midpoint of the 0–100 scale — the same four buckets
          the spec asks for: illiquid-but-solvent and insolvent-but-liquid are genuinely different problems
          from a system that is both, and this matrix is what keeps that distinction visible instead of
          collapsing everything into one composite number.
        </p>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-xs">
          <div />
          <div className="text-center font-semibold text-text-dim">Solvency: Low Risk</div>
          <div className="text-center font-semibold text-text-dim">Solvency: High Risk</div>

          <div className="flex items-center justify-end pr-1 font-semibold text-text-dim">Liquidity: Low Risk</div>
          {(["healthy", "solvency_watch"] as const).map((q) => (
            <div key={q} className="min-h-[90px] rounded border border-border p-2" style={{ background: "#1a1f28" }}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                {q === "healthy" ? "Healthy" : "Solvency Watch"}
              </div>
              <div className="flex flex-wrap gap-1">
                {rows.filter((r) => quadrantFor(r) === q).map((r) => (
                  <span
                    key={r.country}
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                    style={{ background: `${scoreColor(r.compositeScore)}22`, color: scoreColor(r.compositeScore) }}
                  >
                    {r.country}
                  </span>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-end pr-1 font-semibold text-text-dim">Liquidity: High Risk</div>
          {(["liquidity_stress", "crisis"] as const).map((q) => (
            <div key={q} className="min-h-[90px] rounded border border-border p-2" style={{ background: "#1a1f28" }}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                {q === "liquidity_stress" ? "Liquidity Stress" : "Banking Crisis Risk"}
              </div>
              <div className="flex flex-wrap gap-1">
                {rows.filter((r) => quadrantFor(r) === q).map((r) => (
                  <span
                    key={r.country}
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                    style={{ background: `${scoreColor(r.compositeScore)}22`, color: scoreColor(r.compositeScore) }}
                  >
                    {r.country}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {rows.some((r) => quadrantFor(r) === null) && (
          <p className="mt-2 text-[11px] text-text-dim">
            Not placed (insufficient capital/liquidity data):{" "}
            {rows.filter((r) => quadrantFor(r) === null).map((r) => r.country).join(", ")}
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Banking Systemic Risk — Country Table
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Capital = World Bank bank capital/assets ratio (a leverage ratio, not risk-weighted CET1),
          cross-sectional. Credit = World Bank NPL ratio, blended with US delinquency/charge-off/CRE data
          for the US and the BIS credit-to-GDP gap for UK/Canada/Japan. Funding = each country&apos;s own
          policy/interbank rate. Liquidity = each country&apos;s own central-bank balance-sheet/reserves
          series. Market = a bank-sector equity index or representative bank (see methodology for exactly
          which, per country). Structural = Capital 35% + Credit 30% + Funding 15% + Liquidity 20%.
          Composite = Structural 40% + Market 35% + Contagion 25%.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Capital</th>
                <th className="px-3 py-2 font-medium">NPL Ratio</th>
                <th className="px-3 py-2 font-medium">Funding Rate</th>
                <th className="px-3 py-2 font-medium">Liquidity</th>
                <th className="px-3 py-2 font-medium">Market</th>
                <th className="px-3 py-2 font-medium">Structural</th>
                <th className="px-3 py-2 font-medium">Contagion</th>
                <th className="px-3 py-2 font-medium">Composite</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.country} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">{r.country}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {fmt(r.capitalRatio.value, "%", 1)}
                    <TrendIndicator value={r.capitalRatio.value} previous={r.capitalRatio.previousValue} />
                    <div className="text-[10px]">{r.capitalRatio.asOf?.slice(0, 4) ?? "—"}</div>
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {fmt(r.nplRatio.value, "%", 1)}
                    <TrendIndicator value={r.nplRatio.value} previous={r.nplRatio.previousValue} />
                    <div className="text-[10px]">{r.nplRatio.asOf?.slice(0, 4) ?? "—"}</div>
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {fmt(r.fundingRate.value, "%")}
                    <TrendIndicator value={r.fundingRate.value} previous={r.fundingRate.previousValue} />
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {r.liquidityReading.score !== null ? (
                      <span style={{ color: scoreColor(r.liquidityScore) }}>{r.liquidityScore}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.marketScore) }}>
                    {r.marketScore ?? "—"}
                  </td>
                  <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.structuralScore) }}>
                    {r.structuralScore ?? "—"}
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{r.contagionScore ?? "—"}</td>
                  <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(r.compositeScore) }}>
                    {r.compositeScore ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.stage !== null ? (
                      <span
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold"
                        style={{ background: `${stageColor(r.stage).fg}22`, color: stageColor(r.stage).fg }}
                        title={BANKING_STAGES[r.stage - 1]?.description}
                      >
                        {r.stage} · {r.stageLabel}
                      </span>
                    ) : (
                      <span className="text-text-dim">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-dim">{Math.round(r.dataCompleteness * 100)}%</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-text-dim">
                    No data yet — trigger a pipeline run from /admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Score Breakdown — Why Is This Composite What It Is?
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Every contribution below is traceable to an underlying observation (spec §110/135): the top bar
          shows how many of the composite&apos;s points came from Structural, Market and Contagion; the
          bottom bar shows how Structural itself splits across Capital, Credit, Funding and Liquidity.
          Weights are fixed (Structural 40% / Market 35% / Contagion 25% of composite; Capital 35% /
          Credit 30% / Funding 15% / Liquidity 20% of Structural) — shown for the six highest-composite
          countries.
        </p>
        <div className="space-y-4">
          {topRisks.map((r) => (
            <div key={r.country} className="gfew-panel p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-medium">{r.country}</span>
                <span className="text-xs text-text-dim">
                  Stage {r.stage} · {r.stageLabel}
                </span>
              </div>
              <ContributionBar
                total={r.compositeScore}
                segments={[
                  { label: "Structural", value: contribution(r.structuralScore, COMPOSITE_WEIGHTS.structural), color: "#3fa9f5" },
                  { label: "Market", value: contribution(r.marketScore, COMPOSITE_WEIGHTS.market), color: "#e0793d" },
                  { label: "Contagion", value: contribution(r.contagionScore, COMPOSITE_WEIGHTS.contagion), color: "#e05a4d" },
                ]}
              />
              <div className="mt-3 pl-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                  Structural ({r.structuralScore ?? "—"}) breaks down as
                </div>
                <ContributionBar
                  total={null}
                  segments={[
                    { label: "Capital", value: contribution(r.capitalScore, STRUCTURAL_WEIGHTS.capital), color: "#34c085" },
                    { label: "Credit", value: contribution(r.creditScore, STRUCTURAL_WEIGHTS.credit), color: "#e0b93d" },
                    { label: "Funding", value: contribution(r.fundingScore, STRUCTURAL_WEIGHTS.funding), color: "#3fa9f5" },
                    { label: "Liquidity", value: contribution(r.liquidityScore, STRUCTURAL_WEIGHTS.liquidity), color: "#8b96a8" },
                  ]}
                />
              </div>
            </div>
          ))}
          {topRisks.length === 0 && <p className="text-sm text-text-dim">No data yet.</p>}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Bank-Level Detail — US G-SIBs &amp; Large Regionals
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Two real, distinct entity levels for the same twelve banking groups. <strong>Total Assets,
          Equity, Deposits, Loans</strong> are the SEC-filing HOLDING COMPANY&apos;s GAAP figures (SEC
          EDGAR XBRL). <strong>CET1 Ratio, Tier 1 Leverage, NPL Ratio and CRE/Assets</strong> are the
          actual regulatory figures for that group&apos;s lead FDIC-insured BANK SUBSIDIARY (a different
          legal entity), pulled from the FDIC BankFind Suite API — a genuinely live, free, unauthenticated
          source verified directly against its own published field dictionary before use. This is the CET1
          ratio the earlier build of this page said wasn&apos;t available: FFIEC&apos;s bulk download and
          SOAP webservice are both confirmed dead ends (see methodology), but FDIC&apos;s own Call
          Report-derived API was not, and carries the real number. LCR and NSFR are still not published
          anywhere free and structured — still unavailable, not fabricated. Risk Score now blends CET1
          (30%), NPL (20%), CRE/Assets (15%), Deposit Growth (15%), Tier 1 Leverage (10%) and ROA (10%),
          cross-sectionally z-scored against these same twelve peer banks.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Bank</th>
                <th className="px-3 py-2 font-medium">Total Assets</th>
                <th className="px-3 py-2 font-medium">CET1 Ratio</th>
                <th className="px-3 py-2 font-medium">Tier 1 Leverage</th>
                <th className="px-3 py-2 font-medium">NPL Ratio</th>
                <th className="px-3 py-2 font-medium">CRE / Assets</th>
                <th className="px-3 py-2 font-medium">Deposit Growth (YoY)</th>
                <th className="px-3 py-2 font-medium">ROA (TTM)</th>
                <th className="px-3 py-2 font-medium">Risk Score</th>
                <th className="px-3 py-2 font-medium">Leading Score</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {rankedBanks.map((b) => (
                <tr key={b.key} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">
                    {b.name}
                    {b.gsib && (
                      <span className="ml-1.5 inline-block rounded bg-panel-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-dim">
                        G-SIB
                      </span>
                    )}
                    {b.entityName && <div className="text-[10px] font-normal text-text-dim">{b.entityName}</div>}
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">
                    {fmtUsdBn(b.totalAssets.value)}
                    <TrendIndicator value={b.totalAssets.value} previous={b.totalAssets.previousValue} />
                  </td>
                  <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(b.cet1Score) }}>
                    {fmt(b.cet1Ratio.value, "%", 2)}
                    <TrendIndicator value={b.cet1Ratio.value} previous={b.cet1Ratio.previousValue} />
                  </td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(b.tier1LeverageScore) }}>
                    {fmt(b.tier1LeverageRatio.value, "%", 2)}
                    <TrendIndicator value={b.tier1LeverageRatio.value} previous={b.tier1LeverageRatio.previousValue} />
                  </td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(b.nplScore) }}>
                    {fmt(b.nplRatio.value, "%", 2)}
                    <TrendIndicator value={b.nplRatio.value} previous={b.nplRatio.previousValue} />
                  </td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(b.creScore) }}>
                    {fmt(b.creToAssets, "%", 1)}
                  </td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(b.depositGrowthScore) }}>
                    {fmtPct(b.depositGrowthYoy)}
                  </td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(b.roaScore) }}>
                    {fmt(b.roa, "%")}
                  </td>
                  <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: scoreColor(b.riskScore) }}>
                    {b.riskScore ?? "—"}
                  </td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(b.leadingScore) }}>
                    {b.leadingScore ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-text-dim">{Math.round(b.dataCompleteness * 100)}%</td>
                </tr>
              ))}
              {bankRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-text-dim">
                    No data yet — trigger a pipeline run from /admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EngineDetail title="Banking Stress — US Asset Quality + Euro-Area/UK Funding Cost (feeds GFMI)" rows={bankingRows} />
    </div>
  );
}
