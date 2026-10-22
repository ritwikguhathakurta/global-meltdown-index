# API Examples

Every response below was captured live against `https://globalmeltdownindex.net` on **2026-10-22**
while writing this document — not written from memory, not a mockup. Numbers will differ when you
run these yourself (the pipeline recomputes daily); the shape of the response won't.

None of these need an API key, a signed-in session, or any header at all — `/api/*` is deliberately
outside this app's auth gate (see `docs/ARCHITECTURE.md`). Run `npm run demo` for a scripted version
of this same walkthrough against either production or your own local dev server.

## Operational health

```bash
curl https://globalmeltdownindex.net/api/health
```

```json
{
  "status": "ok",
  "checks": { "database": "ok", "fred_api_key_configured": "ok" },
  "timestamp": "2026-10-22T09:06:56.840Z"
}
```

Meant for uptime monitoring, not analysis — checks that the database is reachable and that the one
`.env` key every engine depends on (`FRED_API_KEY`) is actually configured.

## The composite score

```bash
curl https://globalmeltdownindex.net/api/gfmi
```

```jsonc
// trimmed to 3 of 24 components — the real response includes all of them, plus a `previous` object
// for the prior day's run
{
  "data": {
    "current": {
      "as_of": "2026-10-22",
      "score": 72,
      "regime": "CRISIS_DEVELOPING",
      "confidence": 0.9,
      "amplifier_applied": 1.25,
      "components": {
        "credit": { "score": 70, "weight": 1, "contribution": 4.24 },
        "us_treasury_sovereign": { "score": 59, "weight": 1.2, "contribution": 4.29 },
        "global_liquidity": { "score": 54, "weight": 1.1, "contribution": 3.6 }
      },
      "methodology_version": "v0.1-freedata"
    }
  },
  "disclaimer": "CURRENT MACRO/MARKET ASSESSMENT — NOT A GUARANTEED FORECAST OR INVESTMENT RECOMMENDATION."
}
```

`score` is 0-100; `regime` is a labeled band (`CRISIS_DEVELOPING` here); `amplifier_applied` is the
nonlinear multi-shock multiplier described in the README — 1.0 means no amplification kicked in.

## One engine, in detail

```bash
curl https://globalmeltdownindex.net/api/credit
```

```jsonc
{
  "data": {
    "engineKey": "credit",
    "horizons": [
      {
        "as_of": "2026-10-22",
        "horizon": "short",
        "score": 70,
        "direction": "improving",
        "regime": "STRESSED",
        "confidence": 0.95,
        "top_drivers": [
          { "key": "credit.asia_em_oas", "label": "Asia-Pacific EM Corporate OAS (incl. China exposure)", "contribution": 100 },
          { "key": "credit.ig_oas", "label": "US Investment-Grade OAS", "contribution": 95 },
          { "key": "credit.hy_oas", "label": "US High-Yield OAS", "contribution": 91 }
        ]
        // ...medium and long horizons follow in the real response, each with its own window/weights
      }
    ]
  }
}
```

Every registered engine (`/api/yen`, `/api/liquidity`, `/api/treasury`, `/api/equities`,
`/api/banking`, `/api/property`, `/api/em-debt`, `/api/energy`, `/api/geopolitical`,
`/api/derivatives`, `/api/crypto`, `/api/cyber`, `/api/trade-policy`, `/api/supply-chains`,
`/api/market-concentration`, `/api/private-credit`, `/api/china`, `/api/india`,
`/api/india-liquidity`, `/api/india-yield-curve`, `/api/ai-*` x4, `/api/central-bank-guidance`) returns
this same `{ engineKey, horizons: [...] }` shape.

## Breadth across every engine at once

```bash
curl https://globalmeltdownindex.net/api/leading-indicators
```

```jsonc
// 81 indicators total as of this capture, one entry per tracked data point across every engine
{
  "data": {
    "indicators": [
      {
        "engineKey": "crypto_stablecoins",
        "key": "crypto.usdt_peg_deviation_bps",
        "asOf": "2026-10-22T00:00:00+00:00",
        "unit": "bps",
        "value": 7.73,
        "status": "LIVE",
        "sourceKey": "coingecko",
        "sourceTier": 3,
        "classification": "leading"
      }
      // ...80 more
    ]
  }
}
```

`status` is one of `LIVE` / `RECENT` / `STALE` / `UNAVAILABLE`, computed per-source against that
source's own real publication cadence (`src/lib/quality/freshness.ts`) — a 0 on the `STALE`/
`UNAVAILABLE` count isn't the goal; an honest count is.

## The source registry

```bash
curl https://globalmeltdownindex.net/api/sources
```

```jsonc
// 76 registered sources as of this capture
{
  "data": {
    "sources": [
      {
        "id": 67,
        "key": "ice_futures_europe_cot",
        "name": "ICE Futures Europe Commitments of Traders",
        "institution": "ICE Futures Europe",
        "url": "https://www.ice.com",
        "tier": 1,
        "category": "derivatives",
        "status": "active"
      }
      // ...75 more
    ]
  }
}
```

`tier` is 1 (official primary — central banks, FRED, SEC EDGAR), 2 (multilateral/academic), or 3
(licensed/unofficial aggregators like Yahoo Finance or CoinGecko, used only where no Tier-1/2 source
exists) — see `CLAUDE.md`'s "Adding a new data source connector" section for the full rule.

## What's authenticated instead

The dashboard UI (`/dashboard/*`) requires a free account — see the README's
[Quick start](../README.md#quick-start). Two LLM-backed endpoints (`/api/derivatives/ask`,
`/api/geopolitical/ask`) also require a signed-in session plus a 20-second per-user cooldown, since
they call a paid LLM API per request rather than reading pre-computed data.
