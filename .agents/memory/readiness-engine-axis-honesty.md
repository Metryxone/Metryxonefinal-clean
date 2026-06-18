---
name: Readiness engine axis honesty
description: How the per-product readiness engine scores 8 axes and the Structural-vs-runtime honesty trap when seeding to lift a score.
---

# Readiness engine (`backend/routes/readiness-engine.ts`) — axis honesty

The readiness engine scores 7 products × 8 orthogonal dimensions (structural/activation/
data/intelligence/commercial/operations/security/governance). Each dimension declares
`Signal[]` = guarded `count(*)>0` over a real table; dim score = round(met/declared*100);
a dimension with no declared signal reports `available:false` (NOT 0) and is excluded from
the overall mean. GET never writes; snapshots are an explicit POST.

## The trap: which table feeds which axis MATTERS for honesty
Structural is defined as **"config / reference schema materialized"** — it must count ONLY
true config/reference substrates, NEVER per-session runtime/derived captures. If a runtime
table is mapped under Structural and you then seed demo rows into it, Structural inflates on
demo data — that is metric gaming and breaks the Structural-vs-Activation/Data separation.

**Why:** a SA-100X readiness pass seeded demo rows into `capadex_signal_profiles` /
`capadex_linguistic_signals` (CAPADEX) and `tig_clusters` (Employer), all of which were
miscategorised under Structural — so Structural=100 was partly demo-driven. Architect review
flagged it. Fix was to MOVE those runtime/derived tables to Data/Intelligence (their correct
axis per the dimension definitions), leaving Structural backed only by real reference config
(clarity_questions + question_registry; employer_competency_roles + eios_competency_roles).

**How to apply:** before seeding to move any readiness number, confirm the target table sits
under the axis whose *definition* matches the table's nature. Demo/runtime data legitimately
lifts Activation/Data/Intelligence/Security; it must never lift Structural/Commercial/Governance
unless the row is genuinely real config. When auditing, disclose each demo table's readiness axis.

## Seed-script discipline
A seed whose per-block runner swallows exceptions can print "complete" on partial failure and
poison a downstream audit. Track failures and `process.exit(1)` if any block errored — an audit
built on a silently-partial seed is untrustworthy.
