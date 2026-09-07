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
          Global Liquidity now covers all of G7 + China — the ECB (Germany/France/Italy), BOJ, BoE and BoC
          balance-sheet/reserve measures alongside the Fed, plus China&apos;s 3-month interbank rate as a
          rate-side proxy (see &ldquo;Liquidity: G7 + China, and a separate India Liquidity engine&rdquo;
          below, which also covers the new standalone India Liquidity tab). The
          standalone China engine itself adds the 10Y yield, debt/GDP ratio, 3-month interbank rate, real
          house-price index and Shanghai Composite on top of its existing exports/imports/CNY/CPI tracking —
          plus, as of this update, property sales, a credit-impulse proxy, PMI new orders, LGFV-inclusive
          augmented debt and a developer-financing proxy (see &ldquo;China: closing the
          property/credit/PMI/LGFV/financing gap&rdquo; below) — every indicator the V3 spec calls for
          except individual developer default events, which no free source tracks in structured form.
          Supply Chains was, until this update, a single global NY Fed GSCPI number with no country
          breakdown (GSCPI itself publishes no such breakdown — checked its own workbook directly); it now
          adds country-level proxies for six of the eight G7+China economies (see &ldquo;Supply Chains:
          from one global number to G7+China&rdquo; below) — the UK is the one economy still genuinely
          uncovered, disclosed there rather than silently dropped.
          One engine remains intentionally single-country by definition regardless of data availability:
          Yen Carry Stress (a JPY-specific carry-trade mechanic). Banking and Private Credit remain partly
          single-country-anchored because no free source publishes bank-level NPL/delinquency data for the
          UK, Eurozone, Canada or Japan, or a non-US publicly-traded direct-lending vehicle comparable to
          US BDCs — those engines add whatever real G7 context does exist (policy rates) rather than
          fabricating data that doesn&apos;t exist for free.
        </p>
      </section>

      <section className="mb-8" id="china-property-credit-pmi-lgfv">
        <h2 className="mb-2 text-base font-semibold text-text">
          China: closing the property/credit/PMI/LGFV/financing gap
        </h2>
        <p className="mb-2">
          Property sales, credit impulse, PMI new orders, LGFV debt and developer financing were previously
          all marked UNAVAILABLE for China — genuinely no free source was found at the time. All five have
          real, verified, non-fabricated sources now, though not all five update the same way, and one is
          honestly a proxy rather than the literal thing its name suggests:
        </p>
        <p className="mb-2">
          <strong>Property sales</strong> (floor space of newly-built commercial buildings sold, million
          m²), <strong>PMI new orders</strong>, and <strong>developer financing</strong> all come from
          NBS&apos;s (National Bureau of Statistics of China) own monthly English-language press releases —
          but reached via <span className="gfew-mono">english.www.gov.cn</span>, the State Council&apos;s
          English news portal that syndicates NBS content, rather than{" "}
          <span className="gfew-mono">stats.gov.cn</span> directly. NBS&apos;s own domain actively blocks
          non-browser HTTP clients — a WAF 403 with an explicit &ldquo;UrlACL&rdquo; rule on its data-query
          API, and a deterministic TLS-level connection reset on its press-release pages for any Node-based
          HTTP client (reproduced with two different Node HTTP clients, while a plain{" "}
          <span className="gfew-mono">curl</span> from the same network succeeds) — which this project will
          not work around with TLS-fingerprint spoofing or similar anti-bot evasion. Since the same NBS
          releases are openly republished on a State Council domain that isn&apos;t behind that block, that
          is used instead: using an open, reachable government publication, not circumventing a control.
          These releases are highly templated (same NBS press office, same phrasing every month), which is
          what makes prose parsing viable here — the same approach already used for SEC EDGAR tag selection
          and YTD de-cumulation elsewhere in this project, applied to English prose instead of XBRL facts. A
          month whose exact phrasing doesn&apos;t match the parser simply contributes no point for that
          month rather than a guessed one, so these series currently have real but incomplete history that
          fills in further with each future release.
        </p>
        <p className="mb-2">
          <strong>Developer financing</strong> is honestly a proxy, and labeled as one: NBS&apos;s literal
          &ldquo;funds in place&rdquo; breakdown for real estate developers (domestic loans, self-raised
          funds, deposits/advances, mortgages) is published in a separate release that only exists on the
          blocked <span className="gfew-mono">stats.gov.cn</span> domain, not syndicated to
          english.www.gov.cn. What the syndicated release does carry is the year-on-year change in real
          estate development investment itself (&ldquo;...and that in real estate development declined by
          19.2 percent&rdquo;) — a real, official, closely related aggregate: a slump in developer capital
          deployment is exactly what financing stress produces, even though it isn&apos;t the financing-source
          breakdown by name. Individual developer bond <em>default</em> events remain genuinely unavailable
          free — no free source tracks those in structured form — so this indicator covers the financing
          trend, not defaults.
        </p>
        <p className="mb-2">
          <strong>Credit impulse</strong> is, honestly, a proxy: the BIS (Bank for International
          Settlements) Credit-to-GDP Gap for China&apos;s private non-financial sector — the official
          Basel III countercyclical-capital-buffer signal, i.e. the standard central-bank early-warning
          measure for a credit boom. A literal credit impulse (the second derivative of PBOC Total Social
          Financing flow, scaled by GDP) would mean deriving a growth-of-growth-rate metric ourselves from
          raw flow data; consuming BIS&apos;s own already-computed, officially-published series is less
          fabrication-adjacent, and BIS&apos;s free SDMX API (no key, no auth) made it directly reachable.
          It is labeled as a proxy on the dashboard, not as a literal replica of any bank&apos;s proprietary
          credit-impulse calculation.
        </p>
        <p>
          <strong>LGFV (Local Government Financing Vehicle) debt</strong> has no standing, machine-readable
          data series anywhere — checked FRED, OECD, World Bank, BIS and the IMF&apos;s own DataMapper API
          (which covers China&apos;s narrow General Government Debt but nothing LGFV-specific). The one real
          number that exists comes from the IMF&apos;s own annual China Article IV Consultation staff
          report, which publishes a staff-estimated &ldquo;Augmented Debt&rdquo; figure (general government
          debt plus LGFVs and other off-budget government funds) once a year, in a PDF table, with no API.
          The values tracked here — 97.5% of GDP (2020) through 126.6% (2025) — were extracted directly from
          that report&apos;s own historical table (IMF Country Report No. 26/044, February 2026), excluding
          the same table&apos;s 2026-2030 columns, which are explicitly staff <em>projections</em>, not
          observations. This is not an auto-refreshing feed: it is a manually-verified figure that needs a
          human to append one new point after each new Article IV report is published (usually annually) —
          the same honest treatment already given to other genuinely-annual indicators like debt/GDP ratios,
          just with a manual rather than automated refresh step. Until the next report, it will correctly
          show RECENT or STALE under the annual freshness window, which reflects how often this data
          actually changes, not a pipeline bug.
        </p>
      </section>

      <section className="mb-8" id="supply-chains-g7-china">
        <h2 className="mb-2 text-base font-semibold text-text">
          Supply Chains: from one global number to G7+China
        </h2>
        <p className="mb-2">
          The NY Fed&apos;s Global Supply Chain Pressure Index (GSCPI) is a genuine Tier-1, single
          authoritative composite already built from shipping/freight/PMI data across the major economies
          driving global trade — but it publishes no country or region breakdown (checked its own
          downloadable workbook directly: only the composite value is in there). Extending &ldquo;Supply
          Chains&rdquo; to G7+China therefore meant finding separate, genuinely free, national data — and
          unlike most of the other country extensions on this page, the same *kind* of series wasn&apos;t
          available everywhere, so each country&apos;s proxy is disclosed for exactly what it is:
        </p>
        <p className="mb-2">
          <strong>US, Germany, France, Italy</strong> use the OECD Business Tendency Survey&apos;s
          &ldquo;Order Books: Current&rdquo; series (mirrored on FRED) — a net-balance survey of
          manufacturers reporting order books above vs. below normal. Rising backlogs relative to normal is
          a real capacity/delivery-strain signal, conceptually close to what GSCPI&apos;s own PMI
          sub-components measure.
        </p>
        <p className="mb-2">
          <strong>Japan</strong> has no Order Books series in this dataset, so &ldquo;Finished Goods
          Stocks: Current&rdquo; (also OECD BTS, quarterly) is used instead — a related but distinct
          concept. It is included because unsold/unshipped goods piling up is exactly what happened during
          the 2021-22 chip-shortage period, when automakers couldn&apos;t ship finished vehicles because
          production itself was blocked, not because demand had fallen — but it can also simply reflect
          demand weakness, which is a real interpretive caveat this indicator carries that the Order Books
          series doesn&apos;t.
        </p>
        <p className="mb-2">
          <strong>Canada</strong> comes directly from Statistics Canada&apos;s own Web Data Service API — a
          manufacturing inventory-to-sales ratio, free, no key, updated monthly. This is a direct-from-source
          connector rather than the FRED/OECD mirror because that mirror&apos;s Canadian submission for this
          concept stopped updating in 2023, while StatCan itself is still current (the aggregator lagged,
          not the underlying source — the same pattern already seen with UK/Germany/Canada bond yields
          earlier in this document).
        </p>
        <p className="mb-2">
          <strong>China</strong> uses NBS&apos;s own PMI supplier-delivery-time subindex, parsed from the
          same English press releases already used for property sales and PMI new orders (see the China
          section above). NBS alternates between a short wire brief and a longer release that includes this
          subindex, so this series is real but genuinely sparser than PMI new orders — not a parsing gap,
          just a less consistently-reported figure at the source.
        </p>
        <p>
          <strong>The UK</strong> is the one G7 economy still genuinely uncovered here. Its own
          OECD-submitted Order Books and Finished Goods Stocks series were both discontinued in March 2021
          (confirmed directly against FRED&apos;s series metadata), and the UK&apos;s real-world equivalent
          — the CBI Industrial Trends Survey — sits behind Cloudflare bot-protection on cbi.org.uk, which
          this project will not work around. Rather than force a stale or fabricated UK figure into the
          engine, this gap is disclosed in the engine&apos;s contradictory-evidence field and here, not
          silently dropped.
        </p>
      </section>

      <section className="mb-8" id="liquidity-g7-china-india">
        <h2 className="mb-2 text-base font-semibold text-text">
          Liquidity: G7 + China, and a separate India Liquidity engine
        </h2>
        <p className="mb-2">
          Global Liquidity previously covered the Fed, ECB and BOJ. It now adds the
          <strong> UK</strong> (Bank of England reserve balances, series RPWB56A — BoE&apos;s own Weekly
          Report database has no single &ldquo;total assets&rdquo; line, checked directly; reserve
          balances, the liabilities side of the balance sheet, is the same underlying concept the Fed&apos;s
          own reserve-balances series tracks, and arguably the more directly relevant one for gauging
          ample-vs-scarce banking-system liquidity) and <strong>Canada</strong> (Bank of Canada&apos;s own
          &ldquo;Total assets&rdquo; series, V36610, from its weekly balance sheet table via the Valet API).
          Germany, France and Italy were already covered — there is no separate national central-bank
          balance sheet distinct from the consolidated Eurosystem one, so the ECB figure already tracked
          here is their liquidity input.
        </p>
        <p className="mb-2">
          <strong>China</strong> is honestly a rate-side, not balance-sheet-side, proxy: no free, verified
          PBOC total-assets or reserve-money series was found (checked pbc.gov.cn&apos;s own statistics
          pages directly — its monthly English-language Financial Statistics Reports cover Total Social
          Financing and RMB loans, not a balance-sheet total). China&apos;s 3-month interbank rate
          (already tracked elsewhere in this project as a funding-stress proxy) is reused here instead,
          playing the same role SOFR and the ECB deposit rate play for the US and Eurozone — a real signal,
          just not the same *kind* of signal as the balance-sheet series used for the rest of G7.
        </p>
        <p>
          <strong>India Liquidity is a new, separate tab</strong> — deliberately not folded into India
          Market Regime, which is a bullish/bearish equity-direction call on a different 0-100 scale, not a
          banking-system liquidity read. Both of its inputs come from the RBI&apos;s own daily &ldquo;Money
          Market Operations as on &lt;date&gt;&rdquo; press release, which — unlike the RBI&apos;s PDF-only
          &ldquo;Weekly Statistical Supplement&rdquo; release (whose PDF is served from
          rbidocs.rbi.org.in, verified to sit behind an Imperva/TSPD bot-mitigation JS challenge that this
          project will not solve) — has its actual numbers inline in the HTML page itself, published on
          every business day: RBI&apos;s own headline &ldquo;net liquidity injected/absorbed&rdquo; figure
          (India&apos;s direct analog to the Fed&apos;s RRP/reserve-operations signal — negative means RBI
          is absorbing a banking-system surplus, positive means it is net injecting to cover a deficit),
          and the Weighted Average Call Rate (WACR, India&apos;s overnight interbank rate, the direct
          analog to SOFR/EFFR). USDINR, already tracked elsewhere in this project, is reused as a
          coincident cross-check.
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
