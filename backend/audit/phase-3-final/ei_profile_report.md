# EI Profile Report — Phase 3

**Subsystem:** EI Profile composition (Phase 3.4, `ei-profile-engine`)
**Status:** ✅ Operational (measured)
**Generated:** 2026-06-20
**Evidence subject:** `demo_subj_pm` · role `role_sr_be_eng`
**Engine version:** `phase-3.4`

> **Honesty contract.** Strengths, development areas, and risks are derived from
> measured bands only. Growth Potential is framed as *developmental upside* (headroom),
> explicitly **not** a deficiency signal.

---

## 1. What the profile composes

The EI Profile composes the Phase 3.4 view from the Phase 3.3 scoring artifact
(`"numbers are re-shaped, never recomputed"`). It produces:

- **Overall EI** headline (score, band, coverage, confidence)
- **Strength areas** (dimensions at/above the Strong threshold)
- **Development areas** (below Strong)
- **Critical risks** (severe shortfalls)
- **Growth potential** (weighted headroom across improvable dimensions)

---

## 2. Measured result (`demo_subj_pm`)

| Field | Value |
|---|---|
| Overall EI | **75 — Strong** |
| Coverage | **100%** |
| Confidence | **60 — Moderate** (`domain_proxy` cap) |
| Strength areas | **5** |
| Development areas | **0** |
| Critical risks | **0** |
| Growth potential | **Moderate (25)** |

**Strengths (5):** Communication, Workplace, Problem-Solving, Leadership, Future Readiness —
each rationalised as *"Measured at 75 (Strong) — at or above the Strong threshold."*

**Growth potential (Moderate, 25):** weighted headroom of +25 across all five improvable
dimensions. The engine states: *"Growth Potential reflects developmental upside … higher
means more room to grow, not a deficiency."* Largest upside cited: Communication (+25),
Workplace (+25), Problem-Solving (+25).

---

## 3. Honest framing

- **Zero development areas / zero risks** is a *consequence of* every dimension landing at
  Strong (75) in this subject — not a hardcoded "all good." A subject with a sub-Strong
  dimension would populate `development_areas`; a severe shortfall would populate `critical_risks`.
- **Growth potential is upside, not a gap.** A high headroom number is a positive ("room to
  grow"), and the engine annotates it as such so it cannot be misread as a weakness.
- **Language policy enforced.** The profile ships `intent: developmental_signal_only` with the
  disclaimer that these are *not* hiring/promotion/suitability predictions.

---

## 4. Success criterion

✅ **EI profiles operational** — a composed profile returns overall headline, strengths,
development areas, risks, and developmentally-framed growth potential from measured data.

## 5. Honest limitations

- Confidence Moderate (60) inherited from `domain_proxy`; profile cannot exceed it.
- Because all dimensions share the proxy score, strengths are uniform for this subject;
  diversity arrives with granular competency scoring. Disclosed, not engineered.
