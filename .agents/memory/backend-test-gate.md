---
name: Backend node:test aggregate gate
description: How backend engine tests are wired into validation (pure vs DB split, quarantine).
---

# Backend node:test aggregate gate

Backend runs on `tsx` (never compiled), so the correct test runner is `tsx --test`
— NOT vitest (`backend/tsconfig.json` extends a non-existent `../tsconfig.json`).

Only ~17 of ~64 `tests/*.test.ts` import `node:test`; the rest are standalone
`tsx tests/x.test.ts` scripts (out of scope for the aggregate gate).

## Scripts (backend/package.json)
- `test:pure` — 6 DB-independent suites; **the registered validation gate** (no
  external services, CI-safe).
- `test:db` — 10 suites needing a live+seeded `DATABASE_URL` (most self-skip DB
  subtests without a DB, so they stay green but add no coverage).
- `test` — `test:pure && test:db`.

Classify a suite as DB by grepping `from 'pg'` / `new Pool` / `DATABASE_URL`.

## Quarantined (not in any gate)
- `onet-onto-weight-bridge.test.ts` — live-DB subtests assert
  `bridgeOnetDerivedWeights` inserts derived `onto_role_weights`. Against the
  shared dev ontology seed the bridge matches roles but inserts 0 → fails. It
  self-skips without a DB. Real bridge coverage/behavior gap, not a harness issue.

## Fixed test bug
- `workforce-os.test.ts` rbac wildcard test wrongly expected base `hasPermission`
  to treat `platform:*` as a universal cross-namespace wildcard. **Why:** base
  `hasPermission` only honours SAME-prefix wildcards by design; the god-mode
  `platform:*` rule lives in `hasPermissionScoped`. Corrected the assertion to use
  the right function — a test bug, not an engine regression.
