# Backend engine test suites (node:test)

These are the `node:test` suites (run with `tsx --test`). They are split into a
**pure** gate (no external services — safe to run in CI) and a **DB** gate (needs
a live, seeded `DATABASE_URL`).

## Commands

| Command | What it runs | Needs DB? |
|---------|--------------|-----------|
| `npm run test:pure` | DB-independent engine suites | No — CI-safe |
| `npm run test:db`   | Suites that exercise a live Postgres | Yes (`DATABASE_URL`) |
| `npm test`          | `test:pure` then `test:db` (aggregate) | Yes for the DB half |
| `npm run test:outcome-intelligence` | The single Outcome Intelligence suite (legacy convenience) | No |

`test:pure` is the registered validation gate: it runs without any external
service, so it is the one wired into CI. `test:db` is a supplementary gate for a
developer/CI environment that has a live, seeded database.

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

## Notes

- The backend runs on `tsx` (never compiled/typechecked), so `tsx --test` is the
  correct runner. Do **not** use vitest here — `backend/tsconfig.json` extends a
  `../tsconfig.json` that does not exist.
- The ~47 standalone `*.test.ts` scripts that do **not** import `node:test` are
  run individually via `tsx tests/<name>.test.ts` and are out of scope for these
  aggregate gates.
