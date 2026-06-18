---
name: Behaviour signal capture & historical backfill (WC-L0E)
description: Where construct-feeding behaviour signals come from, why old sessions lack graphs, and how to backfill honestly.
---

# Behaviour signal capture & historical backfill

## Where construct-feeding signals actually come from
The signals that feed WC-L0 construct dims (motivation/confidence/engagement/adaptability/risk) are the
`SIGNAL_DEFICIT_MAP` keys (`career_confusion`, `placement_anxiety`, `social_withdrawal`,
`emotional_overload`, `cognitive_blocking`, …) written as `signal_type='activated'` with a populated
`strength`. They are produced by the **Signal Activation Runtime** (`services/signal-activation-runtime.ts`
→ `runEvidenceRuntime`).

**Trap:** the `signal-classifier.ts` / `lib/signal-ingest.ts` path (`POST /api/signals/ingest`) writes a
DIFFERENT, strength-less family (`implicit`/`cognitive`/`linguistic`). Re-running THAT path will NOT
populate any construct dimension. Only the activation runtime feeds the deficit map.

## The flag does NOT gate capture
`runEvidenceRuntime` is invoked **unconditionally** on `/api/capadex/session/:id/respond`
(routes/capadex.ts) after each answer batch — there is no feature-flag check on the capture call.
`FF_RUNTIME_INTELLIGENCE_ACTIVATION` gates only the downstream REPORTING/activation surfaces.
**Why it matters:** if old completed sessions have no behaviour graph, it is NOT a flag that was off — it
is a **code-rollout gap** (the runtime was added to `/respond` after those sessions completed). You cannot
"switch capture on" with a flag; the only honest fix is to re-run the engine offline (a backfill).

## Coverage reads the materialized graph, not the signals
Activating signals alone does NOT move graph coverage. `getBehaviorGraph` / `projectBehaviour` read
`capadex_behavior_graph`, which is materialized by **`buildBehaviorGraph`** (behavior-graph-service.ts).
A backfill MUST call `runEvidenceRuntime` → `buildBehaviorGraph` → `persistUserIntelligence`, in that order.

## Honest backfill rules (reusable pattern)
- Rebuild `EvidenceInput[]` from `capadex_responses` using the snapshotted `concern_bucket`.
- **Never fabricate telemetry**: `response_time_ms=null`, `answer_changed=false` (irrecoverable for old
  sessions) → no rapid/hesitation evidence is invented.
- Stamp provenance (`signal_value.wcl0e_backfill=true`) so backfilled rows are distinguishable from live.
- Resolve `EvidenceInput.kind` by MIRRORING the live route (probe `sdi_items` by `id::text` → 'assessment';
  else integer → `short_assessment_questions` → 'short_assessment'; else 'unknown') — not an ID-regex
  shortcut. In practice `capadex_responses.item_id` is UUID and resolves in `sdi_items`.
- Idempotent: target only sessions with NO `capadex_behavior_graph` row (`has_graph` EXISTS), refuse
  `--apply` unless the backfill flag is ON, default `--dry-run`.

## True ceiling honesty
Sessions with **0 responses** have no evidence → **permanently un-backfillable**. Report that as the real
ceiling (e.g. 7/9 = 77.8% when 2 of 9 have zero responses) — do NOT inflate toward an 80% target. The
un-backfillable test is `!graphPresent && responses===0` (exclude smoke-seed sessions that have a graph
but 0 responses).

## Audit artifacts must carry no PII
Audit JSON/markdown (e.g. `backend/audit/wc-l0e/_baseline.json`) must store a one-way masked email token
(`user_<sha256[:10]>`) at CAPTURE time, never the raw address. The mask is deterministic so per-user
grouping for trends is preserved. Verify with `grep -rc '@' backend/audit/<phase>/`.
