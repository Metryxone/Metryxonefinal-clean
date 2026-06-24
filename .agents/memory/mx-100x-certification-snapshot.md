---
name: MX-100X enterprise certification snapshot
description: The platform-wide honesty verdict and keystone gaps from the final MX-100X audit — how to frame MetryxOne maturity in future audits.
---

# MX-100X — final enterprise certification (read-only audit)

**Verdict: PARTIAL.** Architecture PASS · Activation PARTIAL (demo-weighted) · Usage/Outcomes FAIL (pre-launch).

**The one number that matters:** architecture-only maturity reads ~85%, but honest outcome-weighted
maturity is ~52%. The ~33-point delta IS the activation+usage+outcome gap. The platform is **built far
ahead of where it is used.**

**Keystone gaps (in leverage order), NOT engineering problems:**
1. Question→competency mapping is the systemic bottleneck — only ~7/419 competencies (1.7%) have
   mapped questions. It gates assessment, EI, readiness, career match, employer match, and adaptivity.
2. Served question bank is ~100% single-difficulty → adaptive assessment cannot adapt even when run.
3. Zero realized outcomes (validation_loop_outcomes=0) → **no accuracy/calibration claimable
   ANYWHERE** (employer fit WITHHELD, TIG uncalibrated, workforce forecast-accuracy empty). This is
   by-design abstention and is the platform's credibility moat — never override it.
4. Near-zero real usage (2 users, 0 completed CAPADEX sessions); employer/workforce activated only on
   a single demo org (@example.com).

**Why:** the platform is enormous (1,360 tables, ~14 domains, 60+ flags, 3 overlapping competency
taxonomies onto_*/ont_*/assessment-bank). Most of it is built and flag-gated but unfed. The path to
98% is population + usage + outcomes (a go-to-market exercise), NOT a rebuild.

**How to apply:** in any future platform-state audit, (a) keep Coverage⟂Confidence,
Activation⟂Usage, Architecture⟂Outcomes strictly separate; (b) never let demo/seed rows count as
usage; (c) never claim accuracy while validation_loop_outcomes=0; (d) lead the founder framing with
"strong bones, pre-launch activation, top fix = question coverage." Deliverables live in
`backend/audit/mx-100x/` (19 docs + `_evidence.md` ledger of real COUNT(*) on the shared live DB).
