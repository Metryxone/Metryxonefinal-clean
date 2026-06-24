---
name: Enterprise Certification (MX-105X)
description: Top-level read-only flag-gated composer that unifies candidate+employer journeys into one enterprise certification — the four-axis honesty rule and the compose-don't-recompute discipline.
---

# Enterprise Certification & Platform Activation (MX-105X)

A THIN top-level composer (flag `enterpriseCertification`, default OFF) that folds the
already-built activation / certification / health / outcome engines into ONE enterprise
certification. It composes — it never recomputes a score, writes a row, runs DDL, or fabricates.

## The rule that matters: FOUR axes, never composited
**Structural** (required tables present) ⟂ **Activation** (gating flag on) ⟂ **Adoption**
(live non-demo rows) ⟂ **Outcome-Confidence** (calibrated ≥ k_min). The headline **verdict is
STRUCTURAL-ONLY**; activation/adoption/outcome-confidence are reported ALONGSIDE, never folded in.
`null` = not measurable (table absent/unreadable), NEVER a fabricated 0. Coverage ⟂ Confidence too.

**Why:** an enterprise cert that folds activation/adoption into the structural verdict would
report "ready" off scaffolding alone, or "not ready" off honest 0-adoption — both lie. A real run
showed 100% structural but only ~half activated/adopted with outcome abstained; that DIVERGENCE
between axes is the honest signal, so the axes must stay readable independently.

## Compose, don't recompute (the trap this task hit)
The aggregate views (command-center health categories, founder exec metrics) must DERIVE from the
already-composed sub-views (recertification subsystems, unified-journey, outcome-readiness) — NOT
re-issue their own ad-hoc SQL counts. First implementation recomputed via raw SQL and drifted from
the required surface (missing readiness metrics + the `outcome`/`certification` categories) → review
REJECTED. **How to apply:** founder metrics = per-surface READINESS pcts pulled from the journey +
subsystem structural axes (+ adoption volumes read off each subsystem's adoption axis); health
categories map curated subsystems to a status, plus an `outcome` category (from outcome-readiness)
and a `certification` category (from the recert verdict). One source of truth per number.

## Other traps
- The global `/api/admin` auth gate intercepts BEFORE the route-level flag gate, so flag-OFF +
  unauth returns 401 (not 503); authed + flag-OFF returns 503. Smoke must accept {401,403,503}.
- Frontend gates the nav tab + render on a no-auth `/enabled` probe (`res.ok`) — hidden when OFF.
- Report Factory genuinely lacked a 7th `employer` report type; added additively (union + seeds
  reusing the existing `any` data_source, ON CONFLICT DO NOTHING) — NO new compute path. Report
  Factory itself is not flag-gated.
