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
          hawkish/dovish NLP classifier, deferred — see README). A separate G7 Sovereign Debt deep-dive
          page (three scores per country, a 7-stage crisis model) sits alongside the Treasury engine rather
          than replacing or double-counting it — see{" "}
          <a href="#g7-sovereign-debt" className="text-accent hover:underline">G7 Sovereign Debt</a>{" "}
          below.
          None of these are faked with placeholder scores; they simply don&apos;t appear until real data backs them.
          Two further engines beyond the original 24-engine spec were added on request — India Liquidity and
          India Yield Curve, both India-specific reads distinct from India Market Regime — see{" "}
          <a href="#india-yield-curve-ccil" className="text-accent hover:underline">India Yield Curve, and why CCIL is not used</a>{" "}
          below.
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
          additional funding-stress proxy. UK, Germany, Canada, Japan and China&apos;s 10Y yields all come
          directly from their own central bank, finance ministry or central depository (Bank of England,
          Bundesbank, Bank of Canada, Japan&apos;s Ministry of Finance, and — for China — ChinaBond/CCDC,
          the PBOC-designated central bond depository, whose government bond yield curve is the standard
          benchmark cited internationally as China&apos;s sovereign yield) rather than a FRED/OECD monthly
          proxy, each publishing daily with only a few days&apos; lag — a real freshness upgrade. Japan&apos;s
          own Ministry of Finance publishes a free daily JGB yield curve (1Y-40Y, back to 1974) as two plain
          CSV files — a historical archive plus a rolling current-month file — found directly on its own
          site, closing what had been a 2-4-month-stale proxy. China&apos;s case closes what had been treated
          as a genuine data gap entirely (no FRED, OECD or BIS series covers it at all; finding it required
          looking directly at CCDC&apos;s own site, not the usual multilateral aggregators). Italy and
          France still use the FRED/OECD monthly proxy: no equally clean free daily alternative was found
          for Italy, and France&apos;s own daily rate (the TEC 10 / CNO-TEC® index published by Agence
          France Trésor) is explicitly Euronext-licensed — its own publisher page states the values &ldquo;may
          not be redistributed, sub-licensed or used for commercial purposes... without the prior written
          authorisation of Euronext Paris&rdquo;, the same category of restriction this project already
          declines to route around for CCIL&apos;s India debt-market data (see below) — so it is not used.
          Credit adds Euro-area
          high-yield spreads and an Asia-Pacific EM
          corporate spread (which includes but isn&apos;t exclusively China) alongside US HY/IG/EM; and
          Global Liquidity now covers all of G7 + China — the ECB (Germany/France/Italy), BOJ, BoE and BoC
          balance-sheet/reserve measures alongside the Fed, plus China&apos;s 3-month interbank rate as a
          rate-side proxy (see &ldquo;Liquidity: G7 + China, and a separate India Liquidity engine&rdquo;
          below, which also covers the new standalone India Liquidity tab, and &ldquo;India Yield Curve,
          and why CCIL is not used&rdquo; for the new India-specific sovereign-curve tab). The
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

      <section className="mb-8" id="treasury-freshness">
        <h2 className="mb-2 text-base font-semibold text-text">
          Treasury &amp; Sovereign Debt: why a few indicators still show STALE
        </h2>
        <p className="mb-2">
          After the Japan yield upgrade above, five of the seven non-US G7+China 10Y yields (UK, Germany,
          Canada, Japan, China) are now genuinely daily, direct-from-source figures. Two categories of
          indicator on this tab will still legitimately show STALE some of the time, and this is the real
          world, not a fixable pipeline gap, verified directly against each source&apos;s own metadata
          rather than assumed.
        </p>
        <p className="mb-2">
          Italy and France 10Y yields (and the derived Italy-Germany &ldquo;BTP-Bund&rdquo; spread) still
          come from a FRED/OECD proxy that itself only updates monthly and typically lags a further 2-3
          months in publication, so at any given time the freshest value available is genuinely 2-4 months
          old. France&apos;s own daily rate exists but is Euronext-licensed and not used (see above); no
          equally clean, unrestricted daily source was found for Italy.
        </p>
        <p className="mb-2">
          Government debt/GDP ratios for every economy here (Germany, Italy, Japan, Canada, UK, China
          annual; the US&apos;s own quarterly figure) are official national-accounts statistics that take
          governments and the IMF/OECD 1-2+ years to finalize, checked directly against FRED&apos;s own
          latest-observation metadata for all seven series, confirming each one already holds the newest
          figure that source has ever published. There is nothing fresher being missed. (An earlier version
          of this note said IMF&apos;s own World Economic Outlook database sat behind an Akamai
          bot-mitigation block — that was true of the old <code>data.imf.org</code> web front end, but
          IMF&apos;s separate SDMX API at <code>api.imf.org</code> is genuinely free and unblocked, and is
          now used directly for the France/G7 fiscal data below and the EM Debt engine&apos;s own gap
          fillers — see the next section and imfFiscalGaps.ts.)
        </p>
        <p>
          Making every Treasury indicator show LIVE or RECENT at all times is not achievable without either
          fabricating data between real publication dates or silently loosening the freshness thresholds
          until a genuinely 2-year-old debt/GDP figure reads as fresh, both would misrepresent what the data
          actually is. STALE on this tab is the system telling the truth about a real-world reporting lag,
          not a broken feed.
        </p>
      </section>

      <section className="mb-8" id="g7-sovereign-debt">
        <h2 className="mb-2 text-base font-semibold text-text">
          G7 Sovereign Debt — a deeper per-country breakdown, built against a 106-section spec
        </h2>
        <p className="mb-2">
          A separate, much more detailed institutional spec (&ldquo;G7 Sovereign Debt Systemic Risk
          Engine&rdquo;) asked for a full early-warning system across the US, Japan, Germany, France,
          Italy, the UK and Canada: three independent 0-100 scores per country (Structural Vulnerability,
          Market Stress, Funding/Contagion), a 7-stage crisis model, an interactive contagion network,
          PCA/factor decomposition, historical backtesting to 1992, a daily AI report and a 10-scenario
          stress-test library. Checked component by component the same way the second EM Debt spec was:
          what free, verified data genuinely supports is built at{" "}
          <a href="/dashboard/g7-debt" className="text-accent hover:underline">/dashboard/g7-debt</a>;
          everything else is disclosed below as deferred, not faked.
        </p>
        <p className="mb-2">
          This deliberately does <strong>not</strong> register as a second GFMI-weighted engine. The
          existing Treasury &amp; Sovereign engine above already covers this exact seven-country universe
          with 10Y/30Y yields and debt/GDP, and this project&apos;s engine registry already made the
          explicit choice to fold &ldquo;Global Sovereign Debt&rdquo; into that one engine specifically to
          avoid counting the same underlying yield/debt signal twice in the composite — which the new
          spec&apos;s own section 97 separately warns against doing. The G7 Debt page instead reuses that
          engine&apos;s existing yield and debt/GDP series as inputs to the deeper three-score breakdown,
          shown alongside (not instead of) the Treasury engine&apos;s own composite score.
        </p>
        <p className="mb-2">
          <strong>Structural Vulnerability</strong> is government debt/GDP and fiscal balance/GDP,
          cross-sectionally z-scored against the other six G7 economies (the same peer-group principle used
          for EM Debt). Six of seven countries&apos; debt/GDP reuses the Treasury engine&apos;s existing
          FRED-sourced series; France has none (checked directly — FRED carries no French
          general-government-debt/GDP series at all), so France&apos;s debt/GDP comes from IMF&apos;s
          Global Debt Database instead. Fiscal balance/GDP is new for all seven — no existing source in
          this project tracked it for any G7 country — from IMF&apos;s World Economic Outlook database,
          both via the free, unblocked <code>api.imf.org</code> SDMX endpoint (see above), capped to
          observations at least one calendar year old so a multi-year-ahead WEO forecast is never ingested
          as an observed fact.
        </p>
        <p className="mb-2">
          <strong>Market Stress</strong> is each country&apos;s own 10Y-yield time-series z-score (the same
          series already on the Treasury tab — Bundesbank/BoE/BoC/MOF daily, FRED/OECD monthly proxy for
          Italy and France), blended for France and Italy with their own spread-to-Bund time-series
          z-score — the standard eurozone-fragmentation gauge. Germany has no &ldquo;vs-Bund&rdquo; spread
          since it IS the Bund; the US, UK, Japan and Canada have no natural single benchmark peer to
          spread against, so their market score is the yield z-score alone.
        </p>
        <p className="mb-2">
          <strong>Funding/Contagion</strong> is a single G7-wide breadth reading — the share of the OTHER
          six G7 economies whose structural+market blend is already elevated (≥60) — applied identically to
          all seven countries. This is real and computed, not fabricated, but is disclosed as a
          simplification: it is not yet the bespoke bilateral bond-correlation/financial-exposure network
          the spec envisions, since no free source publishes G7 cross-holdings data. The composite score is
          a GDP-weighted blend of the seven countries&apos; vulnerability scores (World Bank GDP, the
          spec&apos;s own requirement that the US and Japan carry more weight than smaller G7 economies),
          not a flat seven-way average.
        </p>
        <p>
          <strong>Explicitly not built</strong>, checked and disclosed rather than faked: interest-burden
          acceleration, gross financing requirement, maturity-wall buckets, auction-level stress and
          investor-base/central-bank-holdings tracking (no single free, uniformly-available-for-all-seven
          source for per-country interest expense, auction results or bond ownership was verified live —
          US Treasury Fiscal Data and Japan&apos;s MOF both publish auction results, but building seven
          different national auction parsers is a real, large effort not attempted this pass); a PCA/
          factor-model decomposition; an interactive sovereign-contagion network graph; historical
          backtesting against 1992-2024 crisis episodes with lead-time analysis; and a daily G7 debt report
          with an AI Q&amp;A layer. None of these show fabricated values — the three scores that are built
          are real, and the rest simply isn&apos;t on the page yet.
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

      <section className="mb-8" id="central-bank-liquidity-regime">
        <h2 className="mb-2 text-base font-semibold text-text">
          Central Bank Liquidity: Ample, Adequate or Deficit — not just balance-sheet size
        </h2>
        <p className="mb-2">
          The Global Liquidity engine above blends everything into one G7+China composite score,
          which answers &ldquo;how tight is liquidity globally&rdquo; but not &ldquo;is the Fed
          specifically ample right now, or is the ECB the tight one?&rdquo; The Liquidity tab now
          also shows a per-central-bank table answering that directly, classified into AMPLE /
          ADEQUATE / NORMAL / TIGHTENING / DEFICIT.
        </p>
        <p className="mb-2">
          The classification basis is deliberately the <strong>money-market rate vs. the bank&apos;s
          own policy rate</strong> — the actual framework central banks themselves use to judge
          reserve scarcity, not balance-sheet size. Under a floor system, the market rate should sit
          a few basis points <em>below</em> the policy rate when reserves are ample; it prints at or
          <em> above</em> the policy rate (arbitrage/collateral pressure) when reserves start getting
          scarce — the same mechanism behind the September 2019 US repo spike. A raw balance-sheet
          z-score only says &ldquo;bigger or smaller than its own recent trend,&rdquo; a materially
          weaker signal for this specific question, so it is now paired with a real rate spread for
          four of the six banks tracked:
        </p>
        <ul className="mb-2 list-inside list-disc space-y-1">
          <li><strong>Fed:</strong> SOFR − IORB (Interest on Reserve Balances, FRED series IORB, daily since mid-2021), alongside the actual weekly reserve-balances level (WRESBAL) rather than only total balance-sheet size (WALCL also includes non-reserve assets).</li>
          <li><strong>Bank of England:</strong> SONIA − Bank Rate, both from BoE&apos;s own IADB (series IUDSOIA and IUDBEDR).</li>
          <li><strong>ECB:</strong> €STR − Deposit Facility Rate, €STR from the ECB&apos;s own public Data Portal API (no key required — the successor to the old SDW web service, same request syntax).</li>
          <li><strong>Bank of Canada:</strong> CORRA − Target Overnight Rate, both from the BoC&apos;s own Valet API.</li>
        </ul>
        <p className="mb-2">
          Two of six deliberately do <strong>not</strong> use a spread, disclosed per row rather than
          papered over: <strong>Bank of Japan</strong> is classified on its uncollateralized
          overnight call rate&apos;s own level trend — sourced from BOJ&apos;s own new (launched
          February 2026) public Time-Series Data Search API, series STRDCLUCON, free and
          key-less — since no free daily BOJ policy/target-rate time series was found to pair it
          with for a spread. <strong>PBOC (China)</strong> stays the rate-only proxy already used
          elsewhere in this project (its 3-month interbank rate), for the same reason no free
          PBOC balance-sheet series exists.
        </p>
        <p>
          Every regime label is relative to that <strong>same</strong> bank&apos;s own trailing
          ~1-year z-score, not a universal absolute threshold shared across banks — the same
          convention every other z-scored engine in this project uses. A &ldquo;DEFICIT&rdquo;
          read does not mean the same absolute spread width for the Fed as for the ECB, and is
          not by itself a crisis-level reading: for example, the ECB narrowed its own interest-rate
          corridor in April 2024, which mechanically pushed €STR&apos;s spread to the Deposit
          Facility Rate structurally closer to zero than its pre-2024 range, so a reading near the
          top of that bank&apos;s own recent range can score as DEFICIT at a numerically modest
          spread. Read each row as &ldquo;unusually tight or loose for this specific bank
          lately,&rdquo; not as a cross-bank-comparable absolute scale.
        </p>
      </section>

      <section className="mb-8" id="central-bank-liquidity-forecast">
        <h2 className="mb-2 text-base font-semibold text-text">
          Central Bank Liquidity Forecast (short / medium / long term) — trend extrapolation, not a prediction
        </h2>
        <p className="mb-2">
          The Liquidity tab also shows a forward-looking table for the same six banks, with three
          horizons: <strong>short term</strong> (~2 weeks ahead), <strong>medium term</strong>
          (~2 months ahead) and <strong>long term</strong> (~6 months ahead). This is
          <strong> not</strong> built from any forward-looking market instrument — no free OIS-forward
          curve or central-bank dot-plot feed is tracked here. It is a plain ordinary-least-squares
          fit to each bank&apos;s own real basis series (the exact same spread or rate used for the
          current-regime table above), fit over a trailing calendar-day window, projected forward,
          and re-scored against that bank&apos;s own trailing baseline the same way the current
          regime is computed.
        </p>
        <p className="mb-2">
          The slope-fitting window is measured in calendar days, not observation count, deliberately:
          five of the six basis series update daily, but China&apos;s (the 3-month interbank rate) is
          monthly. A 30-calendar-day window fit to a single monthly print cannot support a short-term
          slope, so it correctly returns <strong>INSUFFICIENT_DATA</strong> for that cell rather than
          fitting a line through one point. Windows: 30 days for the short-term horizon, 120 days for
          medium-term, 400 days for long-term — each requiring at least 5 real observations inside its
          window before it will produce a reading.
        </p>
        <p className="mb-2">
          Each cell shows two things: the <strong>regime pill</strong> (AMPLE/ADEQUATE/NORMAL/
          TIGHTENING/DEFICIT) the trend would land on if it continued unchanged, and a{" "}
          <strong>momentum arrow</strong> (↑ tightening, ↓ easing, → stable) showing which direction
          the projection moves relative to today&apos;s reading. Both are computed off the identical
          z-score baseline as the live regime table, so a forecast cell is directly comparable to the
          &ldquo;now&rdquo; column next to it.
        </p>
        <p>
          This is explicitly a momentum read, not a guaranteed outcome — a rate decision, a
          quantitative-tightening taper or restart, or a funding-market shock is not modeled anywhere
          in this calculation and can invalidate it instantly. Treat it the same as every other
          engine&apos;s &ldquo;model estimate, not a guaranteed forecast&rdquo; disclaimer.
        </p>
      </section>

      <section className="mb-8" id="credit-spreads-by-country">
        <h2 className="mb-2 text-base font-semibold text-text">
          Credit Spreads by Country (G7 + China) — what&apos;s real, and the gaps disclosed
        </h2>
        <p className="mb-2">
          The Credit tab now shows a per-country table alongside the composite Credit Markets
          engine, the same &ldquo;disclosed basis, per-unit regime&rdquo; pattern used for Central
          Bank Liquidity above. Corporate credit is not observable per-country the way sovereign
          debt is, so each row shows the best real signal that actually exists for that country,
          not a forced national breakdown:
        </p>
        <ul className="mb-2 list-inside list-disc space-y-1">
          <li><strong>United States:</strong> US High-Yield OAS (ICE BofA, via FRED) — already tracked, genuinely US-specific.</li>
          <li><strong>Germany, France, Italy:</strong> all three show the <em>same</em> Euro-Area High-Yield OAS value. This is not a data gap — eurozone corporate bonds are issued and spread-quoted in one EUR-currency market, not split by nation the way government debt is (there is no separate &ldquo;German corporate index&rdquo; distinct from the Euro-area one). Country-specific eurozone credit risk shows up on the <em>sovereign</em> side instead (the Treasury tab&apos;s Italy-Germany &ldquo;BTP-Bund&rdquo; and France-Germany &ldquo;OAT-Bund&rdquo; spreads), which is not duplicated here since it is a different signal.</li>
          <li><strong>China:</strong> a new, dedicated <strong>AAA Corporate-Government Spread</strong> — ChinaBond (CCDC) publishes a full corporate-bond yield curve by credit rating alongside its government curve (already used for China&apos;s 10Y sovereign yield), found via the site&apos;s own curve-tree API. Both legs are the same publisher, same 10Y tenor, same day, so the derived spread is a clean, real, China-specific corporate signal (currently ~35-40bps, ranging roughly 12-60bps over the last ~2.7 years of history pulled) — a genuine upgrade over relying on the regional Asia-Pacific EM proxy alone for China exposure.</li>
          <li><strong>United Kingdom, Canada, Japan:</strong> no free GBP, CAD or JPY-denominated corporate bond spread index exists. FRED&apos;s entire ICE BofA Indices release (all 192 series enumerated directly via its API, not just keyword search) was checked and contains zero non-USD/EUR corporate bond index. The Bank of England&apos;s own Interactive Database was also checked directly: it publishes corporate bond <em>issuance</em> flow data (gross issues, repayments, net issues by sector) but no queryable yield or spread series. Rather than leave these three UNAVAILABLE, each now shows the <strong>BIS credit-to-GDP gap</strong> instead — see below for what that is and why it was chosen over the alternatives.</li>
        </ul>
        <p className="mb-2">
          <strong>Credit-to-GDP gap for UK, Canada and Japan (new).</strong> The BIS (Bank for
          International Settlements) publishes a free, no-key SDMX API for its Total Credit
          statistics, including the credit-to-GDP <em>gap</em> — actual private-sector credit minus
          its long-run HP-filter trend, as a share of GDP. This is the literal Basel III
          countercyclical-capital-buffer indicator: the standard, official early-warning signal
          central banks themselves use for a credit boom building up ahead of a future correction.
          It was already used here for China (as &ldquo;China credit impulse&rdquo;); checking the
          same API directly (not assumed from documentation) confirmed it also covers the UK,
          Canada and Japan, with data current through 2025-Q4 for all three. As of that print: UK
          −17.8, Canada −15.3 (both well below trend, consistent with post-2022 rate-hike
          deleveraging), Japan +6.8 and <em>rising</em> (4.3 → 5.2 → 6.8 over the prior three
          quarters) — a genuinely different, real signal: Japan is the one G7 economy in this table
          currently showing a credit boom building, not a credit contraction.
        </p>
        <p className="mb-2">
          Two alternative sources were suggested and checked before settling on BIS: a Bank of
          England IADB series for &ldquo;total domestic credit growth&rdquo; (no single clean series
          code for an aggregate figure was found in the database), and Statistics Canada&apos;s
          National Balance Sheet Accounts table 38-10-0238-01 (real, and checked directly via
          StatCan&apos;s own Web Data Service metadata — but it turned out to be a{" "}
          <em>household</em>-sector-only credit summary table, not the combined household+corporate
          credit market debt it had been described as, and even a correct table would still be a
          raw, undetrended level rather than the properly risk-signed gap BIS already publishes).
          BIS was used instead because it is verified accurate, already integrated in this codebase
          for China with the same methodology, and — critically — is properly detrended: a raw
          credit-growth or loan-outstanding figure is directionally ambiguous (growth can mean
          either easing conditions or a bubble building) in a way the BIS gap is not.
        </p>
        <p>
          Because the credit-to-GDP gap measures something structurally different from a
          market-priced spread — a quantity-side credit-boom signal, quarterly, not a daily-priced
          risk premium — it is tagged &ldquo;Credit-to-GDP Gap&rdquo; on the dashboard table rather
          than shown as if it were the same kind of reading as the OAS-based rows. Read a high
          reading there as &ldquo;credit is growing faster than its trend relative to GDP,&rdquo;
          not as &ldquo;a spread has widened.&rdquo; The composite Credit Markets engine includes
          all three (UK, Canada, Japan credit-to-GDP gaps) as additional weighted inputs alongside
          the China AAA corporate-government spread and the existing US HY/IG, EM and Euro-area HY
          inputs.
        </p>
      </section>

      <section className="mb-8" id="em-debt-by-country">
        <h2 className="mb-2 text-base font-semibold text-text">
          Emerging-Market Debt — rebuilt as a structural + market + contagion engine
        </h2>
        <p className="mb-2">
          The EM Debt tab was rebuilt against a detailed institutional specification (&ldquo;EM
          Debt Systemic Risk Engine,&rdquo; 76 sections) whose core complaint was correct: an
          exchange-rate-only reading is insufficient, since FX is one transmission channel among
          many, not a proxy for debt stress itself. Every one of the spec&apos;s ~20 requested
          sub-engines (sovereign solvency, rollover risk, FX reserve adequacy, sovereign CDS,
          capital flows, foreign bond ownership, sovereign-bank nexus, corporate external debt,
          auctions, contagion, backtesting, an AI agent, a world map) was checked individually
          against what free, verified data actually supports before writing any code. What follows
          is the honest result: real structural and market data now drives the score, and every
          component the spec asked for that has no free source is disclosed here, not silently
          dropped or faked.
        </p>
        <p className="mb-2">
          <strong>What is built, and from where:</strong>
        </p>
        <ul className="mb-2 list-inside list-disc space-y-1">
          <li><strong>Structural vulnerability</strong> — World Bank Open Data API (free, no key, verified live): government debt/GDP, external debt/GNI, external debt service/exports, short-term external debt/reserves, reserve adequacy (months of imports), current account/GDP, real GDP growth, and fiscal balance/GDP. Annual data, cross-sectionally z-scored against the 14-country EM peer set at each observation — the spec&apos;s own instruction (&ldquo;do not use universal debt/GDP thresholds… use peer groups&rdquo;), and the only sensible basis anyway, since an annual series never accumulates the ~20 points a time-series z-score needs. Coverage genuinely varies: World Bank&apos;s International Debt Statistics excludes several upper-middle/high-income economies in the tracked set from its external-debt-ratio family (Poland, Hungary, the Czech Republic, Malaysia and South Korea have no WDI external-debt-to-GNI series, for instance), and the government-debt and fiscal-balance ratios specifically have no WDI data for a different subset (Indonesia, China, the Philippines, Poland and the Czech Republic) — each row&apos;s &ldquo;coverage&rdquo; percentage discloses this directly, and most of these specific gaps are now patched from other free sources (see below). A genuine, verified example: Turkey&apos;s short-term external debt exceeded 100% of total reserves in the 2024 observation — short-term FX obligations larger than the reserves available to meet them, a real rollover-risk red flag, not a synthetic one.</li>
          <li><strong>Gap-filling the World Bank coverage holes above</strong>, checked and sourced individually rather than left blank: (1) <strong>government debt/GDP</strong> for Indonesia, China, the Philippines, Poland and the Czech Republic — IMF&apos;s Global Debt Database (free, no key; &ldquo;190 advanced economies, emerging market economies and low-income countries, dating back to 1950&rdquo;) genuinely has this for all five, verified live (China 88.3%, Indonesia 40.2%, Philippines 57.1%, Poland 55.3%, Czech Republic 43.0%, all 2024). (2) <strong>fiscal balance/GDP</strong> for China and Indonesia — IMF&apos;s World Economic Outlook database has &ldquo;net lending/borrowing, general government, % of GDP&rdquo; for both; since WEO is a projections database, only observations at least a full calendar year old are used, to avoid quietly ingesting a multi-year-ahead forecast as if it were an observed fact. (3) <strong>external debt/GNI</strong> for the Czech Republic and Hungary — World Bank&apos;s own Quarterly External Debt Statistics (QEDS), a separate, broader-coverage product from the WDI ratio family, has a real gross external-debt-position figure for both (Czech Republic $273.6bn, Hungary $313.6bn, both 2026 Q1), divided here by World Bank&apos;s own GNI level to build the ratio. Two further patches were attempted and explicitly rejected on data-quality/methodology grounds rather than used anyway: QEDS&apos;s short-term-debt breakdown for these same two countries returns mostly stale (2016) or literal-zero values, and its &ldquo;debt service&rdquo; series are forward-looking scheduled-payment buckets, not a trailing-12-month actual comparable to WDI&apos;s ratio — both stay genuinely unavailable rather than being filled with a shaky or mismatched substitute. Poland, Malaysia and South Korea were checked the same way for all three external-debt-family gaps: Poland and Korea have no QEDS data at all (checked directly, every page), and Malaysia&apos;s latest QEDS observation is from 2016 — too stale to use.</li>
          <li><strong>Sovereign CDS</strong> — no free live feed exists for actual credit-default-swap pricing (ICE/Markit-licensed, checked directly). Aswath Damodaran (NYU Stern) publishes a free, no-login annual workbook with a real &ldquo;10-year CDS Spreads&rdquo; sheet — actual observed market levels where a market maker quotes one (his own separate ratings-derived synthetic spread column is deliberately not used, since it adds no information beyond the credit rating itself). This is disclosed as a single point-in-time annual snapshot, not a daily feed — there is no &ldquo;CDS acceleration&rdquo; signal here because there is nothing to accelerate from one observation. Argentina and a few others show no CDS at all in this dataset (no market quotes one), left unavailable rather than backfilled.</li>
          <li><strong>Market/FX</strong> — the existing 14-currency composite (see the &ldquo;prominent EM currencies&rdquo; work below) blended with the CDS reading above. Own-history time-series z-score, unchanged mechanism from before.</li>
          <li><strong>Contagion breadth</strong> — the fraction of the 14 tracked economies currently at Funding-Stress-or-worse (vulnerability score ≥ 60), scaled so the spec&apos;s own stated calibration (&ldquo;40%+ stressed = CRITICAL&rdquo;) maps to a 100 score. Not weighted by GDP, creditor exposure or trade linkages (no free data supports that weighting) — a plain breadth count, disclosed as such.</li>
          <li><strong>Latent risk / market-led-warning flags</strong> — genuinely computed per country: &ldquo;latent&rdquo; means structural score ≥ 55 while market score stays below 40 (fundamentals deteriorating before the market notices — the spec&apos;s highest-priority feature); &ldquo;market-led&rdquo; is the reverse (market pricing running materially ahead of fundamentals). Both read directly from the same real data above, not asserted.</li>
          <li><strong>7-stage crisis staging</strong> (spec&apos;s &ldquo;Stage 1: Early Warning&rdquo; → &ldquo;Stage 7: Default/Restructuring&rdquo; framework) — built as a finer 7-band split of the same 0-100 vulnerability score (bands at 15/30/45/60/75/90, matching the app&apos;s existing severity palette exactly), with Stage 2 (Early Warning) and Stage 4 (Market Repricing) each promoted — never demoted — whenever the latentRisk or marketLedWarning flag above is true for that country, so a country whose fundamentals are quietly deteriorating is never shown at Stage 1. <strong>Stage 7 (&ldquo;Acute Crisis&rdquo;) is disclosed honestly as a score band, not a detected default</strong> — no free data source can confirm an actual sovereign default or restructuring event, so this stage means &ldquo;as severe as this model can measure,&rdquo; not &ldquo;default has occurred.&rdquo; The composite engine score gets its own stage (shown at the top of the dashboard page), and each country&apos;s individual stage is shown in the per-country table below it.</li>
          <li><strong>Corporate FX debt</strong> (BIS International Debt Securities statistics, free, no key, verified live for all 14 countries) — non-financial-corporate foreign-currency bonds outstanding in international markets, divided by World Bank GDP. A second EM Debt spec was supplied with the exact free-source hierarchy to check (IMF/BIS/World Bank first), and this BIS dataset genuinely covers it: e.g. India&apos;s corporates had $27.0bn, Mexico&apos;s $132.0bn, in foreign-currency international bonds outstanding as of 2026 Q1 — real, verified figures. Disclosed as a partial proxy: this is bond-market issuance only, not FX-denominated bank loans or domestically-issued FX debt, which BIS does not compile at this granularity for free.</li>
          <li><strong>Foreign ownership of local debt securities / a capital-flow-direction proxy</strong> (IMF Portfolio Investment Positions, formerly CPIS, free, no key) — previously declined (see below for why that call was reconsidered). Querying the dataset with a tracked country as counterpart returns one series per voluntarily-reporting creditor economy — 64 to 75 of them per country as of the 2023 vintage — which are summed to an aggregate foreign-holdings figure (e.g. India $79.1bn, China $561.9bn, sanity-checked against known market sizes and, for India, a realistic concentration in known FPI-routing jurisdictions like Singapore and Mauritius). The score actually used is the <strong>year-over-year change</strong> in that aggregate, not its level — this is far more robust to a persistently-incomplete reporter set than the level would be, since whichever creditors don&apos;t report tend to be missing in both years being compared, so the YoY delta still moves with real exposure changes among whoever does report.</li>
        </ul>
        <p className="mb-2">
          <strong>Blending (spec §31, adaptive weighting):</strong> the final score blends structural,
          market and contagion buckets with weights that shift by contagion breadth itself — the one
          real cross-country signal available — rather than an invented regime detector: roughly
          50/30/20 (structural/market/contagion) when breadth is low, moving toward 25/40/35 as more
          of the tracked set deteriorates simultaneously. FX/OAS alone is now at most 40% of the
          final score, directly answering the spec&apos;s core objection. The structural bucket
          itself now blends 10 indicators (the original 8 World Bank series plus the corporate
          FX debt and foreign-holdings-YoY signals above), each weighted and cross-sectionally
          z-scored the same way.
        </p>
        <p className="mb-2">
          A follow-up institutional specification (&ldquo;Emerging Debt Engine&rdquo;) supplied a
          documented free-source hierarchy — IMF SDMX API, BIS bulk/API endpoints, World Bank
          QEDS — and asked that each previously-declined component be re-checked against it before
          accepting the earlier conclusion. That re-check is what produced the corporate-FX-debt
          and foreign-holdings components above: the original &ldquo;no free source&rdquo; call on
          foreign ownership specifically was too hasty — IMF PIP is real and does work, once the
          risk signal is built as a YoY delta rather than a raw level (which is where the original,
          correct concern about reporting gaps actually bites).
        </p>
        <p className="mb-2">
          <strong>What is still not built, and why — disclosed, not dropped:</strong>
        </p>
        <ul className="mb-2 list-inside list-disc space-y-1">
          <li><strong>Full capital-flow reconstruction (bond/equity/ETF/fund flows, daily-to-monthly frequency).</strong> EPFR and IIF, the standard sources for this, are paid with no free tier found. The IMF PIP-based YoY signal above is a genuine but partial substitute — annual, not daily/monthly, and a position-level view rather than a true flow series.</li>
          <li><strong>A true domestic sovereign-bank nexus</strong> (bank balance-sheet holdings of their own country&apos;s government debt — the classic &ldquo;doom loop&rdquo;). Re-checked directly against this pass&apos;s new source list: IMF&apos;s Financial Soundness Indicators dataset has an indicator that looks exactly right (&ldquo;sectoral distribution of investments: central government, percent&rdquo;, reported by deposit-taking banks) — but querying it live returns no populated series for any of the 14 tracked countries at any sector code tried. BIS&apos;s Consolidated Banking Statistics were also checked and found to measure a different thing (cross-border bank claims by foreign creditor banks, not domestic banks&apos; own-sovereign holdings) — useful for a common-lender contagion view, not this specific metric. Genuinely not available free at this granularity, not merely unchecked.</li>
          <li><strong>Auction-level stress</strong> (bid-to-cover, tail, auction-secondary spread). No free aggregator exists; the spec&apos;s own national source list (RBI, ÁKK, Banxico, PDMO, etc.) would need ~14 separate, heterogeneous national debt-office integrations, each with its own format and parser — a real, large effort, not attempted this pass.</li>
          <li><strong>Backtesting against historical EM crises, a world-map/maturity-wall UI, an AI chat agent, a daily report, a vintage-aware &ldquo;what did GFMI know on date X&rdquo; database, and a from-scratch Python/DuckDB/Parquet data-lake rearchitecture.</strong> The backtesting needs the still-unavailable full flow/auction data above as historical input. The rest are large net-new product or infrastructure asks (this app has no chat agent, scheduled-report, or vintage-tracking infrastructure today, and runs on Next.js/Supabase rather than the spec&apos;s suggested Python/FastAPI/DuckDB stack) rather than data-sourcing gaps — out of scope for an incremental pass on an existing production app.</li>
        </ul>
        <p>
          The per-country table on the dashboard shows every structural indicator, the CDS reading,
          the FX reading, and both derived scores per country — so a single blended headline number
          never hides which specific country, and which specific factor, is actually driving it.
        </p>
      </section>

      <section className="mb-8" id="em-debt-fx-coverage">
        <h2 className="mb-2 text-base font-semibold text-text">
          Emerging-Market Debt — the underlying FX coverage (prominent EM currencies)
        </h2>
        <p className="mb-2">
          The market/FX side above draws on all 14 <strong>MSCI Emerging Markets constituents that
          the ECB itself publishes a daily reference rate for</strong>: Brazil, Mexico, South
          Africa, Turkey, India, Indonesia, China, the Philippines, Poland, Hungary, the Czech
          Republic, Thailand, Malaysia and South Korea — verified directly against
          Frankfurter&apos;s (the ECB reference-rate mirror already used elsewhere in this project)
          own currency list rather than assumed.
        </p>
        <p>
          Taiwan, Chile, Colombia, Peru, Saudi Arabia, the UAE, Qatar and Kuwait are also prominent
          EM debt issuers (several are MSCI EM constituents themselves), but the ECB does not
          publish reference rates for TWD/CLP/COP/PEN/SAR/AED/QAR/KWD — checked directly, not
          assumed — so no free daily FX source was reused for them here.
        </p>
      </section>

      <section className="mb-8" id="india-yield-curve-ccil">
        <h2 className="mb-2 text-base font-semibold text-text">
          India Yield Curve (new tab), and why CCIL is not used as a source
        </h2>
        <p className="mb-2">
          <strong>CCIL</strong> (the Clearing Corporation of India) publishes the industry-standard
          secondary-market reference for India&apos;s sovereign curve — its daily Zero Coupon Yield Curve —
          and was the first source checked for a fuller India debt-market picture. It was deliberately not
          used: CCIL&apos;s own Terms of Use, read in full, explicitly state (§4.8) that &ldquo;the User
          shall not conduct any systematic or automated data collection activities which include but are
          not limited to scrapping, data mining, data extraction and data harvesting&rdquo; on its site, and
          separately (§4.1) prohibit any commercial use of its published Content without CCIL&apos;s express
          written consent. This is a legal access restriction stated in plain language, not a technical bot
          block — but this project treats the two the same way: it does not circumvent either kind of
          restriction to reach data a source has said it does not want scraped. (Compare the Imperva/TSPD
          JS bot-mitigation challenge on RBI&apos;s own PDF subdomain, rbidocs.rbi.org.in, discussed above —
          same principle, different mechanism.)
        </p>
        <p className="mb-2">
          Instead, the new <strong>India Yield Curve</strong> engine is built entirely from RBI&apos;s own
          primary-auction results — genuine cut-off yields the government actually borrowed at, published
          as ordinary press releases on rbi.org.in (not gated in any way):
        </p>
        <ul className="mb-2 list-inside list-disc space-y-1">
          <li>
            <strong>Short</strong> (91-day and 364-day): the weekly &ldquo;T-Bill Auction Result:
            Cut-off&rdquo; release.
          </li>
          <li>
            <strong>Medium</strong> (residual maturity ≤8 years, e.g. 5Y/7Y reissues) and{" "}
            <strong>long</strong> (&gt;8 years, e.g. 10Y/14Y/30Y/40Y): the &ldquo;Government Stock - Auction
            Results: Cut-off&rdquo; release, bucketed by each auctioned security&apos;s maturity year minus
            the release&apos;s own year. When a release also auctions a Sovereign Green Bond or another
            non-standard instrument alongside ordinary G-Secs, only the plain G-Secs are bucketed — the
            others are skipped, not guessed.
          </li>
          <li>
            A continuous long-end cross-check, <span className="gfew-mono">india.gsec_10y</span>, from the
            OECD/FRED-mirrored India 10Y benchmark (monthly) — since RBI&apos;s own borrowing calendar
            doesn&apos;t auction a 10Y-ish security every week, this fills the gap between auctions.
          </li>
        </ul>
        <p className="mb-2">
          Three derived spreads read the curve&apos;s shape directly: 1Y-10Y (the primary inversion gauge —
          India has no liquid 2Y benchmark, so this plays the role the 2s10s spread plays in the US), 1Y-5Y
          (front-end steepness) and 5Y-10Y+ (back-end steepness) — each shown as its own live indicator on
          the India Yield Curve tab, with a plain-language read of which end is currently steeper and
          whether the curve has inverted. Because the medium/long buckets only update on weeks RBI actually
          auctions a security in that bucket, they are genuinely irregular (not a pipeline fault) — this is
          disclosed directly on the engine.
        </p>
        <p>
          <strong>Seasonal liquidity pattern (Diwali / fiscal year-end):</strong> India has a well-documented
          pattern of banking-system liquidity tightening in the weeks before Diwali (festive currency demand
          pulls cash out of the banking system) and again in the back half of March (advance-tax payments due
          March 15, plus the March 31 fiscal year-end) — both repeatedly reported by RBI and financial press
          across recent years. This project checks that pattern directly against its own backfilled RBI
          history (india.rbi_net_liquidity/india.wacr, extended via RBI&apos;s own year/month press-release
          archive — a genuine, publicly-advertised feature of rbi.org.in&apos;s press-release page,
          reached the same way a browser would: replicating its own postback rather than a bypass of
          anything) rather than only asserting the pattern in prose — shown as a &ldquo;Seasonal Pattern&rdquo;
          panel on the India Liquidity tab, with real computed averages and observation counts, and years with
          too little backfilled history yet named as such rather than papered over.
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
          shown alongside the score. The same 15/30/45/60/75/90 band thresholds that produce this regime
          label are also shown on the main dashboard as a 7-stage stepper (Low Systemic Risk → Watch →
          Vulnerability Building → High Systemic Risk → Crisis Developing → Major Deleveraging → Systemic
          Crisis), the same presentation used for the EM Debt engine&apos;s per-country crisis stages — it
          is not a second, independently-computed model, just a named view over the one composite score.
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
