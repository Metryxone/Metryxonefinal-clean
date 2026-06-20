# Employability Signal Report — Phase 3

**Subsystem:** Employability Signals (Phase 3.8, `employability-signal-engine`)
**Status:** ✅ Operational (measured)
**Generated:** 2026-06-20
**Evidence subject:** `demo_subj_pm`
**Engine versions:** engine `phase-3.8` · library `phase-3.8`

> **Honesty contract.** A signal fires only when **all** of its contributing
> competencies are **measured** *and* satisfy the rule. Coverage (measured/total
> conditions) is reported separately. Proxy-based satisfaction is disclosed.

---

## 1. What signals are

Signals are rule-based, polarity-tagged developmental indicators composed over measured
competencies. Each signal declares contributing competencies with a required `direction`
(e.g. `strong`); the engine evaluates whether each condition is measured and satisfied.

| Catalog metric | Value |
|---|---|
| Signals in catalog | **3** |
| Signals fired | **1** |
| Signal coverage | **71.4%** |

---

## 2. Fired signal (measured) — Leadership Potential

| Field | Value |
|---|---|
| Signal | **Leadership Potential** (`sig_leadership_potential`) |
| Polarity / category | positive / leadership |
| Status | **fired** |
| Conditions measured | **3 / 3** (coverage 100%) |
| Confidence band | **measured** |

**Conditions (all satisfied):**
- Communication — 75 (Strong) ✓
- Collaboration — 75 (Strong) ✓
- Leadership — 75 (Strong) ✓

**Disclosed proxy caveat (verbatim from engine):** *"Measured via a domain-PROXY: 3
competencies currently resolve through 1 distinct domain (dom_interpersonal), so they share a
score until finer-grained competency scoring is populated."*

This is the honesty mechanic: the signal **did** fire on real, measured, satisfied conditions —
**and** the engine simultaneously discloses that the three competencies share a single domain
proxy, so a reader can weigh the evidence correctly.

---

## 3. Why not all signals fired

The other two catalog signals did **not** fire — their conditions were not all measured-and-
satisfied for this subject. The engine reports them as not-fired rather than inventing a fire.
A fabricated fire (a "fired" with an unmeasured or unsatisfied condition) would be caught by
the Phase 3.12 validator, which checks every fire for `measured && satisfied` evidence.

---

## 4. Success criterion

✅ **Employability signals operational** — a rule library evaluates measured competencies,
fires only on fully-measured-and-satisfied conditions, discloses proxy concentration, and
reports honest coverage.

## 5. Honest limitations

- Signal coverage 71.4% — not every condition across the catalog is measured for this subject.
- The single fired signal rests on a one-domain proxy; disclosed, not hidden.
