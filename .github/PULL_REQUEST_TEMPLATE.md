## What this changes and why

<!-- One or two sentences. Link an issue if one exists. -->

## Verification

<!-- There is no CI yet (see CONTRIBUTING.md) — paste real output, not a checklist tick. -->

```
npx tsc --noEmit -p .
npx eslint <changed files>
npm run build
```

- [ ] Ran the relevant test suite(s) (`npm run test:carry` / `test:derivatives` / `test:geopolitical`),
      if this touches one of those modules
- [ ] Checked the change against **live** data, not just a local mock (if this adds/changes a source
      connector or an engine calculation)

## If this adds or changes a data source

- Link to the source's own terms of use / robots.txt confirming automated access like this is
  actually permitted.
- Which file(s) register it in the `sources` table — note that you can't run the migration
  yourself; say which `supabase/migrations/NNNN_*.sql` file needs to be applied.

## Anything deliberately left out of scope for this PR

<!-- e.g. "also noticed X is stale, filing as a separate issue rather than scope-creeping this PR" -->
