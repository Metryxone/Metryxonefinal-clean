# Backend engine test suites

There are two families of test files in this directory:

1. **`node:test` suites** (run with `tsx --test`) — split into a **pure** gate
   (`test:pure`, no external services — CI-safe) and a **DB** gate (`test:db`,
   needs a live, seeded `DATABASE_URL`).
2. **Standalone scripts** — ~48 `*.test.ts` files that do **not** import
   `node:test`. They are plain `tsx tests/<name>.test.ts` scripts that self-assert
   (via `node:assert`, so a failed assertion throws and exits non-zero). These are
   run by the `test:engines:pure` / `test:engines:db` aggregates below. Before
   this runner existed, none of them were in any gate, so engine regressions could
   land silently.

## Commands

| Command | What it runs | Needs DB? |
|---------|--------------|-----------|
| `npm run test:pure` | DB-independent `node:test` suites | No — CI-safe |
| `npm run test:db`   | `node:test` suites that exercise a live Postgres | Yes (`DATABASE_URL`) |
| `npm run test:engines:pure` | DB-independent **standalone** engine scripts | No — CI-safe |
| `npm run test:engines:db`   | **Standalone** engine scripts that need Postgres (self-skips if `DATABASE_URL` is unset) | Yes (`DATABASE_URL`) |
| `npm run test:access-control` | The single Module Access Control standalone script (legacy convenience; also covered by `test:engines:pure`) | No |
| `npm test`          | All of the above in sequence | Yes for the DB halves |
| `npm run test:outcome-intelligence` | The single Outcome Intelligence suite (legacy convenience) | No |

`test:pure` and `test:engines:pure` are the registered validation gates: they run
without any external service, so they are the ones wired into CI. `test:db` and
`test:engines:db` are supplementary gates for a developer/CI environment that has
a live, seeded database (the `:db` engine aggregate self-skips — exit 0 — when
`DATABASE_URL` is absent, so it stays green in CI).

The standalone lists (PURE / DB / QUARANTINE) live in one place:
`tests/run-standalone.mjs`. Add a new standalone script to the correct array
there.

## Pure suites (`test:pure`)

- `behavioural-signals.test.ts`
- `employer-tig-calibration.test.ts`
- `global-competency-rollback.test.ts`
- `go-live-broken-journey.test.ts`
- `outcome-intelligence-engine.test.ts`
- `partner-ecosystem-referral-deal-value.test.ts`

## DB suites (`test:db`, require `DATABASE_URL`)

- `adaptive-causal.test.ts`
- `behavioural-integration.test.ts`
- `career-discovery-complete-entry.test.ts`
- `onet-derive-competency.test.ts`
- `onet-onto-weight-bridge.test.ts`
- `progression-outcomes-measured.test.ts`
- `psychometrics.test.ts`
- `role-title-crosswalk.test.ts`
- `talent-matching-job-crosswalk.test.ts`
- `workforce-os.edge.test.ts`
- `workforce-os.test.ts`

Most DB suites self-skip their DB-only subtests when `DATABASE_URL` is absent, so
they stay green without a database — but they only add real coverage with one.

## Quarantined (NOT in any gate)

These fail against the real-but-partially-seeded shared dev DB for **data**
reasons, not test-harness reasons. They are documented and kept out of the green
gates rather than silently hidden. Run each directly to investigate.

Standalone scripts (in the `QUARANTINE` array of `tests/run-standalone.mjs`):

- `archetype-governance.test.ts` — its `[B] computeArchetypeResult — DB-backed`
  block asserts exact ontology counts (2151 assigned / 338 unmatched) that only
  hold against one specific seed snapshot; the current shared dev DB returns 0, so
  those subtests fail. A real seed/coverage gap, not a harness problem. Run
  directly: `tsx tests/archetype-governance.test.ts`.
- `clarity-picker-fallback.test.ts` — its Tier-1 assertion requires a specific
  seeded master `concern_id` to resolve to `master_curated`; against the current
  DB it falls through to `static_fallback`. Run directly:
  `tsx tests/clarity-picker-fallback.test.ts`.

## Notes

- The backend runs on `tsx` (never compiled/typechecked), so `tsx --test` is the
  correct runner. Do **not** use vitest here — `backend/tsconfig.json` extends a
  `../tsconfig.json` that does not exist.
- The ~48 standalone `*.test.ts` scripts that do **not** import `node:test` are
  aggregated by `test:engines:pure` / `test:engines:db` (list in
  `tests/run-standalone.mjs`), except the two quarantined above.
