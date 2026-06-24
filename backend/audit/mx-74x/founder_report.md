# MX-74X — Founder Report: Career Builder Intelligence Transformation

**Date:** 2026-06-24 · **Status:** Build complete · awaiting your approval before deploy.

---

## The one thing to know

Career Builder was never missing its brain — it was missing a **reliable power switch**. Nearly
every piece of career intelligence the brief asked for already existed in code (readiness, role
match, skill gaps, roadmap, recommendations, the composing bridge). The problem: it only turned on
via fragile runtime settings that were **wiped on every restart**. After a plain restart, Career
Builder silently dropped to its old, dumber behaviour.

We fixed that, and we filled the two genuine holes.

## What we did (in plain terms)

1. **One master switch that survives restarts.** A single `careerBuilderSuite` flag now turns the
   whole career-intelligence suite on by default — and it stays on after a redeploy. Flip it off and
   everything returns *exactly* to the old behaviour (a clean, reversible kill-switch). Ops can still
   override any single piece if needed.

2. **Career Path (new).** From a person's anchored role, we now generate a real, graph-backed
   progression — e.g. *Product Manager → Senior PM → Group PM → VP of Product* — using only real
   role-to-role connections in our graph, each with its own transition odds and typical time. If we
   can't anchor someone, we say so honestly instead of inventing a path.

3. **Learning Path (new).** We sequence a person's skill gaps into an ordered development plan —
   what to work on first, what action closes it, and roughly how long — drawn from the existing
   roadmap. Where a recommendation backs a step we show it; where none does, we say so rather than
   faking a course.

4. **Visible to admins.** Both new views are live in the Super-Admin Career Intelligence panel, next
   to the existing six career surfaces.

5. **Documented.** Ten grounded documents (architecture, each engine, readiness, gaps, passport,
   alignment, predictive posture, certification) live in `backend/audit/mx-74x/`.

## What we deliberately did NOT do (honesty first)

- **No fabricated accuracy.** We do not yet have real outcome data, so we make **no** prediction-
  accuracy claims. We report Coverage (how much we measured) and Confidence (how trustworthy)
  separately, and never blend them into a fake percentage.
- **No candidate/employer persona rebuild.** The new engines are admin-gated by design this phase;
  candidate- and employer-facing versions are flagged as follow-ups, not quietly shipped.
- **No passport auto-sync yet.** It touches candidate-facing, contact-sensitive surfaces and needs
  its own approval — recorded as a follow-up.

## Proof it works (real data, today)

- `adaptive_smoke_1`: full 4-step PM→VP path, 75% coverage, high confidence, mapped to the
  Product Management track.
- `demo_subj_pm`: Senior Backend Engineer → Backend Tech Lead with two lateral options, 25%
  coverage (sparse graph — honestly lower).
- Unknown / unanchored people: correctly return "not measurable" with a plain reason — never a made-
  up path.
- Frontend rebuilt successfully with the new views; the kill-switch verified to restore legacy
  behaviour exactly.

## Your decision

Everything is built, verified, and reversible. **Nothing is deployed.** Say the word and we ship it;
or we can first build the candidate-facing path/learning views and the passport auto-sync as the
next phase.
