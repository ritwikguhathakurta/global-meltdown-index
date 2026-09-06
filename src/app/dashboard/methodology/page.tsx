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
          Debt covers US 2Y/10Y/30Y yields and debt/GDP alongside UK/Germany/France/Italy/Japan/Canada/China
          10Y yields and debt/GDP, the Italy-Germany spread, and China&apos;s 3-month interbank rate as an
          additional funding-stress proxy. UK, Germany, Canada and China&apos;s 10Y yields all come directly
          from their own central bank or central depository (Bank of England, Bundesbank, Bank of Canada,
          and — for China — ChinaBond/CCDC, the PBOC-designated central bond depository, whose government
          bond yield curve is the standard benchmark cited internationally as China&apos;s sovereign
          yield) rather than a FRED/OECD monthly proxy, each publishing daily with only a few days&apos;
          lag — a real freshness upgrade, and one that closes what had been treated as a genuine data gap
          (no FRED, OECD or BIS series covers this at all; finding it required looking directly at CCDC&apos;s
          own site, not the usual multilateral aggregators). Italy, France and Japan still use the
          FRED/OECD monthly proxy since no equally clean free daily alternative was found for those three.
          Credit adds Euro-area
          high-yield spreads and an Asia-Pacific EM
          corporate spread (which includes but isn&apos;t exclusively China) alongside US HY/IG/EM; and
          Global Liquidity now includes the ECB and BOJ balance sheets, not the Fed&apos;s alone. The
          standalone China engine itself adds the 10Y yield, debt/GDP ratio, 3-month interbank rate, real
          house-price index and Shanghai Composite on top of its existing exports/imports/CNY/CPI tracking.
          One engine remains intentionally single-country by definition regardless of data availability:
          Yen Carry Stress (a JPY-specific carry-trade mechanic). Banking and Private Credit remain partly
          single-country-anchored because no free source publishes bank-level NPL/delinquency data for the
          UK, Eurozone, Canada or Japan, or a non-US publicly-traded direct-lending vehicle comparable to
          US BDCs — those engines add whatever real G7 context does exist (policy rates) rather than
          fabricating data that doesn&apos;t exist for free.
        </p>
      </section>

      <section className="mb-8" id="horizon-differentiation">
        <h2 className="mb-2 text-base font-semibold text-text">Engine scoring, and why short/medium/long differ</h2>
        <p className="mb-2">
          Each engine tracks a set of indicators, classified leading, coincident or lagging. For each
          indicator with at least 20 trailing observations, we compute a trailing z-score and map it onto a
          0-100 risk scale (0 = 3 standard deviations &ldquo;calmer than usual&rdquo;, 100 = 3 standard
          deviations more stressed than usual). The engine score is the completeness-weighted average of
          its indicators&apos; scores. An indicator whose trailing window has been perfectly flat (zero
          variance — e.g. a status-event count sitting at 0 for weeks) scores as exactly neutral (50) while
          it stays flat, and jumps to the scale&apos;s extreme the moment it departs from that constant
          baseline at all, rather than being dropped as &ldquo;insufficient data&rdquo;: a genuinely
          unchanging series carries real information (calm), and a first departure from it is maximally
          notable relative to its own history even before enough of a track record exists to size it precisely.
        </p>
        <p className="mb-2">
          The z-score window and each indicator&apos;s weight both change by horizon, following the
          near-term/medium-term split used in practice by the IMF Global Financial Stability Report and the
          Fed Financial Stability Report (near-term risk read off market-price signals; medium/long-term
          vulnerability read off structural buildups like leverage and debt) and BIS&apos;s financial-cycle
          framing (credit/GDP gaps and property prices measured over multi-year windows): short-term uses a
          ~63-observation (one trading quarter) window and up-weights leading/coincident indicators;
          medium-term uses the ~252-observation (one trading year) baseline window with indicators weighted
          as configured; long-term uses a ~756-observation (three trading year) window and up-weights
          lagging/structural indicators. This is why the three horizons for the same engine are not the
          same number — they are answering different questions from the same data, not the same question
          three times.
        </p>
        <p>
          An engine&apos;s <em>confidence</em> is not the same as its <em>data completeness</em>. Data
          completeness is the plain fraction of an engine&apos;s intended indicator set that currently has
          usable (LIVE, RECENT or STALE) data — this can honestly be 100% when every indicator is populated.
          Confidence folds in each indicator&apos;s freshness (a STALE indicator counts for less than a LIVE
          one) and is then multiplied by a horizon-specific discount factor — 0.95 short-term, 0.88
          medium-term, 0.75 long-term — applied at every data-quality level, not just as a ceiling near
          perfect data, so it can never reach 100% and is always lowest for the longest horizon: forecast
          uncertainty compounds with horizon the same way a central bank&apos;s fan chart widens further
          out, and a model score should never claim absolute certainty about anything.
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
        <p className="mt-2">
          A STALE badge on an indicator that updates daily (equities, FX, Treasury yields) would mean
          something is actually broken — that has never been observed in production. STALE on an
          internationally-sourced or annual-disclosure indicator instead reflects genuine publication lag in
          the underlying official source itself, confirmed directly against that source&apos;s own metadata
          rather than assumed: G7 government debt/GDP ratios and AI-engine debt-maturity schedules are
          annual figures (IMF-compiled debt ratios often carry a further multi-month-to-multi-year
          compilation lag; debt-maturity schedules are 10-K-only disclosures, refreshed once a year per
          company) and are compared against an annual-cadence threshold rather than a monthly or quarterly
          one for exactly this reason; Italy, France, Japan and China&apos;s interbank rate still come from
          OECD-compiled monthly series that structurally publish 2-4 months behind (UK, Germany, Canada and
          China&apos;s 10Y yield moved to their own central bank/depository&apos;s daily series and no
          longer carry this lag — see Country coverage above), and BIS real house-price indices typically
          lag one to two quarters. None of this
          means the pipeline missed anything newer — where we&apos;ve checked, our stored value already
          matches the freshest observation the source has ever published.
        </p>
        <p className="mt-2">
          Bitcoin and Ethereum spot price come from Yahoo
          Finance&apos;s chart endpoint (Tier 3), not investing.com — investing.com has no free public API,
          and scraping its site would break the no-scraping/official-source-only rule every other connector
          in this platform follows; Yahoo publishes genuine multi-year daily history for both, which fixed
          a real gap where the Crypto/Stablecoins engine sat below its 20-observation z-score floor for
          weeks after every fresh deploy (CoinGecko&apos;s free tier is a live snapshot only, with no
          historical backfill). CoinGecko remains the source for total market cap, BTC dominance and
          stablecoin peg/supply, which Yahoo doesn&apos;t publish.
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
