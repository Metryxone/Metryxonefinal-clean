---
name: WC-L0 User Intelligence Foundation
description: Persistence-only foundation layer that stores existing-intelligence outputs (persona/behaviour/snapshot) per session; two-metric honesty rules.
---

# WC-L0 — User Intelligence Foundation

A persistence layer (`wcl0_user_intelligence`, PK session_id), NOT a new engine: it stores the
outputs of intelligence that already exists, per completed session, behind
`FF_USER_INTELLIGENCE_FOUNDATION` / `userIntelligenceFoundation` (default OFF → no schema, no write →
byte-identical). Wired as a non-blocking, never-throws step in `postCompletionHooks`
(capadex-enterprise.ts), mirroring the WC-11 decision-persistence block.

**The durable honesty rules (the part code can't tell you):**
- **Coverage ≠ Accuracy — report them separately, never merge.** Persona Coverage is ~100% because
  persona is DERIVED for legacy sessions (existing keyword classifier on `concern_name` + stored
  `age_band` segment). Accuracy is reported independently and is ~0% because those sessions never had
  a user-SELECTED persona. Provenance-stamp every persona: `selected(1.0) | runtime(0.9) |
  derived_text(0.5) | derived_default(0.3)`.
- **Never let "user-selected" silently include runtime.** Accuracy = strictly `persona_source='selected'`;
  expose a SEPARATE "high-confidence (selected+runtime)" metric. A runtime persona is system-observed,
  not user-chosen — counting it as user-selected is a future inflation trap (architect flagged this).
- **Behaviour is never fabricated from score.** The 6 dims (motivation/confidence/risk/engagement/
  learning_style/adaptability) are PROJECTED from the already-built Unified Behavior Graph
  (`getBehaviorGraph`) via keyword/severity matching over existing signal/risk/pattern fields; a dim
  stays NULL when the graph is silent, and sessions with no graph carry no behaviour. Coverage is
  honestly capped by behavioural-signal capture (was 2/9), not by wiring — surface the ceiling, don't
  inflate to hit a >90% target.
- **Snapshot lever = "ensure AT LEAST ONE exists", not "exactly one".** `captureLongitudinalSnapshot`
  is append-only with NO unique constraint on session_id, and other hooks may also write one; guard
  with a `SELECT 1 ... LIMIT 1` existence check before capturing (idempotent for sequential re-runs /
  backfill). Don't claim strict uniqueness — a concurrent double-complete could still append two.

**Why:** WC-L0 is the substrate for Longitudinal / Personalization / Commercial / Future-Readiness
layers; if its metrics overclaim, every downstream consumer inherits fabricated confidence.

**Persona classifier dependency:** the keyword logic mirrors `detectPersona` in
routes/capadex-concern-intelligence.ts. It is replicated (with a pointer comment) in the service to
keep it dependency-light and avoid pulling the ~13k-line route graph into the hook / offline scripts —
if that classifier changes, update the mirror.

Scripts: `scripts/wc3/wcl0-backfill.ts` (writes, sets FF in-process, idempotent UPSERT) and
`scripts/wc3/wcl0-measure.ts` (SELECT-only → `audit/wc-l0/` 5 reports). Measured headline over
completed sessions with all-sessions transparency.
