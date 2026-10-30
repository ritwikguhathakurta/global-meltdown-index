// Real llms.txt (https://llmstxt.org) — until this route existed, /llms.txt fell
// through to the auth gate and 307'd to /login, so any AI crawler fetching it got
// served login-page HTML instead. Facts below are the same ones in README.md's
// intro and "What the GFMI score means" section, not new claims.
const LLMS_TXT = `# Global Meltdown Index

> A systemic-risk terminal that turns free, official macro-financial data into one transparent composite score (GFMI) — 24 independent risk engines across the G7 and China, each computed deterministically from data traceable back to its own source. Every number is real; a stale or missing input is labeled UNAVAILABLE/STALE rather than guessed at.

## Pages
- [Homepage](https://globalmeltdownindex.net/): live GFMI score, India market regime snapshot, and a breakdown of all 24 engines.
- [About](https://globalmeltdownindex.net/about): what the platform is, how the 24 engines roll up into the GFMI score, and the data-honesty rule behind every number.

## API
- [GFMI endpoint](https://globalmeltdownindex.net/api/gfmi): public JSON response with the current composite score, regime, confidence, and every engine's contribution.

## Access
- The homepage above is public. The full dashboard — trend charts, source citations, every engine in detail — requires a free account at https://globalmeltdownindex.net/signup.
`;

export function GET() {
  return new Response(LLMS_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
