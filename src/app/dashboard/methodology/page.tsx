export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-sm leading-relaxed text-text-dim">
      <h1 className="mb-6 text-2xl font-semibold text-text">Methodology</h1>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">What this is (and isn&apos;t)</h2>
        <p>
          Global Meltdown Index is a leading-indicator systemic-risk terminal. Its core question is: what is changing now
          that could matter later? It is not a lagging market dashboard, and no score, regime label or
          scenario on this site is a forecast, prediction, or investment recommendation.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">Coverage in this phase</h2>
        <p>
          The full target specification defines 24 risk engines. This deployment currently implements 22
          as standalone engines, chosen because they can be fed entirely by free, official/public data:
          Global Dollar Liquidity, Credit Markets (fulfilling Corporate Credit), Equity Fragility (folding
          in Equity Valuation), Treasury &amp; Sovereign Debt covering the US plus the rest of the G7 and a
          China proxy (fulfilling Global Sovereign Debt — see{" "}
          <a href="#country-coverage" className="text-accent hover:underline">Country coverage</a>{" "}
          below), Yen Carry Stress, Banking, Property/CRE, Emerging-Market Debt, Energy, Geopolitical,
          Derivatives/Leverage, Crypto/Stablecoins, Cyber/Infrastructure, Trade/Economic Policy, Supply
          Chains, Market Concentration, Private Credit, AI Financial Sustainability, AI Valuation, AI
          Credit/Financing and AI Debt Maturity Wall — plus partial China and India Market Regime engines
          (both are explicitly missing indicators the full spec calls for; each engine page lists exactly
          which ones under &ldquo;UNAVAILABLE&rdquo;). Market Concentration and Private Credit are both
          market-price proxies (equal-weight-vs-cap-weight ETF ratios, and publicly-traded BDC share
          prices, respectively) rather than the structural weights/AUM/covenant data the spec envisions,
          since no free source publishes that data at all. The four AI engines run on real SEC EDGAR XBRL
          quarterly filings for 8 large-cap companies central to AI capex (Microsoft, Alphabet, Amazon,
          Meta, Oracle, Nvidia, AMD, Broadcom) — see{" "}
          <a href="#ai-engines-methodology" className="text-accent hover:underline">AI engines methodology</a>{" "}
          below for exactly how those figures are extracted and what each ratio does and doesn&apos;t
          measure. The one engine deliberately NOT built is AI Circular Financing — V3&apos;s own
          instruction for that engine is &ldquo;never infer undisclosed relationships as fact&rdquo;, and
          no free source publishes the equity-investment/purchase-commitment/SPV web it asks for, so
          building it would mean guessing at exactly the kind of relationship the spec warns against.
          Also not yet implemented: a standalone Central-Bank Policy composite (needs the
          hawkish/dovish NLP classifier, deferred — see README).
          None of these are faked with placeholder scores; they simply don&apos;t appear until real data backs them.
        </p>
      </section>

      <section className="mb-8" id="ai-engines-methodology">
        <h2 className="mb-2 text-base font-semibold text-text">AI engines methodology</h2>
        <p className="mb-2">
          All four AI engines share one data pipeline (<code className="gfew-mono">src/lib/sources/secEdgar.ts</code>,{" "}
          <code className="gfew-mono">src/lib/engines/aiCompanyMetrics.ts</code>) pulling quarterly XBRL
          filings for Microsoft, Alphabet, Amazon, Meta, Oracle, Nvidia, AMD and Broadcom directly from
          SEC EDGAR&apos;s free company-facts API — no scraping, no paid data provider. Two real
          correctness problems were found and fixed before this shipped, not left as silent bugs:
        </p>
        <p className="mb-2">
          <strong className="text-text">Tag drift.</strong> Companies change which XBRL tag they use for
          the same concept over time — Microsoft stopped tagging <code className="gfew-mono">CostOfRevenue</code> in
          2018, and Alphabet&apos;s <code className="gfew-mono">RevenueFromContractWithCustomerExcludingAssessedTax</code> tag
          went stale in 2025 while it kept reporting the plain <code className="gfew-mono">Revenues</code> tag.
          A naive &ldquo;first tag that returns any data&rdquo; approach would have silently locked onto a
          value years out of date. Every concept is instead resolved by comparing all candidate tags and
          taking whichever has the most recent reporting period.
        </p>
        <p>
          <strong className="text-text">YTD vs. discrete quarters.</strong> Cash-flow-statement items
          (operating cash flow, capex, depreciation) are reported as year-to-date cumulative figures in
          most companies&apos; 10-Qs, not standalone quarters — income-statement items usually are
          discrete. Figures are de-cumulated by grouping filings that share the same fiscal-year start
          date and taking successive differences, which also recovers the fourth quarter (never
          separately filed) as full-year total minus the nine-month figure. EBITDA is a proxy (operating
          income + depreciation from the cash-flow statement), not each company&apos;s own
          &ldquo;Adjusted EBITDA&rdquo; definition, and AI Valuation uses trailing (not forward) P/E since
          forward-earnings estimates are analyst-consensus data behind paid terminals. Nvidia does not
          tag a debt-maturity schedule at all, so it is marked <code className="gfew-mono">UNAVAILABLE</code> on
          the AI Debt Maturity Wall page rather than assumed to have no near-term maturities.
        </p>
      </section>

      <section className="mb-8" id="country-coverage">
        <h2 className="mb-2 text-base font-semibold text-text">Country coverage: G7 + China, not just the US</h2>
        <p>
          Every engine that can be extended across the G7 (US, Canada, UK, Germany, France, Italy, Japan)
          plus China with a single free, methodologically-consistent source is: Equity Fragility tracks
          the S&amp;P 500, Nasdaq, Russell 2000, Nikkei 225, DAX, FTSE 100, CAC 40, FTSE MIB, the
          S&amp;P/TSX Composite and the Shanghai Composite together; Property/CRE is built on the BIS
          real house-price index computed the same way for all eight economies; Treasury &amp; Sovereign
          Debt covers US 2Y/10Y/30Y yields and debt/GDP alongside UK/Germany/France/Italy/Japan/Canada 10Y
          yields and debt/GDP, the Italy-Germany spread, and China&apos;s 3-month interbank rate as the
          closest free proxy for domestic funding stress (China has no free government-bond-yield source
          at all anywhere — listed as <code className="gfew-mono">UNAVAILABLE</code> on the Treasury
          engine page, not guessed); Credit adds Euro-area high-yield spreads and an Asia-Pacific EM
          corporate spread (which includes but isn&apos;t exclusively China) alongside US HY/IG/EM; and
          Global Liquidity now includes the ECB and BOJ balance sheets, not the Fed&apos;s alone. The
          standalone China engine itself adds the country&apos;s 3-month interbank rate, real house-price
          index and Shanghai Composite on top of its existing exports/imports/CNY/CPI tracking. One engine
          remains intentionally single-country by definition regardless of data availability: Yen Carry
          Stress (a JPY-specific carry-trade mechanic). Banking, China and Private Credit remain partly
          single-country-anchored because no free source publishes bank-level NPL/delinquency data for the
          UK, Eurozone, Canada or Japan, a China government bond yield, or a non-US publicly-traded
          direct-lending vehicle comparable to US BDCs — those engines add whatever real G7/China context
          does exist (policy rates, interbank rates) rather than fabricating data that doesn&apos;t exist
          for free.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">Engine scoring</h2>
        <p>
          Each engine tracks a set of indicators, classified leading, coincident or lagging. For each
          indicator with at least 20 trailing observations, we compute a trailing 252-observation z-score
          and map it onto a 0-100 risk scale (0 = 3 standard deviations &ldquo;calmer than usual&rdquo;, 100 = 3
          standard deviations more stressed than usual). The engine score is the completeness-weighted
          average of its indicators&apos; scores. An engine&apos;s <em>confidence</em> is the fraction of its
          indicator set that currently has usable (LIVE or RECENT) data — an engine running on 2 of 6
          intended indicators will show low confidence even if its score looks decisive.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">GFMI composite</h2>
        <p>
          The Global Financial Meltdown Index is a confidence- and weight-adjusted average of engine
          scores, then passed through a multi-shock amplifier: when two or more independent engines are
          simultaneously elevated (score ≥ 60), the composite is bumped above the plain weighted average
          (up to +25%), since correlated stress across independent risk dimensions has historically been
          more dangerous than any single elevated reading in isolation. A crisis-override rule additionally
          forces the label to GLOBAL_DELEVERAGING_REGIME when GFMI &gt; 75 with VIX &gt; 35 and the credit
          engine &gt; 70, or SYSTEMIC_CRISIS_REGIME when GFMI &gt; 90 — the exact rule that fired is always
          shown alongside the score.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">Source hierarchy &amp; data quality</h2>
        <p>
          Sources are tiered: Tier 1 (official primary — FRED, CFTC, central-bank feeds), Tier 2
          (multilateral institutions), Tier 3 (licensed market-data aggregators, e.g. Stooq), Tier 4
          (licensed financial news), Tier 5 (verified official social accounts). Every displayed value
          carries a freshness status — LIVE, RECENT, STALE or UNAVAILABLE — computed from its age relative
          to its own publication frequency. Data is never silently backfilled or estimated to hide a gap;
          missing coverage is shown as UNAVAILABLE.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">What we don&apos;t do</h2>
        <ul className="list-inside list-disc">
          <li>We do not fabricate market prices, quotes, speeches, filings or sources.</li>
          <li>We do not present a scenario or model estimate as a guaranteed forecast.</li>
          <li>We do not issue buy/sell recommendations.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold text-text">Update cadence</h2>
        <p>
          Data ingestion and score recomputation run once daily via an automated, unattended pipeline,
          scheduled inside a window that starts after the US market close and finishes before the Tokyo
          market open — so no visible change happens mid-session anywhere in the world. See{" "}
          <code className="gfew-mono">/dashboard/sources</code> for the run log.
        </p>
      </section>
    </div>
  );
}
