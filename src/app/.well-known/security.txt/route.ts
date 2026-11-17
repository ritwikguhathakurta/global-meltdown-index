// Real security.txt (RFC 9116) at its canonical required location,
// /.well-known/security.txt. Contact is GitHub's private vulnerability
// reporting flow for this repo (enabled specifically so this link works,
// not left pointing at a dead feature) — chosen over a personal email so
// nothing gets published publicly that wasn't meant to be.
const SECURITY_TXT = `Contact: https://github.com/ritwikguhathakurta/global-meltdown-index/security/advisories/new
Expires: 2027-11-17T00:00:00.000Z
Canonical: https://globalmeltdownindex.net/.well-known/security.txt
Preferred-Languages: en
`;

export function GET() {
  return new Response(SECURITY_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
