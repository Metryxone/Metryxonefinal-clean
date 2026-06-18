# WS3 — Competency Runtime Report
**Task:** MX-RUNTIME-01 · **Date:** 2026-06-17 · **Method:** authenticated HTTP code paths

## Activation status: ✅ ACTIVE (run-assessment → profile)

The competency assessment runtime is operationally active via the live authenticated
endpoints.

| Endpoint (real code path) | Result |
|---|---|
| `POST /api/competency/run-assessment` | ✅ 20 score submissions |
| `POST /api/competency/profile/:userId` | ✅ 20 career profiles |

## Measured runtime data (live DB counts)
| Metric | Count |
|---|---|
| `cra_scores` rows | **162** |
| Distinct users with scores | **20** |
| `cra_profiles` | **20** |
| Distinct competency codes exercised | **10** |

Target was 20 assessments → **20 achieved** (avg ~8 competency scores each).

Codes exercised (all validated against the in-code `COMPETENCY_META` allowlist):
`COG01, COG02, COM01, COM02, LEA01, EXE01, ADP01, ADP02, TEC01, EIQ01`.

## Identity-guard learning (no code defect)
`run-assessment`/`profile` enforce `callerId(req) === userId`. An earlier manual probe
appeared to 403 — the cause was a **shell collision** (`UID` is a bash readonly
builtin, so the test sent the host UID instead of the user's UUID). The driver sends
no `userId` to `run-assessment` (defaults to the session caller) and the correct
register-returned id to `profile/:id`; both succeed. The guard is correct as written.

## Honest notes / caveats
- **Demo data only.** Scores are random in `[40,90]`; profiles use sampled
  role/industry/stage values. Structurally valid, not diagnostically meaningful.
- **Downstream depth gap (pre-existing).** `competency_forecasts` /
  `p4_development_velocity` require longitudinal repeat assessments; this run is a
  single attempt per user, so forecasting layers remain data-starved (honest — not a
  runtime-path failure).
- **Shared dev/prod DB** — same disclosure as WS1.
