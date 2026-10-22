# Security Policy

## Reporting a vulnerability

If you find a security issue in this repository or in the hosted deployment at
[globalmeltdownindex.net](https://globalmeltdownindex.net), please email
**ritwikguhathakurta@gmail.com** directly rather than opening a public issue — this is a
single-maintainer project with no dedicated security team, so a direct email is the fastest and
most responsible path.

Please include:
- What the vulnerability is and where it applies (a specific route, API endpoint, or code path).
- Steps to reproduce it.
- What you think the impact is (e.g. data exposure, auth bypass, injection).

There's no bug-bounty program and no guaranteed response time — this is a solo project, not a
funded security operation — but every report will be read and taken seriously.

## Scope

- **In scope**: anything in this repository's source code, the public `/api/*` endpoints, and the
  authentication/authorization logic in `src/lib/supabase/middleware.ts` and `src/proxy.ts`.
- **Out of scope**: vulnerabilities in third-party services this project depends on (Supabase,
  Vercel, FRED, or any other data source) — report those directly to the vendor. Social engineering,
  physical attacks, and denial-of-service testing against the live production site are also out of
  scope; please don't load-test `globalmeltdownindex.net` without asking first.

## What this project already does

- No secrets are committed — `.gitignore` excludes `.env*` except `.env.example`
  (`docs/growth/BASELINE_AUDIT.md` verified this directly).
- `/api/cron/*` routes require a bearer-token secret (`CRON_SECRET`); `/admin/*` requires a
  server-checked `admin` role, verified via the service-role client to avoid a Postgres RLS
  recursion issue — see `CLAUDE.md`'s "Auth / route protection" section for the exact mechanism.
- The public `/api/*` read endpoints are intentionally unauthenticated (by design — see
  `docs/ARCHITECTURE.md`); the two LLM-backed `ask` endpoints require a signed-in session and a
  20-second per-user cooldown to prevent cost-abuse.

This policy doesn't claim the project has been professionally audited — it hasn't. If you find
something, that report is genuinely useful.
